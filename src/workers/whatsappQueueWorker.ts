import { Job } from "bullmq";
import { antiBanService } from "../services/antiBanService.js";
import jobQueueService from "../services/jobQueue.js";
import logger from "../utils/logger.js";

/**
 * Worker to process outbound WhatsApp messages with human-like delays
 * and Anti-Ban velocity enforcement.
 *
 * This is the ONLY exit point for ALL WhatsApp messages (AI replies,
 * campaigns, direct sends). The Velocity Rule gate here protects
 * the server IP from being flagged by WhatsApp.
 *
 * Uses the native OpenClaw WhatsApp runtime (getWhatsAppRuntime) instead
 * of the deprecated WhatsappAdapter / ChannelManager singleton (Task 5.5).
 */
export const initializeWhatsappWorker = () => {
  logger.info("Initializing WhatsApp Outbound Worker (Anti-Ban enabled)...");

  jobQueueService.process("whatsapp-outbound", async (job: Job) => {
    const { channelId, jid, message, options } = job.data;

    logger.info(`Processing outbound WhatsApp message for ${jid} (Job: ${job.id})`);

    try {
      // Lazy import — avoids pulling the WhatsApp runtime before it is initialised
      const { getWhatsAppRuntime } = await import("../../extensions/whatsapp/src/runtime.js");
      const runtime = getWhatsAppRuntime();

      // ─── ANTI-BAN: VELOCITY RULE GATE (ATOMIC) ───────────────────────
      let velocityDelay = 0;

      // If this job was already rescheduled for velocity, skip the reservation
      // but still apply the human-mimicry jitter below.
      if (!job.data.skipVelocityReserve) {
        velocityDelay = await antiBanService.reserveVelocityDelay(channelId);
      }

      // AVOID STALLED JOBS: If delay > 25s, re-queue as a native delayed job
      // to free up this worker and prevent BullMQ from thinking we crashed.
      if (velocityDelay > 25000) {
        logger.info(
          `[AntiBan] Delay too long (${Math.round(velocityDelay)}ms). Rescheduling as delayed job...`,
        );
        await jobQueueService.addJob(
          "whatsapp-outbound",
          job.name || "rescheduled-send",
          {
            ...job.data,
            skipVelocityReserve: true, // Don't book another slot when we wake up
          },
          { delay: velocityDelay },
        );
        return { success: true, rescheduled: true };
      }

      if (velocityDelay > 0) {
        logger.debug(
          `[AntiBan] Velocity gate: delaying ${Math.round(velocityDelay)}ms ` +
            `for channel ${channelId} (to ${jid})`,
        );
        await new Promise((resolve) => setTimeout(resolve, velocityDelay));
      }
      // ─────────────────────────────────────────────────────────────────

      // 1. Calculate a human-like delay based on message length
      const text = typeof message === "string" ? message : ((message as any)?.text ?? "");
      const textLength = text.length || 10;
      const baseDelay = 2000 + Math.min(textLength * 50, 8000);
      // Add randomness (+/- 20%)
      const jitter = baseDelay * (0.8 + Math.random() * 0.4);

      logger.debug(`Simulating typing for ${Math.round(jitter)}ms...`);

      // 2. Set "composing" presence via native runtime socket
      const socket = runtime.channel.whatsapp.getActiveWebListener();
      await (socket as any)?.sendPresenceUpdate("composing", jid);

      // 3. Wait the duration
      await new Promise((resolve) => setTimeout(resolve, jitter));

      // 4. Stop typing
      await (socket as any)?.sendPresenceUpdate("paused", jid);

      // 5. Send via native WhatsApp runtime (respects accountId scoping)
      await runtime.channel.whatsapp.sendMessageWhatsApp(jid, text, {
        verbose: false,
        accountId: channelId,
        ...(options ?? {}),
        ...(typeof message === "object" && (message as any)?.mediaUrl
          ? { mediaUrl: (message as any).mediaUrl }
          : {}),
      });

      logger.info(`Successfully dispatched message to ${jid} via queue`);
      return { success: true };
    } catch (error: any) {
      logger.error(`Failed to process WhatsApp job ${job.id}:`, error);
      throw error; // Let BullMQ handle retries
    }
  });
};
