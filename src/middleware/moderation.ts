import { Middleware, MessageContext } from '../types/index.js';
import ContentModerationService from '../services/contentModeration.js';
import logger from '../utils/logger.js';

// Initialize service (singleton usage)
const contentModeration = new ContentModerationService();

export const moderationMiddleware: Middleware = async (ctx: MessageContext, next: () => Promise<void>) => {
    // 1. Skip if message body is empty
    if (!ctx.body) return next();

    // 2. Skip for Owner/God mode?
    // Maybe not, we want to moderate everyone or at least log it.
    // But for now, let's strictly moderate everyone to be safe.

    try {
        // 3. Moderate Content
        const result = await contentModeration.moderateContent(ctx.body, {
            userId: ctx.sender.jid,
            groupId: ctx.isGroup() ? ctx.id : undefined
        });

        if (!result.safe) {
            logger.warn(`Middleware blocked unsafe content from ${ctx.sender.jid}`, {
                categories: result.categories,
                score: result.score
            });

            // Reply with warning
            await ctx.reply(`⚠️ Message blocked: Content contains restricted topics (${result.categories.join(', ')}).`);

            // Stop pipeline execution (do NOT call next())
            return;
        }

        // 4. If safe, proceed
        return next();

    } catch (error) {
        logger.error('Error in moderation middleware:', error);
        // On error, fail open or closed?
        // Usually fail open for availability, unless strict security is required.
        // Let's assume fail open but log error.
        return next();
    }
};
