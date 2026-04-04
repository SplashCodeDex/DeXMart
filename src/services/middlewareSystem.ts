/**
 * Middleware System (2026 Mastermind Edition)
 *
 * Manages a pipeline of middleware functions that process messages
 * before they reach the final command handler.
 * Similar to Koa.js middleware composition.
 */

import { MessageContext, Middleware } from '../types/index.js';
import logger from '../utils/logger.js';

export class MiddlewareSystem {
    private stack: Middleware[] = [];

    /**
     * Add a middleware to the pipeline
     */
    use(middleware: Middleware): void {
        this.stack.push(middleware);
    }

    /**
     * Execute the middleware stack
     * @param ctx The message context
     * @param next The final handler to call after all middleware
     */
    async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
        return this.dispatch(0, ctx, next);
    }

    private async dispatch(i: number, ctx: MessageContext, next: () => Promise<void>): Promise<void> {
        if (i === this.stack.length) {
            return next();
        }

        const fn = this.stack[i];

        try {
            await fn(ctx, async () => {
                await this.dispatch(i + 1, ctx, next);
            });
        } catch (error) {
            logger.error(`Middleware error at index ${i}`, error);
            throw error; // Propagate error to global handler
        }
    }
}
