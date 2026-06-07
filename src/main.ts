// Force standard HTTP agent for Google Auth (Node 24 compatibility)
process.env.GCP_DISABLE_FETCH = "true";

// MUST be first — populates process.env before any other module evaluates
import "./initEnv.js";

/**
 * Main entry point for DeXMart
 */
async function main() {
  // Use dynamic imports to prevent top-level imports from hijacking singletons
  const { default: logger } = await import("./utils/logger.js");
  logger.info(">>> [MASTERMIND] ABSOLUTE START OF MAIN.TS");
  logger.info(">>> [MASTERMIND] Starting main()");

  const shutdownRegistry: (() => Promise<void> | void)[] = [];

  process.on('SIGTERM', async () => {
    logger.info(">>> [MASTERMIND] Initiating graceful shutdown...");
    for (const task of shutdownRegistry.reverse()) {
      try { await task(); } catch (e) { logger.error(e); }
    }
    process.exit(0);
  });

  try {
    logger.info("🚀 Starting DeXMart...");

    // Validate environment variables before proceeding
    logger.info(">>> [MASTERMIND] Validating environment variables...");
    const { validateEnvironmentOrThrow } = await import("./utils/validateEnv.js");
    validateEnvironmentOrThrow();
    logger.info(">>> [MASTERMIND] Environment validation passed.");

    // 1. Initialize DeXMart Context first
    const { default: initializeContext } = await import("./lib/context.js");
    const context = await initializeContext();
    logger.info(">>> [MASTERMIND] Global Context initialized.");

    // 2. Set Gateway Environment Overrides
    process.env.OPENCLAW_SKIP_CHANNELS = "1"; // De-conflict watchdogs

    // Set Credential Precedence
    context.config.set("agents.defaults.credentialPrecedence", "env-first");

    // Initialize Background Workers
    logger.info(">>> [MASTERMIND] Initializing Job Registry...");
    const { jobQueueService } = await import("./services/jobQueue.js");
    const { default: JobRegistry } = await import("./jobs/index.js");

    const jobRegistry = new JobRegistry();
    await jobQueueService.initialize();
    await jobRegistry.initialize(jobQueueService);

    logger.info(">>> [MASTERMIND] Initializing Campaign Worker...");
    const { getCampaignWorker } = await import("./jobs/campaignWorker.js");
    const campaignWorker = getCampaignWorker();
    shutdownRegistry.push(async () => {
      logger.info(">>> [MASTERMIND] Stopping Campaign Worker...");
      await campaignWorker.close();
    });
    logger.info(">>> [MASTERMIND] Campaign Worker call finished.");

    // 3. Start Multi-tenant Server
    if (context.config.get("system.useServer")) {
      logger.info(">>> [MASTERMIND] USE_SERVER is true. Initializing MultiTenantApp...");
      const { default: MultiTenantApp } = await import("./server/multiTenantApp.js");
      const app = new MultiTenantApp();
      await app.initialize();
      logger.info(">>> [MASTERMIND] MultiTenantApp initialized.");
      await app.start();
      logger.info(">>> [MASTERMIND] MultiTenantApp started.");

      shutdownRegistry.push(async () => {
        logger.info(">>> [MASTERMIND] Stopping MultiTenantApp...");
        await app.stop();
      });

      // Start Auto-Healing Watchdog (ChannelWatchdog dissolved into ChannelService)
      const { channelService } = await import("./services/ChannelService.js");
      channelService.startWatchdog(60_000); // Check every 60s

      // 4. Start Gateway Server
      logger.info(">>> [MASTERMIND] Starting Gateway Server...");
      const { startGatewayServer } = await import("./gateway/server.js");
      const gatewayServer = await startGatewayServer({
        port: 19001,
        dev: true, // as specified in the plan
      });
      shutdownRegistry.push(async () => {
        logger.info(">>> [MASTERMIND] Stopping Gateway Server...");
        await gatewayServer.close();
      });
    } else {
      logger.info("🔕 Server disabled in configuration");
    }

    // Start Phase 2 usage flush scheduler (batched Firestore writes every 10s)
    const { db } = await import("./lib/firebase.js");
    const { startUsageFlushScheduler } = await import("./billing/usage-tracker.js");
    startUsageFlushScheduler(db as any);

    // Wire agent event listener (infra/agent-events → MastermindStream → Socket.IO)
    const { startAgentEventListener, stopAgentEventListener } = await import("./analytics/event-listener.js");
    startAgentEventListener();
    shutdownRegistry.push(() => {
        logger.info(">>> [MASTERMIND] Stopping Agent Event Listener...");
        stopAgentEventListener();
    });

    logger.info("✨ DeXMart is ready!");
  } catch (error: any) {
    const { default: logger } = await import("./utils/logger.js");
    logger.error("💥 Fatal error during startup:", error);
    process.exit(1);
  }
}

main();
