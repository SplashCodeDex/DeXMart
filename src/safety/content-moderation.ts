import GeminiService from './gemini.js';
import logger from '../utils/logger.js';

interface ModerationResult {
  safe: boolean;
  score: number;
  categories: string[];
  reason?: string;
  fallback?: boolean;
}

class ContentModerationService {
  private gemini: GeminiService;
  private moderationEnabled: boolean;
  private strictMode: boolean;
  private thresholds: Record<string, number>;
  private categories: string[];

  constructor() {
    this.gemini = new GeminiService();
    this.moderationEnabled = process.env.CONTENT_MODERATION_ENABLED === 'true';
    this.strictMode = process.env.MODERATION_STRICT_MODE === 'true';

    // Moderation thresholds
    this.thresholds = {
      hate: 0.8,
      violence: 0.7,
      adult: 0.6,
      spam: 0.5,
      harassment: 0.7,
    };

    // Content categories to monitor
    this.categories = [
      'hate_speech',
      'violence',
      'adult_content',
      'spam',
      'harassment',
      'bullying',
      'discrimination',
      'self_harm',
      'illegal_activities',
    ];

    logger.info('Content moderation service initialized', {
      enabled: this.moderationEnabled,
      strictMode: this.strictMode,
    });
  }

  /**
   * Moderate content using AI
   * @param {string} content - Content to moderate
   * @param {Object} context - Additional context (userId, groupId, etc.)
   * @returns {Promise<ModerationResult>} Moderation result
   */
  async moderateContent(content: string, context: any = {}): Promise<ModerationResult> {
    if (!this.moderationEnabled || !content) {
      return { safe: true, score: 0, categories: [] };
    }

    try {
      logger.debug('Moderating content', {
        contentLength: content.length,
        userId: context.userId,
        groupId: context.groupId,
      });

      const moderationResult = await this.gemini.moderateContent(content);

      // Enhance result with additional checks
      const enhancedResult = await this.enhanceModeration(content, moderationResult, context);

      // Log moderation results
      if (!enhancedResult.safe) {
        logger.warn('Content flagged by moderation', {
          userId: context.userId,
          groupId: context.groupId,
          categories: enhancedResult.categories,
          score: enhancedResult.score,
          contentPreview: content.substring(0, 100),
        });
      }

      return enhancedResult;
    } catch (error: any) {
      logger.error('Content moderation failed', {
        error: error.message,
        contentLength: content.length,
        userId: context.userId,
      });

      // Default to safe if moderation fails
      return {
        safe: true,
        score: 0,
        categories: [],
        reason: 'Moderation service unavailable',
        fallback: true,
      };
    }
  }

  /**
   * Enhance moderation with additional checks
   * @param {string} content - Original content
   * @param {Object} aiResult - AI moderation result
   * @param {Object} context - Context information
   * @returns {Promise<ModerationResult>} Enhanced moderation result
   */
  async enhanceModeration(content: string, aiResult: any, context: any): Promise<ModerationResult> {
    const enhanced: ModerationResult = {
      safe: aiResult.safe ?? true,
      score: aiResult.score ?? 0,
      categories: aiResult.categories ?? []
    };

    // Additional pattern-based checks
    const patternChecks = this.performPatternChecks(content);

    // Combine AI and pattern results
    enhanced.categories = [
      ...new Set([...(enhanced.categories || []), ...patternChecks.categories]),
    ];
    enhanced.score = Math.max(enhanced.score || 0, patternChecks.score);

    // Context-based adjustments
    if (context.groupId) {
      enhanced.score = await this.adjustForGroupContext(enhanced.score, context);
    }

    // User history consideration
    if (context.userId) {
      enhanced.score = await this.adjustForUserHistory(enhanced.score, context.userId);
    }

    // Determine final safety status
    enhanced.safe = this.determineSafety(enhanced.score, enhanced.categories);

    return enhanced;
  }

  /**
   * Perform pattern-based content checks
   * @param {string} content - Content to check
   * @returns {Object} Pattern check results
   */
  performPatternChecks(content: string) {
    const lowerContent = content.toLowerCase();
    const categories: string[] = [];
    let score = 0;

    // Hate speech patterns
    const hatePatterns = [
      /\b(nigger|nigga)\b/i,
      /\b(faggot|fag)\b/i,
      /\b(kike|heeb)\b/i,
      /\b(chink|gook)\b/i,
      /\b(spic|wetback)\b/i,
      /\b(raghead|towelhead)\b/i,
    ];

    // Violence patterns
    const violencePatterns = [
      /\b(kill|murder|assassinate)\b.*\b(you|him|her|them)\b/i,
      /\b(bomb|explode|detonate)\b/i,
      /\b(shoot|stab|beat|rape)\b.*\b(you|him|her|them)\b/i,
    ];

    // Spam patterns
    const spamPatterns = [
      /(\+?\d{1,3}[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g, // Phone numbers
      /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?/gi, // URLs
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, // Emails
    ];

    // Check hate speech
    if (hatePatterns.some(pattern => pattern.test(lowerContent))) {
      categories.push('hate_speech');
      score = Math.max(score, 0.9);
    }

    // Check violence
    if (violencePatterns.some(pattern => pattern.test(lowerContent))) {
      categories.push('violence');
      score = Math.max(score, 0.8);
    }

    // Check spam
    const spamMatches = spamPatterns.reduce(
      (count, pattern) => count + (lowerContent.match(pattern) || []).length,
      0
    );

    if (spamMatches > 2) {
      categories.push('spam');
      score = Math.max(score, 0.6);
    }

    // Check for excessive caps
    if (content.length > 10) {
      const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
      if (capsRatio > 0.7) {
        categories.push('spam');
        score = Math.max(score, 0.4);
      }
    }

    // Check for repeated characters
    if (/(.)\1{4,}/.test(content)) {
      categories.push('spam');
      score = Math.max(score, 0.3);
    }

    return { categories, score };
  }

  /**
   * Adjust moderation score based on group context
   * @param {number} score - Current moderation score
   * @param {Object} context - Group context
   * @returns {Promise<number>} Adjusted score
   */
  async adjustForGroupContext(score: number, context: any) {
    // This would check group settings for moderation strictness
    // For now, return the original score
    return score;
  }

  /**
   * Adjust moderation score based on user history
   * @param {number} score - Current moderation score
   * @param {string} userId - User ID
   * @returns {Promise<number>} Adjusted score
   */
  async adjustForUserHistory(score: number, userId: string) {
    // This would check user's moderation history
    // For now, return the original score
    return score;
  }

  /**
   * Determine if content is safe based on score and categories
   * @param {number} score - Moderation score
   * @param {Array} categories - Flagged categories
   * @returns {boolean} Whether content is safe
   */
  determineSafety(score: number, categories: string[]) {
    // Always block certain categories regardless of score
    const alwaysBlock = ['hate_speech', 'violence', 'self_harm', 'illegal_activities'];

    if (categories.some(cat => alwaysBlock.includes(cat))) {
      return false;
    }

    // Use thresholds for other categories
    const threshold = this.strictMode ? 0.3 : 0.5;
    return score < threshold;
  }

  /**
   * Get moderation statistics
   * @returns {Promise<Object>} Moderation statistics
   */
  async getStatistics() {
    try {
      // This would return actual statistics from the database
      return {
        totalModerated: 0,
        blockedContent: 0,
        categoriesBreakdown: {} as Record<string, number>,
        averageScore: 0,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('Failed to get moderation statistics', { error: error.message });
      return null;
    }
  }

  /**
   * Moderate content in bulk
   * @param {Array} contentArray - Array of content objects
   * @returns {Promise<Array>} Array of moderation results
   */
  async moderateBulk(contentArray: any[]) {
    const results = [];

    for (const item of contentArray) {
      const result = await this.moderateContent(item.content, item.context);
      results.push({
        ...item,
        moderation: result,
      });
    }

    return results;
  }

  /**
   * Report false positive/negative
   * @param {string} content - The content
   * @param {Object} moderationResult - The moderation result
   * @param {boolean} correctDecision - Whether the moderation was correct
   * @param {string} feedback - User feedback
   */
  async reportFeedback(content: string, moderationResult: ModerationResult, correctDecision: boolean, feedback: string) {
    try {
      logger.info('Moderation feedback received', {
        contentLength: content.length,
        wasCorrect: correctDecision,
        feedback: feedback.substring(0, 100),
        categories: moderationResult.categories,
        score: moderationResult.score,
      });

      // This would store feedback for model improvement
      // Could be used to fine-tune moderation over time
    } catch (error: any) {
      logger.error('Failed to process moderation feedback', { error: error.message });
    }
  }

  /**
   * Update moderation settings
   * @param {Object} settings - New settings
   */
  updateSettings(settings: any) {
    if (settings.enabled !== undefined) {
      this.moderationEnabled = settings.enabled;
    }

    if (settings.strictMode !== undefined) {
      this.strictMode = settings.strictMode;
    }

    if (settings.thresholds) {
      this.thresholds = { ...this.thresholds, ...settings.thresholds };
    }

    logger.info('Moderation settings updated', {
      enabled: this.moderationEnabled,
      strictMode: this.strictMode,
      thresholds: this.thresholds,
    });
  }

  /**
   * Health check for moderation service
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const testContent = 'This is a test message for moderation.';
      const result = await this.moderateContent(testContent);

      return {
        status: 'healthy',
        service: 'content-moderation',
        enabled: this.moderationEnabled,
        strictMode: this.strictMode,
        testResult: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('Content moderation health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        service: 'content-moderation',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default ContentModerationService;
