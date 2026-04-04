import NodeCache from 'node-cache';
import logger from '../utils/logger.js';

/**
 * Deduplication Service
 * Prevents processing the same message multiple times and handles clock skew.
 */
export class DeduplicationService {
    private static instance: DeduplicationService;
    private cache: NodeCache;
    private readonly MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutes

    private constructor() {
        // Cache message IDs for 10 minutes
        this.cache = new NodeCache({ stdTTL: 600, checkperiod: 60 });
    }

    public static getInstance(): DeduplicationService {
        if (!DeduplicationService.instance) {
            DeduplicationService.instance = new DeduplicationService();
        }
        return DeduplicationService.instance;
    }

    /**
     * Checks if a message should be processed.
     * Returns true if it's a new message and within valid time bounds.
     */
    public shouldProcess(messageId: string, timestamp: number): boolean {
        const now = Date.now();
        const diff = Math.abs(now - timestamp);

        // Scenario 6: System clock skew / Old message handling
        if (diff > this.MAX_CLOCK_SKEW_MS) {
            logger.warn(`[Deduplication] Message ${messageId} ignored due to extreme clock skew or age. Diff: ${Math.round(diff / 1000)}s`);
            return false;
        }

        // Check if seen before
        if (this.cache.has(messageId)) {
            logger.info(`[Deduplication] Duplicate message ${messageId} ignored.`);
            return false;
        }

        // Mark as seen
        this.cache.set(messageId, true);
        return true;
    }

    /**
     * Clear the cache (for testing or maintenance)
     */
    public clear(): void {
        this.cache.flushAll();
    }
}

export const deduplicationService = DeduplicationService.getInstance();
export default deduplicationService;
