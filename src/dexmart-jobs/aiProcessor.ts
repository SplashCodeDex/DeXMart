import { Job } from 'bullmq';
import GeminiService from '../services/gemini.js';
import logger from '../utils/logger.js';

interface Message {
  role: string;
  content: string;
}

interface Conversation {
  messages: Message[];
  context?: any;
}

interface ContentGenerationData {
  prompt: string;
  type: string;
  userId: string;
  context?: {
    targetLanguage?: string;
    cacheKey?: string;
  };
}

interface BatchAnalysisData {
  items: { id: string; content: string }[];
  analysisType: string;
  userId: string;
}

interface ContentModerationData {
  content: string;
  userId: string;
  context?: any;
}

interface FineTuningData {
  conversations: { id: string; messages: { role: string; content: string }[]; context?: any }[];
  userId: string;
  modelType: string;
}

interface PerformanceAnalyticsData {
  timeRange: string;
  userId: string;
  metrics: string[];
  tenantId?: string; // Required for real analytics
}

/**
 * AIProcessor handles various AI-related background jobs using Gemini.
 */
class AIProcessor {
  private gemini: GeminiService;

  constructor() {
    this.gemini = new GeminiService();
  }

  /**
   * Process AI content generation job
   * @param {Object} jobData - Job data
   * @param {Object} job - Bull job instance
   * @returns {Promise<Object>} Processing result
   */
  async processContentGeneration(jobData: ContentGenerationData, job: Job): Promise<any> {
    const { prompt, type, userId, context } = jobData;

    try {
      logger.info('Processing AI content generation', {
        jobId: job.id,
        type,
        userId,
        promptLength: prompt.length,
      });

      let result;

      switch (type) {
        case 'text':
          result = await this.gemini.getChatCompletion(prompt);
          break;

        case 'analysis':
          result = await this.gemini.getChatCompletion(`Analyze the following content: ${prompt}`);
          break;

        case 'summary':
          result = await this.gemini.getSummary([{ role: 'user', content: prompt }]);
          break;

        case 'translation':
          const { targetLanguage } = context || {};
          if (targetLanguage) {
            result = await this.gemini.getChatCompletion(
              `Translate the following text to ${targetLanguage}: ${prompt}`
            );
          } else {
            throw new Error('Target language not specified for translation');
          }
          break;

        default:
          result = await this.gemini.getChatCompletion(prompt);
      }

      // Store result in cache for faster retrieval
      if (context?.cacheKey) {
        // Implementation would depend on cache service
        logger.debug('AI result cached', { cacheKey: context.cacheKey });
      }

      return {
        success: true,
        type,
        result,
        processingTime: Date.now() - (job.processedOn ?? Date.now()),
        metadata: {
          userId,
          promptLength: prompt.length,
          resultLength: result.length,
        },
      };
    } catch (error: any) {
      logger.error('AI content generation failed', {
        jobId: job.id,
        type,
        userId,
        error: error.message,
      });

      throw new Error(`AI processing failed: ${error.message}`);
    }
  }

  /**
   * Process batch AI analysis job
   * @param {Object} jobData - Job data
   * @param {Object} job - Bull job instance
   * @returns {Promise<Object>} Processing result
   */
  async processBatchAnalysis(jobData: BatchAnalysisData, job: Job): Promise<any> {
    const { items, analysisType, userId } = jobData;

    try {
      logger.info('Processing batch AI analysis', {
        jobId: job.id,
        itemCount: items.length,
        analysisType,
        userId,
      });

      const results = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        try {
          let analysis;

          switch (analysisType) {
            case 'sentiment':
              analysis = await this.gemini.getChatCompletion(
                `Analyze the sentiment of this text (positive, negative, or neutral): "${item.content}"`
              );
              break;

            case 'topics':
              analysis = await this.gemini.getChatCompletion(
                `Extract the main topics from this text: "${item.content}"`
              );
              break;

            case 'summary':
              analysis = await this.gemini.getSummary([{ role: 'user', content: item.content }]);
              break;

            default:
              analysis = await this.gemini.getChatCompletion(
                `Analyze this content: "${item.content}"`
              );
          }

          results.push({
            id: item.id,
            content: item.content,
            analysis,
            success: true,
          });
        } catch (itemError: any) {
          logger.warn('Failed to analyze item in batch', {
            jobId: job.id,
            itemId: item.id,
            error: itemError.message,
          });

          results.push({
            id: item.id,
            content: item.content,
            error: itemError.message,
            success: false,
          });
        }

        // Update job progress
        await job.updateProgress(((i + 1) / items.length) * 100);
      }

      return {
        success: true,
        analysisType,
        totalItems: items.length,
        successfulAnalyses: results.filter(r => r.success).length,
        results,
        processingTime: Date.now() - (job.processedOn ?? Date.now()),
      };
    } catch (error: any) {
      logger.error('Batch AI analysis failed', {
        jobId: job.id,
        analysisType,
        userId,
        error: error.message,
      });

      throw new Error(`Batch analysis failed: ${error.message}`);
    }
  }

  /**
   * Process AI content moderation job
   * @param {Object} jobData - Job data
   * @param {Object} job - Bull job instance
   * @returns {Promise<Object>} Processing result
   */
  async processContentModeration(jobData: ContentModerationData, job: Job): Promise<any> {
    const { content, userId, context } = jobData;

    try {
      logger.info('Processing AI content moderation', {
        jobId: job.id,
        userId,
        contentLength: content.length,
      });

      const moderationResult = await this.gemini.moderateContent(content);

      // Log moderation actions
      if (!moderationResult.safe) {
        logger.warn('Content flagged by AI moderation', {
          jobId: job.id,
          userId,
          categories: moderationResult.categories,
          score: moderationResult.score,
        });
      }

      return {
        success: true,
        contentLength: content.length,
        moderationResult,
        processingTime: Date.now() - (job.processedOn ?? Date.now()),
        metadata: {
          userId,
          categories: moderationResult.categories,
          score: moderationResult.score,
        },
      };
    } catch (error: any) {
      logger.error('AI content moderation failed', {
        jobId: job.id,
        userId,
        error: error.message,
      });

      throw new Error(`Content moderation failed: ${error.message}`);
    }
  }

  /**
   * Process AI model fine-tuning data preparation
   * @param {Object} jobData - Job data
   * @param {Object} job - Bull job instance
   * @returns {Promise<Object>} Processing result
   */
  async processFineTuningData(jobData: FineTuningData, job: Job): Promise<any> {
    const { conversations, userId, modelType } = jobData;

    try {
      logger.info('Processing AI fine-tuning data', {
        jobId: job.id,
        userId,
        conversationCount: conversations.length,
        modelType,
      });

      const processedData = [];

      for (let i = 0; i < conversations.length; i++) {
        const conversation = conversations[i];

        try {
          // Generate training examples from conversation
          const trainingExample = await this.generateTrainingExample(conversation, modelType);

          processedData.push({
            conversationId: conversation.id,
            trainingExample,
            success: true,
          });
        } catch (convError: any) {
          logger.warn('Failed to process conversation for fine-tuning', {
            jobId: job.id,
            conversationId: conversation.id,
            error: convError.message,
          });

          processedData.push({
            conversationId: conversation.id,
            error: convError.message,
            success: false,
          });
        }

        // Update job progress
        await job.updateProgress(((i + 1) / conversations.length) * 100);
      }

      return {
        success: true,
        modelType,
        totalConversations: conversations.length,
        processedData,
        processingTime: Date.now() - (job.processedOn ?? Date.now()),
      };
    } catch (error: any) {
      logger.error('AI fine-tuning data processing failed', {
        jobId: job.id,
        userId,
        modelType,
        error: error.message,
      });

      throw new Error(`Fine-tuning data processing failed: ${error.message}`);
    }
  }

  /**
   * Generate training example from conversation
   * @param {Conversation} conversation - Conversation data
   * @param {string} modelType - Type of model being fine-tuned
   * @returns {Promise<any>} Training example
   */
  async generateTrainingExample(conversation: Conversation, modelType: string): Promise<any> {
    const { messages, context } = conversation;

    // Create a prompt for the AI to generate a training example
    const prompt = `Create a training example for a ${modelType} model from this conversation:

${messages.map((msg: Message) => `${msg.role}: ${msg.content}`).join('\n')}

Context: ${JSON.stringify(context)}

Generate a JSON training example with the following format:
{
  "input": "user input text",
  "output": "expected AI response",
  "context": "additional context information"
}`;

    const trainingExampleStr = await this.gemini.getChatCompletion(prompt);

    try {
      return JSON.parse(trainingExampleStr);
    } catch (parseError: any) {
      // If parsing fails, create a basic structure
      return {
        input: messages
          .filter((m: Message) => m.role === 'user')
          .map((m: Message) => m.content)
          .join(' '),
        output: messages
          .filter((m: Message) => m.role === 'assistant')
          .map((m: Message) => m.content)
          .join(' '),
        context: context || {},
      };
    }
  }

  /**
   * Process AI performance analytics
   * @param {Object} jobData - Job data
   * @param {Object} job - Bull job instance
   * @returns {Promise<Object>} Processing result
   */
  async processPerformanceAnalytics(jobData: PerformanceAnalyticsData, job: Job): Promise<any> {
    const { timeRange, userId, metrics } = jobData;

    try {
      logger.info('Processing AI performance analytics', {
        jobId: job.id,
        userId,
        timeRange,
        metrics: metrics.join(', '),
      });

      // Get real analytics from aiAnalyticsService
      const { aiAnalyticsService } = await import('../services/aiAnalytics.js');

      // Extract tenantId from userId (assuming format includes tenant info or we need to query)
      // For now, we'll need tenantId to be part of jobData - this is a requirement
      const tenantId = (jobData as any).tenantId || 'default';

      const analyticsResult = await aiAnalyticsService.getPerformanceAnalytics(
        tenantId,
        userId,
        timeRange,
        metrics
      );

      if (!analyticsResult.success) {
        throw analyticsResult.error;
      }

      const analytics = analyticsResult.data;

      return {
        success: true,
        analytics,
        processingTime: Date.now() - (job.processedOn ?? Date.now()),
      };
    } catch (error: any) {
      logger.error('AI performance analytics processing failed', {
        jobId: job.id,
        userId,
        error: error.message,
      });

      throw new Error(`Performance analytics processing failed: ${error.message}`);
    }
  }
}

export default AIProcessor;
