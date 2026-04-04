/**
 * NLP Processing Service
 * Analyzes user input to detect intent and parameters
 */

import GeminiService from './gemini.js';
import logger from '../utils/logger.js';
import { Result } from '../types/contracts.js';

interface ProcessorContext {
    userId: string;
    recentCommands: string[];
    isGroup: boolean;
    isAdmin: boolean;
    isOwner: boolean;
}

interface NLPResult {
    intent: string;
    confidence: number;
    explanation: string;
    command?: string;
    parameters?: Record<string, unknown>;
    alternatives?: string[];
}

class NLPProcessorService {
    private gemini: GeminiService;

    constructor() {
        this.gemini = new GeminiService();
    }

    /**
     * Process natural language input to determine command intent
     */
    async processInput(text: string, context: ProcessorContext): Promise<NLPResult> {
        try {
            const prompt = `Analyze the following user input and determine if it matches a bot command.

Input: "${text}"

Context:
- User ID: ${context.userId}
- Is Group: ${context.isGroup}
- Is Admin: ${context.isAdmin}
- Is Owner: ${context.isOwner}

Provide a JSON response with:
- intent: What the user wants to do
- confidence: 0.0 to 1.0
- explanation: Reasoning
- command: The matching command name (if any, without prefix)
- parameters: Key-value pairs of extracted parameters
- alternatives: Array of alternative command names

Response format: {"intent": "...", "confidence": 0.9, "explanation": "...", "command": "...", "parameters": {}, "alternatives": []}`;

            const response = await this.gemini.getChatCompletion(prompt);

            // Attempt to parse JSON response
            // Gemini might return markdown code block, so we strip it validly
            const cleanJson = response.replace(/^```json\s*|\s*```$/g, '');

            try {
                const result = JSON.parse(cleanJson);
                return {
                    intent: result.intent || 'Unknown',
                    confidence: typeof result.confidence === 'number' ? result.confidence : 0,
                    explanation: result.explanation || 'No explanation provided',
                    command: result.command,
                    parameters: result.parameters,
                    alternatives: Array.isArray(result.alternatives) ? result.alternatives : []
                };
            } catch (e) {
                logger.warn('Failed to parse NLP response as JSON:', e);
                // Fallback result
                return {
                    intent: 'Analysis Failed',
                    confidence: 0,
                    explanation: 'Could not structure the AI response.',
                    alternatives: []
                };
            }

        } catch (error) {
            logger.error('NLP Processing Error:', error);
            throw error;
        }
    }
}

export default NLPProcessorService;
