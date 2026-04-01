import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import cache from '../lib/cache.js';
import { ApiKeyManager, isQuotaError } from '../lib/apiKeyManager.js';
import { ConfigService } from './ConfigService.js';

export interface GeminiToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface GeminiResponse {
  finish_reason: 'stop' | 'tool_calls';
  message: {
    role: string;
    content: string;
    tool_calls?: GeminiToolCall[];
  };
}

class GeminiService {
  private keyManager: ApiKeyManager;
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private currentKey: string;
  private cache: typeof cache;
  private config: ConfigService;

  constructor() {
    this.config = ConfigService.getInstance();
    const managerResult = ApiKeyManager.getInstance();
    if (!managerResult.success) {
      throw managerResult.error;
    }
    this.keyManager = managerResult.data;

    // Attempt to get an initial key. If none is available (e.g., all keys were
    // marked dead in a prior session), we defer initialization gracefully.
    // All actual API calls go through keyManager.execute() which handles
    // rotation and recovery, so this is safe to defer.
    const keyResult = this.keyManager.getKey();
    if (keyResult.success) {
      this.currentKey = keyResult.data;
      this.genAI = new GoogleGenerativeAI(this.currentKey);
      this.model = this.genAI.getGenerativeModel({
        model: this.config.get('GEMINI_MODEL') || 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      });
    } else {
      logger.warn('[GeminiService] No API keys available at startup. AI features will be lazily initialized on first use.');
      this.currentKey = '';
      this.genAI = null as any;
      this.model = null as any;
    }

    // Initialize cache service
    this.cache = cache;

    const stats = this.keyManager.getStats();
    logger.info(`Gemini service initialized with ${stats.totalKeys} API keys (${stats.healthyKeys} healthy)`);
  }

  /**
   * Expose the key manager for advanced features (semantic caching, stats)
   */
  public getManager(): ApiKeyManager {
    return this.keyManager;
  }

  /**
   * Refresh the client with a new key from the rotation pool.
   * Called after marking a key as failed.
   * @returns {boolean} True if rotation was successful, false if no keys available
   */
  private refreshClient(): boolean {
    const keyResult = this.keyManager.getKey();
    if (!keyResult.success) {
      logger.error('[GeminiService] Failed to get new key during rotation:', keyResult.error);
      return false;
    }

    if (keyResult.data !== this.currentKey) {
      this.currentKey = keyResult.data;
      this.genAI = new GoogleGenerativeAI(this.currentKey);
      this.model = this.genAI.getGenerativeModel({
        model: this.config.get('GEMINI_MODEL') || 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      });
      logger.info(`[GeminiService] Rotated to new API key ...${this.currentKey.slice(-4)}`);
    }
    return true;
  }

  /**
   * Generate cache key for AI responses
   * @param {string} prompt - The input prompt
   * @param {string} type - Type of request (chat, summary, etc.)
   * @returns {string} Cache key
   */
  generateCacheKey(prompt: string, type: string = 'chat') {
    const hash = crypto.createHash('md5').update(prompt).digest('hex');
    return `gemini:${type}:${hash}`;
  }

  /**
   * Get a chat completion from Google Gemini API with caching and key rotation
   */
  async getChatCompletion(text: string, correlationId: string | null = null, preferredModel?: string): Promise<string> {
    if (!text) {
      throw new Error('Input text is required.');
    }

    const cacheKey = this.generateCacheKey(text, 'chat');

    // 1. Layer 1: App-level Cache (Exact Match)
    if (this.cache) {
      const cacheResult = await this.cache.get<string>(cacheKey);
      if (cacheResult.success && cacheResult.data) {
        logger.debug('Returning cached Gemini response', { cacheKey, correlationId });
        return cacheResult.data;
      }
    }

    try {
      const data = await this.keyManager.execute(async (key, signal) => {
        logger.info('Gemini chat completion request', {
          correlationId,
          keyHint: `...${key.slice(-4)}`,
          model: preferredModel || 'default'
        });

        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({
          model: preferredModel || this.config.get('GEMINI_MODEL') || 'gemini-1.5-flash',
        });

        const result = await model.generateContent(text);
        const response = await result.response;
        const message = response.text();

        if (!message) {
          throw new Error('Empty response from Gemini API');
        }

        // Cache the response in App-level cache
        if (this.cache) {
          await this.cache.set(cacheKey, message, 1800); // 30 minutes
        }

        return message;
      }, {
        maxRetries: 3,
        timeoutMs: 60000,
        prompt: text // ENABLE SEMANTIC CACHE (Layer 2)
      });

      return data;
    } catch (error: any) {
      logger.error('Gemini chat completion failed', {
        correlationId,
        error: error.message,
      });
      throw new Error(`Failed to get response from Gemini API: ${error.message}`);
    }
  }

  /**
   * Get a chat completion with conversation history and caching
   */
  async getChatCompletionWithHistory(messages: any[], correlationId: string | null = null, preferredModel?: string) {
    if (!messages || messages.length === 0) {
      throw new Error('Messages array is required.');
    }

    // Create a cache key based on the conversation
    const conversationKey = messages.map(m => `${m.role}:${m.content}`).join('|');
    const cacheKey = this.generateCacheKey(conversationKey, 'conversation');

    // 1. Layer 1: App-Cache
    if (this.cache) {
      const cacheResult = await this.cache.get<string>(cacheKey);
      if (cacheResult.success && cacheResult.data) {
        logger.debug('Returning cached Gemini conversation response', { cacheKey, correlationId });
        return cacheResult.data;
      }
    }

    try {
      return await this.keyManager.execute(async (key) => {
        logger.info('Gemini chat completion with history request', {
          correlationId,
          messageCount: messages.length,
          keyHint: `...${key.slice(-4)}`,
          model: preferredModel || 'default'
        });

        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({
          model: preferredModel || this.config.get('GEMINI_MODEL') || 'gemini-1.5-flash',
        });

        const history = messages.slice(0, -1).map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        }));

        const chat = model.startChat({ history });
        const lastMessage = messages[messages.length - 1];
        const result = await chat.sendMessage(lastMessage.content);
        const response = await result.response;
        const message = response.text();

        // Cache in Layer 1
        if (this.cache) {
          await this.cache.set(cacheKey, message, 1800);
        }

        return message;
      }, {
        maxRetries: 3,
        prompt: messages[messages.length - 1].content // ENABLE SEMANTIC CACHE
      });
    } catch (error: any) {
      logger.error('Gemini chat completion with history failed', {
        correlationId,
        error: error.message,
      });
      throw new Error(`Failed to get response from Gemini API: ${error.message}`);
    }
  }


  /**
   * Get a chat completion with function calling support and caching
   * @param {Array} messages - Array of message objects
   * @param {Array} tools - Array of tool definitions
   * @param {string} preferredModel - Optional model to use
   * @returns {Promise<GeminiResponse>} The full response object with potential tool calls
   */
  async getChatCompletionWithTools(messages: any[], tools: any[], preferredModel?: string): Promise<GeminiResponse> {
    if (!messages || messages.length === 0) {
      throw new Error('Messages are required.');
    }

    const toolKey = tools ? tools.map(t => t.function?.name).sort().join(',') : 'no-tools';
    const conversationKey = `${messages.map(m => `${m.role}:${m.content}`).join('|')}|tools:${toolKey}|model:${preferredModel || 'default'}`;
    const cacheKey = this.generateCacheKey(conversationKey, 'tools');

    if (this.cache) {
      const cacheResult = await this.cache.get(cacheKey);
      if (cacheResult.success && cacheResult.data) {
        logger.debug('Returning cached Gemini tools response', { cacheKey });
        return cacheResult.data as GeminiResponse;
      }
    }

    try {
      return await this.keyManager.execute(async (key) => {
        logger.debug('Sending chat completion with tools to Gemini', {
          messageCount: messages.length,
          toolCount: tools?.length || 0,
          keyHint: `...${key.slice(-4)}`,
          model: preferredModel || 'gemini-2.0-flash-exp'
        });

        const genAI = new GoogleGenerativeAI(key);
        const geminiTools = tools ? this.convertToolsToGeminiFormat(tools) : [];
        const modelWithTools = genAI.getGenerativeModel({
          model: preferredModel || 'gemini-2.0-flash-exp',
          tools: geminiTools.length > 0 ? [{ functionDeclarations: geminiTools }] : [],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        });

        const geminiMessages = messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        }));

        const chat = modelWithTools.startChat({
          history: geminiMessages.slice(0, -1),
        });

        const lastMessage = geminiMessages[geminiMessages.length - 1];
        const result = await chat.sendMessage(lastMessage.parts[0].text);
        const response = await result.response;

        const functionCalls = response.functionCalls();
        let responseData;

        if (functionCalls && functionCalls.length > 0) {
          responseData = {
            finish_reason: 'tool_calls' as const,
            message: {
              role: 'assistant',
              content: response.text(),
              tool_calls: functionCalls.map(call => ({
                id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                function: {
                  name: call.name,
                  arguments: JSON.stringify(call.args),
                },
              })),
            },
          };
        } else {
          responseData = {
            finish_reason: 'stop' as const,
            message: {
              role: 'assistant',
              content: response.text(),
            },
          };
        }

        if (this.cache) {
          await this.cache.set(cacheKey, responseData, 900);
        }

        return responseData;
      }, { maxRetries: 3 });
    } catch (error: any) {
      logger.error('Error fetching Gemini completion with tools', {
        error: error.message,
        messageCount: messages.length,
      });
      throw new Error(`Failed to get response from Gemini API with tools: ${error.message}`);
    }
  }

  /**
   * Generate a summary of conversation messages with caching
   * @param {Array} messagesToSummarize - Array of message objects to summarize
   * @returns {Promise<string>} The summary text
   */
  async getSummary(messagesToSummarize: any[]) {
    if (!messagesToSummarize || messagesToSummarize.length === 0) {
      throw new Error('Messages to summarize are required.');
    }

    // Create cache key for summary
    const summaryKey = messagesToSummarize.map(m => `${m.role}:${m.content}`).join('|');
    const cacheKey = this.generateCacheKey(summaryKey, 'summary');

    // Try to get from cache first
    if (this.cache) {
      const cacheResult = await this.cache.get<string>(cacheKey);
      if (cacheResult.success && cacheResult.data) {
        logger.debug('Returning cached Gemini summary', { cacheKey });
        return cacheResult.data;
      }
    }

    try {
      return await this.keyManager.execute(async (key) => {
        logger.debug('Generating conversation summary with Gemini', {
          messageCount: messagesToSummarize.length,
          keyHint: `...${key.slice(-4)}`
        });

        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({
          model: this.config.get('GEMINI_MODEL') || 'gemini-1.5-flash',
        });

        const summaryPrompt = `Please provide a concise summary of the following conversation, capturing the key points and main topics discussed:\n\n${messagesToSummarize.map(msg => `${msg.role}: ${msg.content}`).join('\n\n')}\n\nSummary:`;

        const result = await model.generateContent(summaryPrompt);
        const response = await result.response;
        const summary = response.text();

        // Ensure we have text
        if (!summary) throw new Error('Empty summary from Gemini');

        // Cache the summary
        if (this.cache) {
          await this.cache.set(cacheKey, summary, 3600); // Cache for 1 hour
          logger.debug('Cached Gemini summary', { cacheKey });
        }

        logger.debug('Generated conversation summary', { summaryLength: summary.length });
        return summary;
      }, { maxRetries: 2 });
    } catch (error: any) {
      logger.error('Error generating summary with Gemini', {
        error: error.message,
        messageCount: messagesToSummarize.length,
      });
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
  }

  /**
   * Moderate content using Gemini with caching
   * @param {string} content - Content to moderate
   * @returns {Promise<Object>} Moderation result
   */
  async moderateContent(content: string) {
    if (!content) {
      throw new Error('Content to moderate is required.');
    }

    const cacheKey = this.generateCacheKey(content, 'moderation');

    // Try to get from cache first
    if (this.cache) {
      const cacheResult = await this.cache.get(cacheKey);
      if (cacheResult.success && cacheResult.data) {
        logger.debug('Returning cached moderation result', { cacheKey });
        return cacheResult.data;
      }
    }

    try {
      return await this.keyManager.execute(async (key) => {
        logger.debug('Moderating content with Gemini', {
          contentLength: content.length,
          keyHint: `...${key.slice(-4)}`
        });

        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({
          model: this.config.get('GEMINI_MODEL') || 'gemini-1.5-flash',
        });

        const moderationPrompt = `Please analyze the following content and determine if it contains:\n1. Hate speech or discriminatory content\n2. Violent or harmful content\n3. Adult or explicit content\n4. Spam or promotional content\n5. Harassment or bullying\n\nContent: "${content}"\n\nProvide a JSON response with:\n- safe: boolean (true if content is safe, false if not)\n- categories: array of violated categories (if any)\n- reason: brief explanation\n\nResponse format: {"safe": true/false, "categories": [], "reason": ""}`;

        const result = await model.generateContent(moderationPrompt);
        const response = await result.response;
        const moderationResult = response.text();

        let parsed: any;
        try {
          parsed = JSON.parse(moderationResult);
        } catch (parseError: any) {
          logger.warn('Failed to parse moderation response, assuming safe', { moderationResult });
          parsed = { safe: true, categories: [], reason: 'Unable to parse moderation result' };
        }

        // Cache the moderation result
        if (this.cache) {
          await this.cache.set(cacheKey, parsed, 1800); // Cache for 30 minutes
          logger.debug('Cached moderation result', { cacheKey });
        }

        logger.debug('Content moderation completed', parsed);
        return parsed;
      }, { maxRetries: 2 });
    } catch (error: any) {
      logger.error('Error moderating content with Gemini - ALERT: Manual review required', {
        error: error.message,
        content: `${content.substring(0, 100)}...`,
      });

      throw new Error(`Moderation failed: ${error.message} - Content flagged for manual review`);
    }
  }

  /**
   * Convert tools to Gemini function declaration format
   * @param {Array} tools - Tools array with function definitions
   * @returns {Array} Tools in Gemini format
   */
  convertToolsToGeminiFormat(tools: any[]) {
    return tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    }));
  }

  /**
   * Clear cache for specific patterns
   * @param {string} pattern - Cache key pattern to clear
   * @returns {Promise<number>} Number of cleared cache entries
   */
  async clearCache(pattern: string = 'gemini:*'): Promise<number> {
    if (this.cache) {
      const result = await this.cache.invalidatePattern(pattern);
      if (result.success) {
        logger.info(`Cleared ${result.data} cached Gemini responses`);
        return result.data;
      }
      logger.warn('Failed to clear cache:', result.error);
    }
    return 0;
  }

  /**
   * Health check for Gemini service
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const startTime = Date.now();
      const result = await this.model.generateContent('Hello');
      const response = await result.response;
      const text = response.text();
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        model: 'gemini-2.0-flash-exp',
        responseTime,
        testResponse: text ? 'OK' : 'No response',
        cache: this.cache ? 'enabled' : 'disabled',
      };
    } catch (error: any) {
      logger.error('Gemini health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: Date.now(),
        cache: this.cache ? 'enabled' : 'disabled',
      };
    }
  }
}

export default GeminiService;
