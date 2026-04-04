import { MessageContext, GlobalContext } from '../../types/index.js';
import { z } from 'zod';
import GeminiService from '../../services/gemini.js';
import aiTools from '../../tools/ai-tools.js';
import chatHistoryManager from '../../utils/chatHistoryManager.js';
import performanceMonitor from '../../utils/performanceMonitor.js';
import { RateLimiter } from '../../utils/rateLimiter.js';
import cache from '../../lib/cache.js';
import redis from '../../lib/redis.js';
import logger from '../../utils/logger.js';

// Initialize rate limiter
const rateLimiter = new RateLimiter(redis);

interface GeminiMessage {
  role: string;
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: any[]; // Keep any for now for external library types, or define specific tool call structure
}

export default {
  name: 'gemini',
  category: 'ai-chat',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const { config, formatter } = ctx.channel.context as GlobalContext;

    // Constants for summarization logic
    const {
      SUMMARIZE_THRESHOLD,
      MESSAGES_TO_SUMMARIZE,
      HISTORY_PRUNE_LENGTH,
    } = config.ai.summarization;

    // Start performance monitoring
    const timer = performanceMonitor.startTimer('gemini_command_execution', {
      userId: ctx.sender.jid,
      hasQuoted: !!ctx.quoted
    });

    try {
      const quotedContent = ctx.quoted ? (ctx.quoted as { content: string }).content : '';
      const input = ctx.args.join(' ') || quotedContent || '';

      // Rate limiting check
      const rateLimitResult = await rateLimiter.isRateLimited(ctx.sender.jid, 'gemini');
      if (!rateLimitResult.allowed) {
        return ctx.reply(formatter.quote(`⏰ Rate limit exceeded for ${rateLimitResult.failedCheck?.type}. Try again later.`));
      }

      // Validation
      const inputSchema = z.string().min(1, { message: 'Please provide an input text.' });
      const validationResult = inputSchema.safeParse(input);
      if (!validationResult.success) {
        return ctx.reply(formatter.quote(`❎ ${validationResult.error.issues[0].message}`));
      }
      const validatedInput = validationResult.data;

      // Service call with tool handling
      const geminiService = new GeminiService();
      const userId = ctx.sender.jid;
      const tenantId = ctx.channel.tenantId;

      // Use ChatHistoryManager
      const chat = (await chatHistoryManager.getChat(tenantId, userId)) || { history: [], summary: '' };
      let currentHistory = chat.history || [];
      let currentSummary = chat.summary || '';

      // Enhanced Summarization Logic with proper memory management
      if (currentHistory.length >= SUMMARIZE_THRESHOLD) {
        const messagesToSummarize = currentHistory.slice(0, MESSAGES_TO_SUMMARIZE);
        if (messagesToSummarize.length > 0) {
          try {
            const newSummary = await geminiService.getSummary(messagesToSummarize);

            // Limit summary length to prevent unbounded growth
            const maxSummaryLength = 1000;
            if (currentSummary) {
              const combinedSummary = `${currentSummary}\n\n${newSummary}`;
              currentSummary = combinedSummary.length > maxSummaryLength
                ? combinedSummary.substring(combinedSummary.length - maxSummaryLength)
                : combinedSummary;
            } else {
              currentSummary = newSummary.length > maxSummaryLength
                ? newSummary.substring(0, maxSummaryLength)
                : newSummary;
            }

            // Keep only recent messages
            currentHistory = currentHistory.slice(-HISTORY_PRUNE_LENGTH);

            logger.info(`Memory optimized: History=${currentHistory.length}, Summary=${currentSummary.length} chars`);
          } catch (summaryError: unknown) {
            const errorMessage = summaryError instanceof Error ? summaryError.message : String(summaryError);
            logger.warn('Summary generation failed, using fallback truncation:', errorMessage);
            // Fallback: just truncate history without summarizing
            currentHistory = currentHistory.slice(-HISTORY_PRUNE_LENGTH);
          }
        }
      }

      const systemMessage = `You are a helpful assistant. You can use tools to answer questions.${currentSummary ? `\n\nSummary of past conversation:\n${currentSummary}` : ''}`;

      const messages: GeminiMessage[] = [
        { role: 'system', content: systemMessage },
        ...currentHistory,
        { role: 'user', content: validatedInput },
      ];

      // --- Caching Implementation Start ---
      const cacheKey = cache.createKey(messages);
      const cacheResult = await cache.get(cacheKey);

      if (cacheResult.success && cacheResult.data) {
        logger.info(`✅ Cache hit for key: ${cacheKey}`);
        timer.end();
        return ctx.reply(cacheResult.data as string);
      }
      logger.info(`❌ Cache miss for key: ${cacheKey}`);
      // --- Caching Implementation End ---

      const response = await geminiService.getChatCompletionWithTools(messages, aiTools);
      const responseMessage = response.message;

      if (response.finish_reason === 'tool_calls' && responseMessage.tool_calls) {
        messages.push(responseMessage);

        for (const toolCall of responseMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          const commandToExecute = ctx.channel.cmd.get(functionName);
          let toolResponse = 'Error: Command not found.';

          if (commandToExecute) {
            try {
              let commandOutput = '';
              // The weather command expects args to be a string, not an array.
              // We need to handle different argument structures.
              const argsForCommand =
                functionName === 'weather'
                  ? Object.values(functionArgs).join(' ')
                  : Object.values(functionArgs);

              // Create a mock context that satisfies the necessary parts of MessageContext
              // We use 'as any' here sparingly because creating a full mock context is complex
              // AUDIT-INTENTIONAL(#9): Security sandbox for AI-triggered commands.
              // isOwner=false prevents AI from executing destructive owner-only commands.
              // group=undefined blocks group admin actions via prompt injection.
              // reply() is intercepted to capture output for the AI, not send to chat.
              const mockCtx: Partial<MessageContext> = {
                ...ctx,
                args: Array.isArray(argsForCommand) ? argsForCommand.map(String) : [String(argsForCommand)],
                reply: (output: string | object) => {
                  commandOutput = typeof output === 'object' ? JSON.stringify(output) : output;
                  return Promise.resolve({ key: { remoteJid: '', id: '' }, message: {} });
                },
                isGroup: ctx.isGroup,
                getId: ctx.getId,
                // Explicitly undefined or mock properties to prevent side effects
                group: undefined,
                sender: { jid: ctx.sender.jid, name: ctx.sender.name, isOwner: false, isAdmin: false, pushName: ctx.sender.pushName },
              };

              const executor = commandToExecute.code || commandToExecute.execute;
              if (executor) {
                await executor(mockCtx as MessageContext);
                toolResponse = commandOutput;
                logger.info(`Tool execution success: ${functionName}`);
              } else {
                throw new Error('Command executor not found');
              }
            } catch (e: unknown) {
              const errorMessage = e instanceof Error ? e.message : String(e);
              toolResponse = `Error executing tool ${functionName}: ${errorMessage}`;
              logger.error(`Tool execution failed: ${functionName}`, e);
            }
          }

          messages.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: functionName,
            content: toolResponse,
          });
        }

        const finalResponse = await geminiService.getChatCompletionWithTools(messages, aiTools);
        const finalMessageContent = finalResponse.message.content;
        messages.push(finalResponse.message);

        await chatHistoryManager.updateChat(tenantId, userId, { history: messages.slice(1), summary: currentSummary });

        // --- Caching Implementation Start ---
        await cache.set(cacheKey, finalMessageContent);
        logger.info(`✅ Result stored in cache for key: ${cacheKey}`);
        // --- Caching Implementation End ---

        timer.end();
        return ctx.reply(finalMessageContent);
      }
      const result = responseMessage.content;
      messages.push(responseMessage);

      await chatHistoryManager.updateChat(tenantId, userId, { history: messages.slice(1), summary: currentSummary });

      // --- Caching Implementation Start ---
      await cache.set(cacheKey, result);
      logger.info(`✅ Result stored in cache for key: ${cacheKey}`);
      // --- Caching Implementation End ---

      timer.end();
      return ctx.reply(result);
    } catch (error: unknown) {
      timer.end();
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Gemini command error:', err);

      // Log error with context
      const quotedContent = ctx.quoted ? (ctx.quoted as { content: string }).content : '';
      const input = ctx.args.join(' ') || quotedContent || '';
      logger.error('Error details:', {
        userId: ctx.sender.jid,
        input: input?.substring(0, 100),
        error: err.message,
        stack: err.stack?.split('\n').slice(0, 5)
      });

      return ctx.reply(formatter.quote(`An error occurred: ${err.message}`));
    }
  },
};
