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
     * Process message using OpenClaw Engine (formerly GeminiAI)
     */
    async processMessage(ctx: MessageContext): Promise<Result<void>> {
        try {
            // Import dynamically since this is a bridged wrapper for legacy processors
            const { runEmbeddedPiAgent } = await import('../agents/pi-embedded-runner/run.js');
            
            // Invoke the new embedded agent runtime
            await runEmbeddedPiAgent({
                agentDir: (this.channel as any).agentDir || process.env.DEFAULT_AGENT_DIR || '',
                message: (ctx as any)?.content?.text || '',
                // Minimal stub to satisfy bridging logic. Full native routing happens in IngressService.
            } as any);

            return { success: true, data: undefined };
        } catch (error: any) {
            logger.error('[DeXMartBrain] Pipeline error:', error);
            return { success: false, error: error.message };
        }
    }
}

export default DeXMartBrain;
