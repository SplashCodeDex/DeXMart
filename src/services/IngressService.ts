import { proto } from 'baileys';
import logger from '@/utils/logger.js';
import { webhookService } from './webhookService.js';
import { channelService } from './ChannelService.js';
import { agentService } from './AgentService.js';
import { createChannelContext } from '../utils/createChannelContext.js';
import { GlobalContext } from '../types/index.js';
import { tenantConfigService } from './tenantConfigService.js';
import analyticsService from './analytics.js';
import { Agent } from '../types/contracts.js';
import { flowService } from './flowService.js';
import { flowEngine } from './flowEngine.js';
import { automationService } from './automationService.js';
import { CommonMessage } from '../types/omnichannel.js';
import { deduplicationService } from './deduplicationService.js';
import { MessageNormalizer } from '../utils/messageNormalizer.js';

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
      if (activeAgent && activeAgent.id !== 'system_default' && isAiEnabled && context.unifiedAI) {
        logger.info(`[Ingress] Routing ${message.platform} message to Agent: ${activeAgent.name}`);
        // Inject the path into metadata for Agent hierarchy awareness
        if (!message.metadata) message.metadata = {};
        message.metadata.fullPath = fullPath;

        await (context.unifiedAI as any).processMessage(channelInstance, aiCtx);
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
      }

      // 2. Prepare AI Context
      const aiCtx = await createChannelContext({ tenantId, channelId: channelId } as any, message, context);

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
        if (isAiEnabled && context.unifiedAI) {
          await context.unifiedAI.processMessage({ tenantId, channelId: channelId } as any, aiCtx);
        } else {
          logger.warn(`AI processing skipped for tenant ${tenantId}: AI disabled or service missing.`);
          await this.dispatchWebhook(tenantId, channelId, message, aiCtx);
        }
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
