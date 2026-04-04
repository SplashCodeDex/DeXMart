import { EnhancedAIBrain } from '../services/index.js';
import { createChannelContext } from '../utils/createChannelContext.js';
import logger from '../utils/logger.js';
import { ActiveChannel, GlobalContext } from '../types/index.js';

/**
 * Intelligent Worker - Processes messages with AI intelligence
 */
class IntelligentWorker {
  private processor: EnhancedAIBrain | null = null;
  private channel: ActiveChannel | null = null;
  private context: GlobalContext | null = null;
  private messagesProcessed: number = 0;
  private errorsCount: number = 0;
  private startedAt: number = Date.now();

  constructor() {
    logger.info('Intelligent Worker initialized');
  }

  /**
   * Initialize with channel context
   */
  async initialize(channel: ActiveChannel, context: GlobalContext) {
    this.channel = channel;
    this.context = context;
    this.processor = new EnhancedAIBrain(context);
    logger.info('Intelligent Worker ready for message processing');
  }

  /**
   * Process message with intelligent handling
   */
  async processMessage(job: any) {
    if (!this.processor) {
      throw new Error('Intelligent processor not initialized');
    }
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    const { messageData, channelContext } = job.data;

    try {
      // Create enhanced context for the message
      const ctx = await this.createEnhancedContext(messageData, channelContext);

      // Process with intelligent system
      await this.processor.processMessage(this.channel, ctx);
      this.messagesProcessed++;

      logger.debug('Message processed intelligently', {
        userId: ctx.sender?.jid,
        processed: true
      });

    } catch (error: any) {
      this.errorsCount++;
      logger.error('Intelligent processing failed:', {
        error: error.message,
        messageData: JSON.stringify(messageData, null, 2).substring(0, 500)
      });
      throw error;
    }
  }

  /**
   * Create enhanced context from message data
   */
  async createEnhancedContext(messageData: any, channelContext: any) {
    if (!this.context) throw new Error('Global context not initialized');
    if (!this.channel) throw new Error('Channel not initialized');

    const ctx = await createChannelContext(this.channel, messageData, this.context);

    // Add intelligent enhancements
    ctx.intelligentMode = true;
    ctx.processingTimestamp = Date.now();
    ctx.workerVersion = 'intelligent-v3';

    return ctx;
  }

  /**
   * Get processing statistics
   */
  getStats() {
    const uptimeMs = Date.now() - this.startedAt;
    const uptimeSec = Math.floor(uptimeMs / 1000);
    return this.processor ? {
      status: 'active',
      messagesProcessed: this.messagesProcessed,
      errorsCount: this.errorsCount,
      errorRate: this.messagesProcessed > 0 ? (this.errorsCount / this.messagesProcessed * 100).toFixed(2) + '%' : '0%',
      uptimeSeconds: uptimeSec,
      uptime: uptimeSec > 3600 ? `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m` : `${Math.floor(uptimeSec / 60)}m ${uptimeSec % 60}s`
    } : {
      status: 'not_initialized',
      messagesProcessed: 0,
      errorsCount: 0,
      errorRate: '0%',
      uptimeSeconds: 0,
      uptime: '0s'
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.processor) {
      return { status: 'unhealthy', reason: 'processor_not_initialized' };
    }

    try {
      const stats = this.getStats();
      return {
        status: 'healthy',
        stats,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        reason: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export default new IntelligentWorker();
