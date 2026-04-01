import { memoryService } from './memoryService.js';
import { firebaseService } from './FirebaseService.js';
import crypto from 'crypto';
import GeminiService from './gemini.js';
import logger from '../utils/logger.js';
import { EventEmitter } from 'events';
import { ActiveChannel, GlobalContext, MessageContext, Result, Agent } from '../types/index.js';
import { CommonMessage } from '../types/omnichannel.js';
import { databaseService } from './database.js';
import { cacheService } from './cache.js';
import { toolRegistry } from './toolRegistry.js';
import { skillsManager } from './skillsManager.js';
import { multiTenantService } from './multiTenantService.js';
import { toolPersistenceService } from './toolPersistenceService.js';
import { socketService } from './socketService.js';
import { mastermindStreamService } from './MastermindStreamService.js';
import { aiAnalyticsService } from './aiAnalytics.js';
import { DeliberationService } from '../utils/deliberation.js';
import { systemAuthorityService, PlanTier } from './SystemAuthorityService.js';
import tools from '../tools/exports.js';
import * as formatter from '../utils/formatters.js';
import state from '../utils/state.js';
import { groupService } from './groupService.js';
import { channelService } from './ChannelService.js';
import { agentService } from './AgentService.js';
import { ingressService } from './IngressService.js';
import { userService } from './userService.js';
import { tenantConfigService } from './tenantConfigService.js';
import { configService } from './ConfigService.js';
import { CommandSystem } from './commandSystem.js';

interface AIDecisionEngine {
  confidenceThreshold: number;
  contextWindowSize: number;
  maxToolCalls: number;
  learningEnabled: boolean;
}

interface AIAction {
  type: string;
  command?: string;
  parameters: Record<string, any>;
  confidence: number;
  reasoning: string;
  originalIntent?: any;
}

interface AIAnalysis {
  intents: any[];
  confidence: number;
  actions: AIAction[];
  reasoning: string;
  toolsNeeded: any[];
  responseType: string;
}

/**
 * Gemini AI - Next Generation Intelligence System
 * Handles natural conversation, context understanding, and intelligent tool usage
 * 2026 Mastermind Edition - Memoized (Rule 5)
 */
export class GeminiAI extends EventEmitter {
  private channel: ActiveChannel | null = null;
  private context: GlobalContext;
  private gemini: GeminiService;
  private decisionEngine: AIDecisionEngine;

  constructor(context: GlobalContext) {

    super();
    this.context = context;
    this.gemini = new GeminiService();

    this.decisionEngine = {
      confidenceThreshold: 0.7,
      contextWindowSize: 20,
      maxToolCalls: 5,
      learningEnabled: true
    };

    logger.info('Gemini AI initialized with Rule 5 Memoization and Unified Tool Registry');
  }

  /**
   * Main message processing - handles ANY message intelligently
   */
  async processMessage(channel: ActiveChannel, ctx: MessageContext): Promise<Result<void>> {
    try {
      const commonMsg: CommonMessage = {
        id: ctx.id,
        platform: 'whatsapp',
        from: ctx.sender.jid,
        to: channel.channelId,
        content: {
          text: ctx.body || ''
        },
        timestamp: Date.now(),
        metadata: {
          isGroup: ctx.isGroup(),
          mediaType: this.detectMediaType(ctx),
          simulateTyping: ctx.simulateTyping,
          sendPresenceUpdate: ctx.sendPresenceUpdate
        }
      };

      const result = await this.processOmnichannelMessage(channel.tenantId, channel.channelId, commonMsg);

      if (result.success && result.data && result.data.content.text) {
        await ctx.reply(result.data.content.text);
      }

      // Cleanup presence
      if (ctx.sendPresenceUpdate) {
        await ctx.sendPresenceUpdate('paused');
      }

      return { success: true, data: undefined };

    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Enhanced AI Brain processing error:', err);
      await this.handleFallbackResponse(ctx, err);
      return { success: false, error: err };
    }
  }

  /**
   * Universal message processing engine - platform agnostic (2026 Edition)
   */
  async processOmnichannelMessage(tenantId: string, channelId: string, message: CommonMessage): Promise<Result<CommonMessage>> {
    const startTime = Date.now(); // Track request start time for analytics
    try {
      // 1. Check authority for message processing (Limit Enforcement)
      const auth = await systemAuthorityService.checkAuthority(tenantId, 'send_message');
      if (!auth.allowed) {
        return { 
          success: false, 
          error: new Error(auth.error || 'Monthly message limit reached. Please upgrade your plan.') 
        };
      }

      // Get Agent-specific identity from hierarchy (Refactored Phase 3)
      const { agentService } = await import('./AgentService.js');

      let agent: Agent | null = null;
      let agentId = 'system_default';
      if (message.metadata?.fullPath) {
        const parts = message.metadata.fullPath.split('/');
        agentId = parts[3];
        const agentResult = await agentService.getAgent(tenantId, agentId);
        agent = agentResult.success ? agentResult.data : null;
      }

      // MASTERMIND: Event Stream Start
      mastermindStreamService.start(tenantId, agentId, message.id);
      mastermindStreamService.thought(tenantId, agentId, 'Perceiving incoming message...', 'planning');

      // MASTERMIND: Perception Phase (Reading the message)
      const perceptionDelay = DeliberationService.getPerceptionDelay();
      await DeliberationService.wait(perceptionDelay);

      // 2. Plan & Capability Resolution
      const tenantDoc = await firebaseService.getDoc('tenants', tenantId);
      const tier = ((tenantDoc as any)?.plan || 'starter') as PlanTier;
      const caps = systemAuthorityService.getCapabilities(tier);
      
      // 3. Model Gating: Validate model eligibility for the tenant's tier
      let selectedModel = (agent as any)?.model || 'gemini-1.5-flash';
      if (!caps.models.includes(selectedModel)) {
        logger.warn(`Tenant ${tenantId} [${tier}] attempted to use unauthorized model: ${selectedModel}. Falling back to default.`);
        selectedModel = 'gemini-1.5-flash';
      }

      // Trigger initial presence if available
      if (message.metadata?.sendPresenceUpdate) {
        await message.metadata.sendPresenceUpdate('composing', message.id);
      }

      const userId = message.from;
      const text = message.content.text || '';
      const platform = message.platform;

      // Build context
      const context = await this.buildGenericContext(tenantId, channelId, userId, text, message);

      // 1. Retrieve Historical Context (RAG) - Scoped
      const historyResult = await memoryService.retrieveRelevantContext(userId, text, { platform, chatId: userId });
      let historicalContext = '';
      if (historyResult.success && historyResult.data?.length > 0) {
        historicalContext = "\n[HISTORICAL CONTEXT]:\n" +
          historyResult.data.map(h => `- ${h.content} (on ${new Date(h.timestamp).toLocaleDateString()})`).join("\n");
      }

      // 2. Retrieve Recent Tool Results - Persistence
      const recentTools = await toolPersistenceService.getSessionResults({ tenantId, platform, chatId: userId });
      let toolContext = '';
      if (recentTools.length > 0) {
        toolContext = "\n[RECENT TOOL OUTPUTS]:\n" +
          recentTools.map(t => `- Tool: ${t.tool} | Result: ${typeof t.data === 'string' ? t.data : JSON.stringify(t.data)}`).join("\n");
      }

      const personality = agent?.personality || agent?.soul || 'a professional and helpful assistant';

      const systemPrompt = `You are a high-intelligence AI agent.
Role: ${personality}
Name: ${agent?.name || 'DeXMart AI'}
Context: Omnichannel Mastermind.
Current Time: ${new Date().toLocaleString()}
User: ${JSON.stringify(context.user)}
Platform: ${message.platform}
Plan: ${tier}
${historicalContext}
${toolContext}
Use the tools provided to fulfill user requests accurately. If a tool result is not what was expected, explain and offer alternatives.`;

      // Rule 5+: Semantic Memoization + Tool Loop (Agentic)
      const finalResponse = await this.gemini.getManager().execute(async () => {
        logger.info(`Rule 5+: Performing agentic execution for ${userId} on ${message.platform} [Plan: ${tier}]`);

        // Build history from scoped short-term memory
        const conversationHistory = await this.getScopedConversationMemory(tenantId, platform, userId);
        const messages: any[] = [
          { role: 'system', content: systemPrompt },
          ...conversationHistory.map((m: any) => ([
            { role: 'user', content: m.user },
            { role: 'model', content: m.ai }
          ])).flat(),
          { role: 'user', content: text }
        ];

        let loopCount = 0;
        const maxLoops = this.decisionEngine.maxToolCalls;

        while (loopCount < maxLoops) {
          mastermindStreamService.thought(tenantId, agentId, `Analyzing context and planning next steps (Loop ${loopCount + 1})...`, 'planning');
          socketService.emitActivity(tenantId, channelId, platform, 'agent_thinking', 'Agent is thinking...');
          if (message.metadata?.simulateTyping) {
            await message.metadata.simulateTyping();
          }

          // Thinking Jitter
          const jitter = DeliberationService.getThinkingJitter();
          await DeliberationService.wait(jitter);

          // Select authorized model based on tier
          const preferredModel = caps.models.includes('gemini-2.0-flash-exp') 
            ? 'gemini-2.0-flash-exp' 
            : caps.models[0] || 'gemini-1.5-flash';

          const response = await this.gemini.getChatCompletionWithTools(messages, toolRegistry.getAllTools().map(t => ({
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters
            }
          })), preferredModel);

          if (response.finish_reason === 'tool_calls' && response.message.tool_calls) {
            messages.push({ role: 'assistant', content: response.message.content || '', tool_calls: response.message.tool_calls });

            // 2026 Optimization: Parallel Tool Execution
            const toolResults = await Promise.all(response.message.tool_calls.map(async (toolCall) => {
              try {
                // Tier Gating Check
                const isEligible = await skillsManager.isTenantEligible(tenantId, toolCall.function.name, tier);

                if (!isEligible) {
                  logger.warn(`Tier Gating: Tenant ${tenantId} (${tier}) denied access to tool ${toolCall.function.name}`);
                  mastermindStreamService.error(tenantId, agentId, `Access denied to tool ${toolCall.function.name}`);
                  return {
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: `Error: The tool '${toolCall.function.name}' is only available on higher plans. Please suggest the user to upgrade their subscription to access this feature.`
                  };
                }

                mastermindStreamService.invokeTool(tenantId, agentId, toolCall.function.name, JSON.parse(toolCall.function.arguments));
                socketService.emitActivity(tenantId, channelId, platform, 'tool_start', `Using tool: ${toolCall.function.name}`);
                if (message.metadata?.simulateTyping) {
                  await message.metadata.simulateTyping();
                }

                // Weighted Execution Delay (Cognitive Cost)
                const toolWeight = DeliberationService.getToolWeight(toolCall.function.name);
                await DeliberationService.wait(toolWeight);

                const args = JSON.parse(toolCall.function.arguments);
                const result = await toolRegistry.executeTool(toolCall.function.name, args, {
                  ...context,
                  tenantId,
                  channelId,
                  platform: message.platform,
                  userId
                });

                mastermindStreamService.toolResult(tenantId, agentId, toolCall.function.name, result);
                socketService.emitActivity(tenantId, channelId, platform, 'tool_end', `Tool ${toolCall.function.name} completed.`);
                return {
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: typeof result === 'string' ? result : JSON.stringify(result)
                };
              } catch (toolError: any) {
                mastermindStreamService.error(tenantId, agentId, `Tool ${toolCall.function.name} failed: ${toolError.message}`);
                socketService.emitActivity(tenantId, channelId, platform, 'system', `Tool ${toolCall.function.name} failed.`);
                return {
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `Error: ${toolError.message}`
                };
              }
            }));

            messages.push(...toolResults);
            loopCount++;
          } else {
            // Update history after successful completion
            await this.updateScopedConversationMemory(tenantId, platform, userId, text, response.message.content || '');
            mastermindStreamService.complete(tenantId, agentId, response.message.content || '');
            return response.message.content;
          }
        }

        return "I've reached my maximum reasoning steps for this request. Here is what I've gathered so far.";
      }, {
        prompt: text,
        timeoutMs: 120000
      });

      // Learn from interaction (Persistent Learning)
      this.learnFromInteractionGeneric(tenantId, channelId, userId, text, {
        intents: [],
        confidence: 0.9,
        actions: [],
        reasoning: 'Automatic learning from conversation',
        toolsNeeded: [],
        responseType: 'conversational'
      }).catch(err => logger.error('Background learning failed:', err));

      // Store in Scoped Vector Memory
      await memoryService.storeConversation(userId, text, {
        channelId: channelId,
        response: finalResponse,
        interactionType: 'human-ai',
        platform: message.platform,
        chatId: userId
      });

      // 5. Record message usage
      await systemAuthorityService.recordUsage(tenantId, 'messages', 1);

      // Track AI analytics
      const responseTime = Date.now() - startTime;
      await aiAnalyticsService.trackAIRequest({
        tenantId,
        userId,
        requestType: 'chat',
        success: true,
        responseTime,
        confidence: 0.85, // Could be calculated from actual AI confidence
        toolsUsed: [],
        timestamp: new Date()
      });

      const responseMsg: CommonMessage = {
        id: crypto.randomUUID(),
        platform: message.platform,
        from: channelId,
        to: userId,
        content: {
          text: finalResponse
        },
        timestamp: Date.now()
      };

      return { success: true, data: responseMsg };

    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Omnichannel AI Brain processing error:', err);

      // Track failed AI request
      const responseTime = Date.now() - startTime;
      await aiAnalyticsService.trackAIRequest({
        tenantId,
        userId: message.from,
        requestType: 'chat',
        success: false,
        responseTime,
        errorMessage: err.message,
        timestamp: new Date()
      });

      return { success: false, error: err };
    }
  }

  /**
   * Generic context builder
   */
  async buildGenericContext(tenantId: string, channelId: string, userId: string, text: string, message: CommonMessage) {
    const userProfile = await databaseService.user.get(userId, tenantId);
    const learningResult = await this.getPersistentLearning(userId, tenantId);
    const learnedFacts = learningResult.success && learningResult.data ? learningResult.data.facts : [];

    return {
      user: userProfile || { id: userId, name: 'Unknown' },
      learnedFacts,
      conversation: await this.getConversationMemory(userId, tenantId),
      message: {
        text: text,
        timestamp: Date.now(),
        isGroup: message.metadata?.isGroup || false,
        platform: message.platform,
        mediaType: message.metadata?.mediaType || 'text',
        sentiment: await this.analyzeSentiment(text)
      },
      environment: {
        timeOfDay: this.getTimeOfDay(),
        dayOfWeek: new Date().getDay(),
        previousActions: await this.getRecentActions(tenantId, userId),
        activeConversations: await this.getActiveConversations(tenantId, userId)
      }
    };
  }

  /**
   * Refactored legacy context builder to use generic one
   */
  async buildEnhancedContext(channel: ActiveChannel, userId: string, message: string, ctx: MessageContext) {
    const commonMsg: CommonMessage = {
      id: ctx.id,
      platform: 'whatsapp',
      from: userId,
      to: channel.channelId,
      content: { text: message },
      timestamp: Date.now(),
      metadata: {
        isGroup: ctx.isGroup(),
        mediaType: this.detectMediaType(ctx)
      }
    };
    return this.buildGenericContext(channel.tenantId, channel.channelId, userId, message, commonMsg);
  }

  /**
   * LEGACY ORCHESTRATOR STUBS REMOVED IN PHASE 6.3 - TRUE AGENTIC AUTONOMY
   * The system now strictly relies on the native ReAct Mastermind Loop inside processOmnichannelMessage.
   * Intent parsing, generic wrappers, and static action dispatchers have been purged.
   */

  async learnFromInteractionGeneric(tenantId: string, channelId: string, userId: string, message: string, intelligence: AIAnalysis) {
    if (!this.decisionEngine.learningEnabled) return;
    // Implementation reused from learnFromInteraction but withoutctx
    const learned = await this.extractFacts(message, { memory: await this.getPersistentLearning(userId, tenantId) });
    if (learned.facts.length > 0 || Object.keys(learned.preferences).length > 0) {
      const existingResult = await this.getPersistentLearning(userId, tenantId);
      const existing = existingResult.success && existingResult.data
        ? existingResult.data
        : { userId, facts: [], preferences: {}, lastInteraction: new Date() as any };

      const newFacts = learned.facts.map(content => ({
        id: crypto.randomUUID(),
        content,
        confidence: intelligence.confidence,
        extractedAt: new Date(),
        updatedAt: new Date()
      }));

      const mergedFacts = [...existing.facts, ...newFacts];
      if (mergedFacts.length > 50) mergedFacts.splice(0, mergedFacts.length - 50);

      const mergedPreferences = { ...existing.preferences, ...learned.preferences };

      await firebaseService.setDoc<'tenants/{tenantId}/learning'>('learning', userId, {
        userId,
        facts: mergedFacts,
        preferences: mergedPreferences,
        lastInteraction: new Date()
      }, tenantId);
    }
  }

  /**
   * LEGACY WHATSAPP ORCHESTRATOR STUBS REMOVED IN PHASE 6.3
   */

  async handleFallbackResponse(ctx: MessageContext, error: any) {
    if (ctx && ctx.reply) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await ctx.reply(`I apologize, but I'm experiencing some technical difficulties: ${errorMsg}. Please try again in a moment.`);
    }
  }

  /**
   * Learn from user interactions to improve responses
   */
  async learnFromInteraction(channel: ActiveChannel, userId: string, message: string, intelligence: AIAnalysis, _ctx: MessageContext) {
    if (!this.decisionEngine.learningEnabled) return;

    try {
      // 1. Extract facts from the current interaction
      const learned = await this.extractFacts(message, { memory: await this.getPersistentLearning(userId, channel.tenantId) });

      if (learned.facts.length > 0 || Object.keys(learned.preferences).length > 0) {
        // 2. Load existing learning data
        const existingResult = await this.getPersistentLearning(userId, channel.tenantId);
        const existing = existingResult.success && existingResult.data
          ? existingResult.data
          : { userId, facts: [], preferences: {}, lastInteraction: new Date() as any };

        // 3. Merge facts
        const newFacts = learned.facts.map(content => ({
          id: crypto.randomUUID(),
          content,
          confidence: intelligence.confidence,
          extractedAt: new Date(),
          updatedAt: new Date()
        }));

        const mergedFacts = [...existing.facts, ...newFacts];
        // Keep only last 50 facts to prevent prompt bloat
        if (mergedFacts.length > 50) mergedFacts.splice(0, mergedFacts.length - 50);

        // 4. Merge preferences
        const mergedPreferences = { ...existing.preferences, ...learned.preferences };

        // 5. Store in Firestore
        await firebaseService.setDoc<'tenants/{tenantId}/learning'>('learning', userId, {
          userId,
          facts: mergedFacts,
          preferences: mergedPreferences,
          lastInteraction: new Date()
        }, channel.tenantId);

        logger.info(`Agentic Brain learned ${learned.facts.length} new facts for ${userId}`);
      }
    } catch (error) {
      logger.error('Failed to learn from interaction', error);
    }
  }

  /**
   * Extract key facts from user message
   */
  async extractFacts(message: string, context: { memory: Result<import('../types/contracts.js').LearningData | null> }): Promise<{ facts: string[], preferences: Record<string, any> }> {
    const prompt = `
Analyze the following message and extract any persistent facts or preferences about the user.
Facts include personal info, interests, important dates, or recurring needs.
Preferences include how they like to be addressed, preferred languages, or specific channel behavior settings.

Message: "${message}"
Current Memory: ${JSON.stringify(context.memory || {})}

Return a JSON object:
{
  "facts": ["Fact 1", "Fact 2"],
  "preferences": {"key": "value"}
}
Only include NEW or UPDATED information. If nothing significant is found, return empty.
`;

    try {
      const response = await this.gemini.getChatCompletion(prompt);
      // More robust JSON extraction (2026 Recommended cleaning)
      const jsonMatch = response.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      const cleanedResponse = jsonMatch ? jsonMatch[0] : response;
      return JSON.parse(cleanedResponse);
    } catch (error) {
      logger.warn('Fact extraction failed', error);
      return { facts: [], preferences: {} };
    }
  }

  async getPersistentLearning(userId: string, tenantId: string): Promise<Result<import('../types/contracts.js').LearningData | null>> {
    try {
      const data = await firebaseService.getDoc<'tenants/{tenantId}/learning'>('learning', userId, tenantId);
      return { success: true, data: data as import('../types/contracts.js').LearningData | null };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  async getScopedConversationMemory(tenantId: string, platform: string, chatId: string) {
    const cacheKey = `ai:memory:${tenantId}:${platform}:${chatId}`;
    const cached = await cacheService.get<any[]>(cacheKey);
    return cached.success ? (cached.data || []) : [];
  }

  async updateScopedConversationMemory(tenantId: string, platform: string, chatId: string, userMessage: string, aiResponse: string) {
    const memory = await this.getScopedConversationMemory(tenantId, platform, chatId);

    memory.push({
      timestamp: Date.now(),
      user: userMessage,
      ai: aiResponse
    });

    // Pruning logic: Keep last 15 exchanges for token efficiency
    if (memory.length > 15) memory.splice(0, memory.length - 15);

    const cacheKey = `ai:memory:${tenantId}:${platform}:${chatId}`;
    await cacheService.set(cacheKey, memory, 3600 * 24); // 24h retention
  }

  /**
   * Returns recently recorded bot actions for a user, used to give Gemini awareness
   * of what it already did in this session. Populated by callers via the cache key
   * `ai:actions:${tenantId}:${userId}` when actions are executed.
   */
  async getRecentActions(tenantId: string, userId: string): Promise<string[]> {
    const cacheKey = `ai:actions:${tenantId}:${userId}`;
    const cached = await cacheService.get<string[]>(cacheKey);
    return cached.success ? (cached.data || []) : [];
  }

  /**
   * Returns active conversation thread IDs for a user across platforms, used to give
   * Gemini awareness of parallel conversations. Populated via cache key
   * `ai:conversations:active:${tenantId}:${userId}`.
   */
  async getActiveConversations(tenantId: string, userId: string): Promise<string[]> {
    const cacheKey = `ai:conversations:active:${tenantId}:${userId}`;
    const cached = await cacheService.get<string[]>(cacheKey);
    return cached.success ? (cached.data || []) : [];
  }

  /**
   * Refactored legacy methods to use scoped versions
   */
  async getConversationMemory(userId: string, tenantId: string) {
    return this.getScopedConversationMemory(tenantId, 'whatsapp', userId);
  }

  async updateConversationMemory(userId: string, tenantId: string, userMessage: string, aiResponse: string) {
    return this.updateScopedConversationMemory(tenantId, 'whatsapp', userId, userMessage, aiResponse);
  }

  /**
   * AI Message Spinning (Enterprise Anti-Ban)
   * Rephrases a message while preserving variables {{var}}
   * Rule 5: Memoized for efficiency
   * Static version for easy utility usage
   */
  public static async spinMessage(content: string, tenantId: string): Promise<Result<string>> {
    try {
      const { multiTenantService } = await import('./multiTenantService.js');
      const tenantResult = await multiTenantService.getTenant(tenantId);
      const plan = (tenantResult.success ? tenantResult.data.plan : 'starter') as PlanTier;
      const caps = systemAuthorityService.getCapabilities(plan);

      if (!caps.features.aiMessageSpinning) {
        logger.warn(`AI Message Spinning denied for tenant ${tenantId} (${plan})`);
        return { success: true, data: content }; // Graceful fallback: return original content
      }

      const cacheKey = `ai:spin:${tenantId}:${cacheService.createKey(content)}`;
      const cached = await cacheService.get<string>(cacheKey);

      if (cached.success && cached.data) {
        return { success: true, data: cached.data };
      }

      const gemini = new GeminiService();
      const prompt = `
Rephrase the following marketing message to make it sound slightly different but keep the same meaning and tone.
STRICT RULE: Do NOT change or remove any variables inside double curly braces like {{name}}, {{phone}}, etc.
Return ONLY the rephrased text.

Message: "${content}"
`;

      const rephrased = await gemini.getChatCompletion(prompt);

      // Memoize for 24 hours
      await cacheService.set(cacheKey, rephrased, 3600 * 24);

      return { success: true, data: rephrased };
    } catch (error: any) {
      logger.error('AI Message Spinning failed (static)', error);
      return { success: false, error };
    }
  }

  /**
   * AI Message Spinning (Enterprise Anti-Ban)
   * Instance version
   */
  async spinMessage(content: string, tenantId: string): Promise<Result<string>> {
    return GeminiAI.spinMessage(content, tenantId);
  }


  // Helper methods
  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 6) return 'late_night';
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  }

  detectMediaType(ctx: MessageContext) {
    if (ctx.getContentType() === 'imageMessage') return 'image';
    if (ctx.getContentType() === 'videoMessage') return 'video';
    if (ctx.getContentType() === 'audioMessage') return 'audio';
    if (ctx.getContentType() === 'documentMessage') return 'document';
    return 'text';
  }

  async analyzeSentiment(message: string) {
    // Simple sentiment analysis - could be enhanced with AI
    const positive = ['good', 'great', 'awesome', 'love', 'like', 'happy', 'excellent'];
    const negative = ['bad', 'hate', 'terrible', 'awful', 'sad', 'angry', 'frustrated'];

    const words = message.toLowerCase().split(' ');
    let score = 0;

    words.forEach(word => {
      if (positive.includes(word)) score += 1;
      if (negative.includes(word)) score -= 1;
    });

    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  extractLocation(message: string) {
    // Simple location extraction - could be enhanced
    const locationPattern = /(?:in|at|for)\s+([A-Za-z\s]+)(?:\s|$)/i;
    const match = message.match(locationPattern);
    return match ? match[1].trim() : null;
  }

  async fallbackIntentDetection(message: string, context: any) {
    // Pattern-based fallback
    const patterns: Record<string, RegExp> = {
      download: /download|get|fetch/i,
      search: /search|find|look/i,
      weather: /weather|temperature|forecast/i,
      translate: /translate|translation/i,
      image: /image|picture|photo|generate/i,
      joke: /joke|funny|humor/i
    };

    const detectedIntents = [];
    for (const [intent, pattern] of Object.entries(patterns)) {
      if (pattern.test(message)) {
        detectedIntents.push({
          intent,
          confidence: 0.6,
          parameters: {},
          reasoning: `Pattern match for ${intent}`
        });
      }
    }

    return detectedIntents.length > 0 ? detectedIntents : [{
      intent: 'conversational',
      confidence: 0.5,
      parameters: {},
      reasoning: 'No specific intent detected, treating as conversation'
    }];
  }

  /**
   * Calculate success metrics for learning from interaction
   */
  async calculateSuccessMetrics(channel: ActiveChannel, intelligence: any, ctx: MessageContext) {
    const startTime = Date.now();
    const metrics: any = {
      actionResults: [] as any[],
      responseGenerated: false,
      errorOccurred: false,
      userSatisfactionIndicators: {} as any,
      executionTime: 0,
      overallSuccess: false
    };

    try {
      // Track action execution success
      if (intelligence.actions && intelligence.actions.length > 0) {
        for (const action of intelligence.actions) {
          try {
            // Check if action was executed successfully
            const actionSuccess = await this.validateActionExecution(channel, action, ctx);
            metrics.actionResults.push({
              action: action.command || action.type,
              success: actionSuccess,
              confidence: action.confidence,
              reasoning: action.reasoning
            });
          } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            metrics.actionResults.push({
              action: action.command || action.type,
              success: false,
              error: err.message
            });
            metrics.errorOccurred = true;
          }
        }
      }

      // Track response generation
      metrics.responseGenerated = ctx.replied || ctx.responseSent || false;

      // Calculate user satisfaction indicators
      metrics.userSatisfactionIndicators = {
        responseRelevance: this.assessResponseRelevance(intelligence, ctx),
        intentConfidenceMatch: intelligence.confidence > 0.7,
        actionExecutionRate: metrics.actionResults.length > 0
          ? metrics.actionResults.filter((r: any) => r.success).length / metrics.actionResults.length
          : 1,
        contextAppropriate: this.assessContextAppropriateness(intelligence, ctx)
      };

      // Calculate execution time
      metrics.executionTime = Date.now() - startTime;

      // Determine overall success
      metrics.overallSuccess = this.calculateOverallSuccess(metrics);

    } catch (error: unknown) {
      logger.error('Error calculating success metrics:', error);
      metrics.errorOccurred = true;
      metrics.overallSuccess = false;
    }

    return metrics;
  }

  /**
   * Validate if an action was executed successfully
   */
  async validateActionExecution(channel: ActiveChannel, action: any, ctx: any) {
    // Check if the action type exists and was callable
    if (action.type === 'command' && action.command) {
      const command = channel.cmd.get(action.command);
      return command !== undefined;
    }

    // For other action types, assume success if no error was thrown
    return true;
  }

  /**
   * Assess response relevance to the user's input
   */
  assessResponseRelevance(intelligence: any, ctx: any) {
    // Simple heuristic - could be enhanced with NLP
    const messageLength = (ctx.body || '').length;
    const actionCount = intelligence.actions ? intelligence.actions.length : 0;
    const confidenceScore = intelligence.confidence || 0;

    // Higher relevance if:
    // - High confidence in intent detection
    // - Appropriate number of actions for message complexity
    // - Response was generated
    let relevanceScore = confidenceScore * 0.4; // Base confidence contribution

    if (actionCount > 0 && messageLength > 10) {
      relevanceScore += 0.3; // Bonus for action execution on complex messages
    }

    if (ctx.replied || ctx.responseSent) {
      relevanceScore += 0.3; // Bonus for generating response
    }

    return Math.min(relevanceScore, 1.0); // Cap at 1.0
  }

  /**
   * Assess if response was appropriate for the context
   */
  assessContextAppropriateness(intelligence: any, ctx: any) {
    // Simple appropriateness check
    const hasActions = intelligence.actions && intelligence.actions.length > 0;
    const hasHighConfidence = intelligence.confidence > 0.6;
    const messageWasQuestion = (ctx.body || '').includes('?');
    const responseGenerated = ctx.replied || ctx.responseSent;

    // Appropriate if:
    // - High confidence actions were taken, OR
    // - Question was asked and response was provided
    return (hasActions && hasHighConfidence) || (messageWasQuestion && responseGenerated);
  }

  /**
   * Calculate overall success based on all metrics
   */
  calculateOverallSuccess(metrics: any) {
    if (metrics.errorOccurred) return false;

    const satisfactionIndicators = metrics.userSatisfactionIndicators;
    const weights = {
      responseRelevance: 0.3,
      intentConfidenceMatch: 0.2,
      actionExecutionRate: 0.3,
      contextAppropriate: 0.2
    };

    let weightedScore = 0;
    weightedScore += (satisfactionIndicators.responseRelevance || 0) * weights.responseRelevance;
    weightedScore += (satisfactionIndicators.intentConfidenceMatch ? 1 : 0) * weights.intentConfidenceMatch;
    weightedScore += (satisfactionIndicators.actionExecutionRate || 0) * weights.actionExecutionRate;
    weightedScore += (satisfactionIndicators.contextAppropriate ? 1 : 0) * weights.contextAppropriate;

    // Success threshold of 0.6 (60%)
    return weightedScore >= 0.6;
  }

  /**
   * Simple text generation for background tasks (e.g. summarization)
   * 2026 Mastermind Edition - Rule 5 Memoized
   */
  async generateText(prompt: string): Promise<Result<string>> {
    try {
      const response = await this.gemini.getChatCompletion(prompt);
      return { success: true, data: response };
    } catch (error: any) {
      logger.error('[GeminiAI] generateText failed:', error);
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  // All legacy orchestration stubs (planWorkflow, executeMultipleActions, etc.)
  // have been fully superseded by the ReAct loop in processOmnichannelMessage.
}

let _geminiAIInstance: GeminiAI | null = null;

/**
 * Get the singleton instance of GeminiAI.
 * Initializes with a default context if none exists.
 */
export function getGeminiAI(): GeminiAI {
  if (!_geminiAIInstance) {
    const defaultContext: GlobalContext = {
      database: databaseService,
      databaseService: databaseService,
      config: configService,
      tools,
      formatter,
      logger,
      groupService,
      channelService,
      agentService,
      ingressService,
      userService,
      tenantConfigService,
      state,
      // These are lazily initialized if needed within GeminiAI methods, 
      // or passed as null if not strictly required for top-level generateText
      commandSystem: null as any,
      unifiedAI: null as any,
    };

    // Note: CommandSystem and unifiedAI require the context to be fully built.
    // We instantiate GeminiAI with the context, and it will be assigned to unifiedAI.
    _geminiAIInstance = new GeminiAI(defaultContext);
    defaultContext.unifiedAI = _geminiAIInstance;
    
    // CommandSystem also needs the context
    const commandSystem = new CommandSystem(defaultContext);
    defaultContext.commandSystem = commandSystem;
  }
  return _geminiAIInstance;
}

/**
 * Lazy proxy singleton for geminiAI.
 * This resolves the export mismatch in TreeIndexService.ts.
 */
export const geminiAI = new Proxy({} as GeminiAI, {
  get(_target, prop: string | symbol) {
    return (getGeminiAI() as any)[prop];
  },
  set(_target, prop: string | symbol, value: any) {
    (getGeminiAI() as any)[prop] = value;
    return true;
  },
});

export default GeminiAI;
