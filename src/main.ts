// MUST be first — populates process.env before any other module evaluates
import "./initEnv.js";
import logger from "./utils/logger.js";
logger.info(">>> [MASTERMIND] ABSOLUTE START OF MAIN.TS");
import { startAgentEventListener, stopAgentEventListener } from "./analytics/event-listener.js";
import { startUsageFlushScheduler } from "./billing/usage-tracker.js";
import { getCampaignWorker } from "./jobs/campaignWorker.js"; // Start Campaign Worker
import JobRegistry from "./jobs/index.js";
import initializeContext from "./lib/context.js";
import MultiTenantApp from "./server/multiTenantApp.js";
import { channelService } from "./services/ChannelService.js";
import { ConfigService } from "./services/ConfigService.js";
import { jobQueueService } from "./services/jobQueue.js";
import { validateEnvironmentOrThrow } from "./utils/validateEnv.js";

/**
 * Main entry point for DeXMart
 */
async function main() {
  logger.info(">>> [MASTERMIND] Starting main()");
  try {
    logger.info("🚀 Starting DeXMart...");

    // Validate environment variables before proceeding
    logger.info(">>> [MASTERMIND] Validating environment variables...");
    validateEnvironmentOrThrow();
    logger.info(">>> [MASTERMIND] Environment validation passed.");

    // Initialize ConfigService first
    const configService = ConfigService.getInstance();

    // 1. Initialize Context (without Prisma)
    const context = await initializeContext();
    logger.info(">>> [MASTERMIND] Global Context initialized.");

    // 2. Initialize Background Workers
    logger.info(">>> [MASTERMIND] Initializing Job Registry...");
    const jobRegistry = new JobRegistry();
    await jobQueueService.initialize();
    await jobRegistry.initialize(jobQueueService);

    logger.info(">>> [MASTERMIND] Initializing Campaign Worker...");
    getCampaignWorker();
    logger.info(">>> [MASTERMIND] Campaign Worker call finished.");

    // 3. Start Multi-tenant Server
    if (configService.get("system.useServer")) {
      logger.info(">>> [MASTERMIND] USE_SERVER is true. Initializing MultiTenantApp...");
      const app = new MultiTenantApp();
      await app.initialize();
      logger.info(">>> [MASTERMIND] MultiTenantApp initialized.");
      await app.start();
      logger.info(">>> [MASTERMIND] MultiTenantApp started.");

      // Start Auto-Healing Watchdog (ChannelWatchdog dissolved into ChannelService)
      channelService.startWatchdog(60_000); // Check every 60s
    } else {
      logger.info("🔕 Server disabled in configuration");
    }

    // Start Phase 2 usage flush scheduler (batched Firestore writes every 10s)
    const { db } = await import("./lib/firebase.js");
    startUsageFlushScheduler(db as any);

    // Wire agent event listener (infra/agent-events → MastermindStream → Socket.IO)
    startAgentEventListener();

    logger.info("✨ DeXMart is ready!");
  } catch (error: any) {
    logger.error("💥 Fatal error during startup:", error);
    process.exit(1);
  }
}

main();
