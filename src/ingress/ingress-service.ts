import { proto } from 'baileys';
import logger from '@/utils/logger.js';
import { webhookService } from '../services/webhookService.js';
import channelService from '../services/ChannelService.js';
import agentService from '../services/AgentService.js';
import { createChannelContext } from '@/utils/createChannelContext.js';
import { GlobalContext } from '@/types/index.js';
import { tenantConfigService } from '../services/tenantConfigService.js';
import analyticsService from '../services/analytics.js';
import { Agent } from '@/types/contracts.js';
import { flowService } from '../services/flowService.js';
import { flowEngine } from '../services/flowEngine.js';
import { automationService } from '../services/automationService.js';
import { CommonMessage } from '@/types/omnichannel.js';
import { deduplicationService } from '../services/deduplicationService.js';
import { MessageNormalizer } from '@/utils/messageNormalizer.js';
// DeXMart Fusion (Phase 4): OpenClaw's embedded agent runner replaces GeminiAI
import { runEmbeddedPiAgent } from '@/agents/pi-embedded-runner/run.js';
import { loadConfigForUser, UserConfigFirestore } from '@/config/user-config.js';
import { trackUsage } from '@/billing/usage-tracker.js';
import type { firestore } from 'firebase-admin';
import { z } from 'zod';

const ConfigModelGateSchema = z.object({
  agents: z.object({
    defaults: z.object({
      models: z.record(z.string(), z.unknown()).optional()
    }).optional()
  }).optional()
}).passthrough();

/**
 * Ingress Service
 *
 * Centralized entry point for all incoming messages from all channels.
 * Handles the Priority-Based Routing:
 * 1. Automations (Trigger: message_received)
 * 2. Visual Flows (FlowEngine)
 * 3. AI Agents (GeminiAI)
 * 4. Webhook Forwarding (Default)
 */
export class IngressService {
  private static instance: IngressService;

  private constructor() { }

  public static getInstance(): IngressService {
    if (!IngressService.instance) {
      IngressService.instance = new IngressService();
    }
    return IngressService.instance;
  }

  /**
   * Process an incoming message from any channel using the CommonMessage format.
   * This is the preferred way to handle messages in the 2026 Omnichannel architecture.
   */
  async handleCommonMessage(tenantId: string, channelId: string, message: CommonMessage, context: GlobalContext, fullPath?: string): Promise<void> {
    try {
      // MASTERMIND Resilience: Deduplication & Clock Skew (Scenario 6)
      if (!deduplicationService.shouldProcess(message.id, message.timestamp)) {
        return;
      }

      logger.info(`[Ingress] Common message from ${message.platform} (${channelId}) for tenant ${tenantId}`);

      let activeAgent: Agent | null = null;

      // 1. Resolve Agent from Path
      if (fullPath && fullPath.includes('/agents/')) {
        const parts = fullPath.split('/');
        const agentId = parts[3];
        const agentResult = await agentService.getAgent(tenantId, agentId);
        activeAgent = agentResult.success ? agentResult.data : null;
      }

      // 2. Prepare AI Context (Decoupled from platform-specifics)
      const channelResult = await channelService.getChannel(tenantId, channelId, activeAgent?.id);
      if (!channelResult.success) {
          logger.warn(`[Ingress] Channel ${channelId} not found in Firestore, using mock instance.`);
      }
      
      const channelInstance = channelResult.success ? channelResult.data : { tenantId, channelId } as any;
      const aiCtx = await createChannelContext(channelInstance, message, context);

      const isAiEnabled = await tenantConfigService.isFeatureEnabled(tenantId, 'aiEnabled');

      // --- AUTOMATION TRIGGER (Priority 0) ---
      const automationsResult = await automationService.listAutomations(tenantId);
      if (automationsResult.success) {
        const activeAutos = automationsResult.data.filter(a => a.isActive && a.trigger.type === 'message_received');
        for (const auto of activeAutos) {
          const keyword = auto.trigger.config?.keyword;
          const text = aiCtx.body || '';
          if (!keyword || text.toLowerCase().includes(keyword.toLowerCase())) {
            logger.info(`[Ingress] Triggering Automation: ${auto.name} (${auto.id})`);
            
            // MASTERMIND Fix: Execute Automation Actions
            await automationService.executeAutomation(tenantId, auto.id, aiCtx);
            
            analyticsService.trackMessage(tenantId, 'received');
            return; // Exit early as automation handled it
          }
        }
      }

      // --- FLOW MODE (Priority 1) ---
      const flowsResult = await flowService.listActiveFlows(tenantId);
      if (flowsResult.success && flowsResult.data.length > 0) {
        for (const flow of flowsResult.data) {
          const executed = await flowEngine.executeFlow(flow, aiCtx);
          if (executed) {
            logger.info(`[Ingress] Message handled by Visual Flow: ${flow.id}`);
            await webhookService.dispatch(tenantId, 'flow.executed', {
              channelId,
              flowId: flow.id,
              sender: aiCtx.sender?.jid,
              timestamp: Date.now()
            });
            analyticsService.trackMessage(tenantId, 'received');
            return; // Exit early
          }
        }
      }

      // --- AGENT MODE (Priority 2) ---
      // DeXMart Fusion (Phase 4): replaced context.unifiedAI.processMessage()
      // (GeminiAI — deleted in Phase 1) with OpenClaw's runEmbeddedPiAgent().
      // This is the core fusion wiring: DeXMart's inbound pipeline feeds
      // directly into OpenClaw's agent runtime.
      if (activeAgent && activeAgent.id !== 'system_default' && isAiEnabled) {
        logger.info(`[Ingress] Routing ${message.platform} message to OpenClaw agent: ${activeAgent.name}`);
        // Inject the path into metadata for Agent hierarchy awareness
        if (!message.metadata) message.metadata = {};
        message.metadata.fullPath = fullPath;

        // Resolve per-user config (Phase 2 FR-1: Firestore + Redis cache)
        // Falls back to base loadConfig() if no user config stored yet.
        const { db } = await import('@/lib/firebase.js');
        const { loadConfig } = await import('@/config/io.js');
        const rawConfig = ConfigModelGateSchema.parse(await loadConfigForUser(tenantId, null, db as unknown as UserConfigFirestore, loadConfig)) as unknown as import('@/config/config.js').OpenClawConfig;

        // Phase 3.2: intersect cfg.agents.defaults.models with the user's plan capabilities.
        const { createAuthGuard } = await import('@/tenancy/tenant-context.js');
        const { UserContextResolverImpl } = await import('@/tenancy/context-resolver.js');
        const { admin } = await import('@/lib/firebase.js');
        const { Redis } = await import('ioredis');
        const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

        let userConfig = rawConfig;
        try {
          const resolver = new UserContextResolverImpl(db as unknown as firestore.Firestore, admin, redisClient);
          const ctx = await resolver.fromUserId(tenantId);
          const guard = createAuthGuard(ctx);
          const configuredModels = Object.keys(rawConfig.agents?.defaults?.models ?? {});
          const allowedModels = configuredModels.filter(m => guard.canUseModel(m));
          if (allowedModels.length < configuredModels.length) {
            // Build a restricted config with only plan-allowed models
            const restrictedModels = allowedModels.reduce<Record<string, unknown>>((acc, key) => {
              acc[key] = (rawConfig.agents!.defaults!.models as Record<string, unknown>)[key];
              return acc;
            }, {});
            userConfig = ConfigModelGateSchema.parse({
              ...rawConfig,
              agents: {
                ...rawConfig.agents,
                defaults: {
                  ...rawConfig.agents?.defaults,
                  models: restrictedModels,
                },
              },
            }) as typeof rawConfig;
          }
        } catch (err: unknown) {
          // Context resolution failure is non-fatal — but log it to prevent silent billing bypass
          logger.warn(`[Ingress] Context resolution failed for tenant ${tenantId}, using full config fallback.`, err);
          userConfig = rawConfig;
        }

        // Build session ID: stable per user×agent×channel for conversation continuity
        const sessionId = `${tenantId}:${activeAgent.id}:${channelId}`;
        const prompt = message.content?.text ?? '';

        // Build per-user HybridMemoryAdapter (Phase 3.3)
        // Lazy import to avoid circular dep at module init
        const { HybridMemoryAdapter } = await import('@/memory/hybrid-adapter.js');
        const { getMemorySearchManager } = await import('@/memory/index.js');
        const baseMemoryResult = await getMemorySearchManager({ cfg: userConfig as any, agentId: activeAgent.id });
        // embedAndInsert: sync a new text into the inner manager's vector index
        // pruneToLimit: remove oldest entries beyond the cap (5-10 rule)
        // The inner MemorySearchManager exposes sync() for batch operations;
        // individual embed+insert is managed internally by the manager.
        // We delegate both operations to the manager's sync() as a PoC —
        // the HybridMemoryAdapter handles Firestore sync on top.
        const innerManager = baseMemoryResult.manager;
        const hybridMemory = innerManager
          ? new HybridMemoryAdapter(
              tenantId,
              innerManager,
              db as unknown as firestore.Firestore,
              async (_text: string, _metadata?: Record<string, unknown>) => {
                // embed+insert: the inner manager handles this via its own indexing pipeline
                // called via sync() after the Firestore write completes
                await innerManager.sync?.({ reason: 'hybrid-remember' });
              },
              async (_limit: number) => {
                // prune: the inner manager enforces its own retention policy via sync
                await innerManager.sync?.({ reason: 'hybrid-prune', force: false });
              },
            )
          : undefined;

        await runEmbeddedPiAgent({
          sessionId,
          sessionKey: sessionId,
          agentId: activeAgent.id,
          messageChannel: message.platform,
          senderId: message.from,
          prompt,
          config: userConfig,
          memoryManager: hybridMemory,
          // Reply target: the channel + sender (DeXMart will pick up the reply
          // via the agent's outbound pipeline → WhatsappAdapter._directSendMessage)
          messageTo: message.from,
          sessionFile: '', // Defaults or paths can be handled inside pi-embedded-runner
          workspaceDir: '', 
          timeoutMs: 30000,
          runId: `run-${Date.now()}`
        });

        // Track usage (Phase 2 Phase 3.1: batched Firestore flush)
        trackUsage(tenantId, 'messages', 1);
      } else {
        logger.info(`[Ingress] Webhook forwarding for ${message.platform} message.`);
        await webhookService.dispatch(tenantId, 'message.received', message);
      }

      analyticsService.trackMessage(tenantId, 'received');
    } catch (error: unknown) {
      logger.error(`IngressService.handleCommonMessage error:`, error);
    }
  }

  /**
   * Process an incoming message from any channel.
   * @param fullPath Optional full Firestore path for path-aware routing (tenants/T/agents/A/channels/C)
   * @deprecated Use handleCommonMessage for new platform integrations.
   */
  async handleMessage(tenantId: string, channelId: string, message: proto.IWebMessageInfo, context: GlobalContext, fullPath?: string): Promise<void> {
    try {
      // MASTERMIND Resilience: Deduplication & Clock Skew (Scenario 6)
      const msgId = MessageNormalizer.getId(message);
      const msgTimestamp = MessageNormalizer.getTimestamp(message);
      if (!deduplicationService.shouldProcess(msgId, msgTimestamp)) {
        return;
      }

      logger.info(`Processing message for channel ${channelId} (Tenant: ${tenantId}, Path: ${fullPath || 'flat'})`);

      let activeAgent: Agent | null = null;
      let channelInstance: any = undefined;

      // 1. Resolve Agent (Architecture Alignment)
      if (fullPath && fullPath.includes('/agents/')) {
        // Path-based resolution: tenants/{tenantId}/agents/{agentId}/channels/{channelId}
        const parts = fullPath.split('/');
        const agentId = parts[3];
        const agentResult = await agentService.getAgent(tenantId, agentId);
        activeAgent = agentResult.success ? agentResult.data : null;
      } else {
        // Fallback: Resolve via Channel mapping (Surgical Migration Safety)
        const channelResult = await channelService.getChannel(tenantId, channelId); // Defaults to system_default agent if not nested
        if (channelResult.success && channelResult.data.assignedAgentId) {
          const agentResult = await agentService.getAgent(tenantId, channelResult.data.assignedAgentId);
          activeAgent = agentResult.success ? agentResult.data : null;
        }
        if (channelResult.success) {
          channelInstance = channelResult.data;
        }
      }

      // 2. Prepare AI Context
      channelInstance = channelInstance || { tenantId, channelId };
      const aiCtx = await createChannelContext(channelInstance as any, message, context);

      // --- AUTOMATION TRIGGER (Priority 0) ---
      // Check for automations that trigger on message_received
      const automationsResult = await automationService.listAutomations(tenantId);
      if (automationsResult.success) {
        const activeAutos = automationsResult.data.filter(a => a.isActive && a.trigger.type === 'message_received');
        for (const auto of activeAutos) {
          const keyword = auto.trigger.config?.keyword;
          const text = aiCtx.message?.conversation || aiCtx.message?.extendedTextMessage?.text || '';
          if (!keyword || text.toLowerCase().includes(keyword.toLowerCase())) {
            logger.info(`Triggering Automation: ${auto.name} (${auto.id})`);
            // Automation execution would involve iterating over actions
          }
        }
      }

      // --- FLOW MODE (Priority 1) ---
      // Check for active visual flows before anything else
      const flowsResult = await flowService.listActiveFlows(tenantId);
      if (flowsResult.success && flowsResult.data.length > 0) {
        for (const flow of flowsResult.data) {
          const executed = await flowEngine.executeFlow(flow, aiCtx);
          if (executed) {
            logger.info(`Message handled by Visual Flow: ${flow.id}`);
            // Webhook Dispatch for flow execution
            await webhookService.dispatch(tenantId, 'flow.executed', {
              channelId,
              flowId: flow.id,
              sender: aiCtx.sender?.jid,
              timestamp: Date.now()
            });
            analyticsService.trackMessage(tenantId, 'received');
            return; // Exit early
          }
        }
      }

      if (activeAgent && activeAgent.id !== 'system_default') {
        // --- AGENT MODE (Priority 2) ---
        logger.info(`Routing to Agent: ${activeAgent.name} (${activeAgent.id})`);

        // Enforce Feature Flag: Check if AI is enabled for this tenant
        const isAiEnabled = await tenantConfigService.isFeatureEnabled(tenantId, 'aiEnabled');
        if (!isAiEnabled) {
          logger.warn(`AI processing skipped for tenant ${tenantId}: AI disabled.`);
        }
        await this.dispatchWebhook(tenantId, channelId, message, aiCtx);
      } else {
        // --- WEBHOOK ONLY MODE (Includes system_default) ---
        logger.info(`No AI Agent assigned (or system_default). Forwarding to Webhook.`);
        await this.dispatchWebhook(tenantId, channelId, message, aiCtx);
      }

      // 3. Post-processing
      analyticsService.trackMessage(tenantId, 'received');

    } catch (error: unknown) {
      logger.error(`IngressService error for channel ${channelId}:`, error);
    }
  }

  private async dispatchWebhook(tenantId: string, channelId: string, message: proto.IWebMessageInfo, aiCtx: any) {
    const text = aiCtx.message?.conversation || aiCtx.message?.extendedTextMessage?.text || '';

    await webhookService.dispatch(tenantId, 'message.received', {
      channelId,
      sender: aiCtx.sender.jid,
      message: text,
      timestamp: Date.now(),
      raw: message
    });
  }
}

export const ingressService = IngressService.getInstance();
export default ingressService;
