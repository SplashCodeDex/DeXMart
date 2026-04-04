import logger from '../utils/logger.js';
import { FlowData } from './flowService.js';
import { cacheService } from './cache.js';
import { TemplateService } from './templateService.js';
import { db } from '../lib/firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { Result } from '../types/result.js';

interface FlowState {
  flowId: string;
  currentNodeId: string;
  expiresAt: number;
}

/**
 * FlowEngine - 2026 Mastermind Edition
 * Interprets and executes visual flows defined in the FlowBuilder.
 */
export class FlowEngine {
  private static instance: FlowEngine;

  private constructor() { }

  public static getInstance(): FlowEngine {
    if (!FlowEngine.instance) {
      FlowEngine.instance = new FlowEngine();
    }
    return FlowEngine.instance;
  }

  /**
   * Execute a flow based on the current context
   * @returns true if a flow was triggered or resumed, false otherwise
   */
  async executeFlow(flow: FlowData, context: any): Promise<boolean> {
    try {
      const userId = context.sender?.jid;
      const stateKey = `flow:state:${userId}`;
      const stateResult = await cacheService.get<FlowState>(stateKey);

      // 1. Check for active state (Resumption)
      if (stateResult.success && stateResult.data && stateResult.data.flowId === flow.id) {
        logger.info(`Resuming flow '${flow.name}' for user ${userId} from node ${stateResult.data.currentNodeId}`);
        const currentNodeId = stateResult.data.currentNodeId;

        // Clear state before resuming (if wait_for_input is reached again, it will be set again)
        await cacheService.delete(stateKey);

        await this.executeNodePath(currentNodeId, flow, context);
        return true;
      }

      // 2. Find matching triggers (New Execution)
      const triggers = flow.nodes.filter(n => n.type === 'trigger');
      const matchingTrigger = triggers.find(t => this.isTriggerMatch(t, context));

      if (!matchingTrigger) {
        return false;
      }

      logger.info(`Flow '${flow.name}' (${flow.id}) triggered for user ${userId}`);

      // 3. Follow the path from the trigger
      await this.executeNodePath(matchingTrigger.id, flow, context);

      return true;
    } catch (error: any) {
      logger.error(`FlowEngine.executeFlow error [Flow: ${flow.id}]:`, error);
      return false;
    }
  }

  private isTriggerMatch(node: any, context: any): boolean {
    const { data } = node;
    const messageText = (context.body || '').toLowerCase().trim();

    // Keyword match (case-insensitive)
    if (data.keyword) {
      const keyword = data.keyword.toLowerCase().trim();
      return messageText === keyword;
    }

    // Default to false if no criteria met (or true if 'Match ANY' logic implemented)
    return false;
  }

  private async executeNodePath(currentNodeId: string, flow: FlowData, context: any) {
    const currentNode = flow.nodes.find(n => n.id === currentNodeId);
    let outboundEdges = flow.edges.filter(e => e.source === currentNodeId);

    // If current node is logic, filter edges based on condition result
    if (currentNode?.type === 'logic') {
      const result = await this.evaluateCondition(currentNode, context);
      const targetLabel = result ? 'true' : 'false';
      outboundEdges = outboundEdges.filter(e => e.label === targetLabel);
    }

    // If current node is AI Router, filter edges based on semantic routing
    if (currentNode?.type === 'ai_router') {
      const targetLabel = await this.evaluateAIRouting(currentNode, context);
      if (targetLabel) {
        outboundEdges = outboundEdges.filter(e => e.label === targetLabel);
      } else {
        outboundEdges = []; // No match
      }
    }

    for (const edge of outboundEdges) {
      const nextNode = flow.nodes.find(n => n.id === edge.target);
      if (!nextNode) continue;

      await this.executeNode(nextNode, flow, context);
    }
  }

  private async executeNode(node: any, flow: FlowData, context: any) {
    logger.debug(`Executing node ${node.id} [Type: ${node.type}]`);

    switch (node.type) {
      case 'action':
        await this.executeActionNode(node, context);
        break;

      case 'logic':
        // logic nodes logic handled in executeNodePath for branching
        break;

      case 'ai':
        await this.executeAINode(node, context);
        break;

      case 'ai_router':
        // logic handled in executeNodePath
        break;

      case 'skill':
        await this.executeSkillNode(node, context);
        break;

      case 'wait_for_input':
        await this.handleWaitNode(node, flow, context);
        return; // Stop execution until next message
    }

    // Continue to next nodes in path (if not a logic node or wait node)
    if (node.type !== 'logic' && node.type !== 'wait_for_input') {
      await this.executeNodePath(node.id, flow, context);
    } else if (node.type === 'logic') {
      await this.executeNodePath(node.id, flow, context);
    }
  }

  private async executeSkillNode(node: any, context: any) {
    const { data } = node;
    const { unifiedAI, channel, tenantId } = context;

    if (!unifiedAI) {
      logger.warn('FlowEngine: unifiedAI not found in context, skipping skill node');
      return;
    }

    try {
      const skillName = data.skillName;
      if (!skillName) throw new Error('Skill name not specified in node');

      logger.info(`Executing skill: ${skillName} for tenant ${tenantId}`);

      // Track execution for metrics/monetization
      await this.trackNodeExecution(tenantId, node.id, 'skill', { skillName });

      // MASTERMIND Resilience: Skill Execution Timeout (Scenario 42)
      const TIMEOUT_MS = 120 * 1000;
      const timeoutPromise = new Promise<Result<any>>((_, reject) => 
        setTimeout(() => reject(new Error(`SKILL_TIMEOUT: ${skillName} exceeded ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
      );

      // Execute tool via UnifiedAI Registry with Timeout Race
      const result = await Promise.race([
        unifiedAI.executeTool(skillName, data.params || {}, context),
        timeoutPromise
      ]);

      if (result.success && result.message) {
        await context.reply(result.message);
      } else if (!result.success) {
        logger.error(`Skill execution failed: ${skillName}`, result.error);
        await context.reply(`⚠️ Failed to execute ${skillName}.`);
      }
    } catch (error: any) {
      logger.error('FlowEngine.executeSkillNode error:', error);
      if (error?.message?.includes('SKILL_TIMEOUT')) {
        await context.reply(`⚠️ Skill execution timed out. Please try again later.`);
      }
    }
  }

  private async trackNodeExecution(tenantId: string, nodeId: string, type: string, metadata: any = {}) {
    try {
      logger.debug(`[METRIC] Flow Node Executed: ${nodeId} [Type: ${type}] Tenant: ${tenantId}`, metadata);

      // Persist to Firestore for monetization/usage tracking
      await db.collection('tenants')
        .doc(tenantId)
        .collection('events')
        .add({
          type: 'node_execution',
          nodeType: type,
          nodeId,
          metadata,
          timestamp: Timestamp.now()
        });
    } catch (error) {
      logger.error(`[FlowEngine] Failed to track node execution for ${tenantId}:`, error);
    }
  }

  private async handleWaitNode(node: any, flow: FlowData, context: any) {
    const userId = context.sender?.jid;
    const stateKey = `flow:state:${userId}`;
    const state: FlowState = {
      flowId: flow.id,
      currentNodeId: node.id,
      expiresAt: Date.now() + (1000 * 60 * 15) // 15 minute timeout
    };

    await cacheService.set(stateKey, state, 60 * 15);
    logger.debug(`Flow state saved for user ${userId} at node ${node.id}`);
  }

  private async evaluateCondition(node: any, context: any): Promise<boolean> {
    const { data } = node;

    if (data.condition === 'is_premium') {
      const plan = context.tenant?.plan || 'starter';
      return plan === 'pro' || plan === 'enterprise';
    }

    return false;
  }

  private async evaluateAIRouting(node: any, context: any): Promise<string | null> {
    const { data } = node;
    const { unifiedAI } = context;
    const userInput = context.body || '';

    if (!unifiedAI || !data.options) {
      return null;
    }

    try {
      const optionsStr = data.options.map((o: any) => `- ${o.label}: ${o.description}`).join('\n');
      const prompt = `
Analyze the following user input and decide which category it belongs to.
Options:
${optionsStr}

User Input: "${userInput}"

Return ONLY the label of the best matching category (e.g., "${data.options[0]?.label}"). If no category matches well, return "none".
`;

      const response = await (unifiedAI.gemini as any).getChatCompletion(prompt);
      const cleanedResponse = response.trim().toLowerCase();

      // Find exact match in options
      const match = data.options.find((o: any) => o.label.toLowerCase() === cleanedResponse);
      return match ? match.label : null;

    } catch (error: any) {
      logger.error('FlowEngine.evaluateAIRouting error:', error);
      return null;
    }
  }

  private async executeActionNode(node: any, context: any) {
    const { data } = node;
    const tenantId = context.tenantId || context.channel?.tenantId;

    if (data.templateId && tenantId) {
      const templateService = TemplateService.getInstance();
      const templateResult = await templateService.getTemplate(tenantId, data.templateId);

      if (templateResult.success && templateResult.data) {
        await context.reply(templateResult.data.content);
        return;
      }
    }

    if (data.message) {
      await context.reply(data.message);
    }
  }

  private async executeAINode(node: any, context: any) {
    const { data } = node;
    const { unifiedAI, channel, tenantId } = context;

    if (!unifiedAI) {
      logger.warn('FlowEngine: unifiedAI not found in context, skipping AI node');
      return;
    }

    try {
      // Forward to Gemini AI
      const commonMsg = {
        id: context.id,
        platform: context.platform || 'whatsapp',
        from: context.sender?.jid,
        to: channel?.channelId,
        content: { text: context.body || '' },
        timestamp: Date.now()
      };

      const result = await unifiedAI.processOmnichannelMessage(
        tenantId || channel?.tenantId,
        channel?.channelId,
        commonMsg
      );

      if (result.success && result.data?.content?.text) {
        await context.reply(result.data.content.text);
      }
    } catch (error: any) {
      logger.error('FlowEngine.executeAINode error:', error);
    }
  }
}

export const flowEngine = FlowEngine.getInstance();
export default flowEngine;
