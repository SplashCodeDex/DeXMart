import { Router, Request, Response } from "express";
import { channelService } from "../services/ChannelService.js";
import logger from "../utils/logger.js";

const router = Router();

/**
 * POST /api/webhook/:channelId
 * Acknowledge incoming webhook updates.
 *
 * In the native OpenClaw plugin system, webhook delivery is handled by the
 * plugin's own gateway adapter (see extensions/). This route exists for
 * backwards-compatibility with services that POST to /api/webhook/:channelId.
 * It verifies the channel belongs to a known tenant and returns 200.
 */
router.post("/:channelId", async (req: Request, res: Response) => {
  const channelId = req.params.channelId as string;
  const tenantId = (req as any).user?.tenantId;

  if (!tenantId) {
    return res.status(401).send("Unauthorized");
  }

  const result = await channelService.findChannelByIdGlobally(channelId);
  if (!result.success) {
    logger.warn(`[ChannelWebhook] Received webhook for unknown channel: ${channelId}`);
    // Return 200 to prevent external services from retrying
    return res.status(200).send("OK (Unknown Channel)");
  }

  logger.info(
    `[ChannelWebhook] Webhook acknowledged for channel ${channelId} (native plugin handles delivery)`,
  );
  res.status(200).send("OK");
});

/**
 * Legacy support for Telegram bot tokens
 */
router.post("/telegram/:token", async (req: Request, res: Response) => {
  const token = req.params.token as string;
  logger.info(
    `[TelegramWebhook] Webhook acknowledged for token ${token} (native plugin handles delivery)`,
  );
  res.status(200).send("OK");
});

export default router;
