/**
 * DeXMartBrain - Legacy Alias for GeminiAI
 *
 * @deprecated Use GeminiAI directly
 * This module provides backward compatibility for imports using the old name.
 */

import { AIUtilityService } from './ai-utility.js';
import { ActiveChannel, GlobalContext, MessageContext, Result } from '../types/index.js';
import logger from '../utils/logger.js';

/**
 * DeXMartBrain wraps GeminiAI for backward compatibility
 */
export class DeXMartBrain {
    private ai: AIUtilityService;
    private channel: ActiveChannel;

    constructor(channel: ActiveChannel, _context: GlobalContext) {
        this.channel = channel;
        this.ai = AIUtilityService.getInstance();
        logger.debug('[DeXMartBrain] Initialized (wrapping AIUtilityService singleton)');
    }

    /**
     * Process message using GeminiAI
     */
    async processMessage(ctx: MessageContext): Promise<Result<void>> {
        return this.ai.processMessage(this.channel, ctx);
    }
}

export default DeXMartBrain;
