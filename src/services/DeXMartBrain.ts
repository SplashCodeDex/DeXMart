/**
 * DeXMartBrain - Legacy Alias for GeminiAI
 *
 * @deprecated Use GeminiAI directly
 * This module provides backward compatibility for imports using the old name.
 */

import { GeminiAI } from './geminiAI.js';
import { ActiveChannel, GlobalContext, MessageContext, Result } from '../types/index.js';
import logger from '../utils/logger.js';

/**
 * DeXMartBrain wraps GeminiAI for backward compatibility
 */
export class DeXMartBrain {
    private ai: GeminiAI;
    private channel: ActiveChannel;

    constructor(channel: ActiveChannel, context: GlobalContext) {
        this.channel = channel;
        this.ai = new GeminiAI(context);
        logger.debug('[DeXMartBrain] Initialized (wrapping GeminiAI)');
    }

    /**
     * Process message using GeminiAI
     */
    async processMessage(ctx: MessageContext): Promise<Result<void>> {
        return this.ai.processMessage(this.channel, ctx);
    }
}

export default DeXMartBrain;
