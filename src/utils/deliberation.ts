import logger from './logger.js';

/**
 * DeliberationService (2026 Edition)
 * Handles randomized delays, jitter, and cognitive weights to mimic human behavior.
 */
export const DeliberationService = {
    /**
     * Generates a randomized "Perception Delay" (human reading time)
     * Typically 1.2s to 2.5s
     */
    getPerceptionDelay: (): number => {
        return Math.floor(Math.random() * (2500 - 1200 + 1) + 1200);
    },

    /**
     * Generates a "Thinking Jitter" for AI reasoning loops
     * Typically 500ms to 1200ms
     */
    getThinkingJitter: (): number => {
        return Math.floor(Math.random() * (1200 - 500 + 1) + 500);
    },

    /**
     * Calculates "Typing Burst" delay with non-linear jitter
     * @param text Length of text or segment
     */
    getTypingDelay: (text: string): number => {
        const baseSpeed = 45; // ms per char (approx 260 WPM - fast but human)
        const jitter = Math.random() * 15; // Add up to 15ms variance
        const burstPause = text.length > 100 ? 400 : 0; // Pause for breath on long text

        return Math.min((text.length * (baseSpeed + jitter)) + burstPause, 5000);
    },

    /**
     * Gets weighted cognitive cost for specific tools
     * Complex tools (search, rag) should feel "heavier"
     */
    getToolWeight: (toolName: string): number => {
        const weights: Record<string, number> = {
            'search_web': 1800,
            'rag_query': 1500,
            'database_read': 800,
            'shell_execute': 2000,
            'image_gen': 3000
        };
        return weights[toolName] || 1000;
    },

    /**
     * Sleep utility
     */
    wait: (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))
};

export default DeliberationService;
