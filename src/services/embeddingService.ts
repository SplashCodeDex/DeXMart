import { GoogleGenerativeAI } from '@google/generative-ai';
import { Result } from '../types/index.js';
import logger from '../utils/logger.js';
import { ApiKeyManager, isQuotaError } from '../lib/apiKeyManager.js';

/**
 * Embedding Service with API Key Rotation
 *
 * Generates text embeddings using Google's text-embedding-004 model
 * with automatic API key rotation on rate limits.
 */
export class EmbeddingService {
  private static instance: EmbeddingService | null = null;
  private keyManager: ApiKeyManager;
  private genAI: GoogleGenerativeAI;
  private currentKey: string;
  private readonly model: string;
  private readonly baseDelay: number;

  private constructor(keyManager: ApiKeyManager, initialKey?: string) {
    this.keyManager = keyManager;
    this.currentKey = initialKey || '';
    this.genAI = this.currentKey ? new GoogleGenerativeAI(this.currentKey) : ({} as GoogleGenerativeAI);
    this.model = 'text-embedding-004';
    this.baseDelay = 1000;

    const stats = this.keyManager.getStats();
    if (stats.totalKeys > 0) {
      logger.info(`EmbeddingService initialized with ${stats.totalKeys} API keys (${stats.healthyKeys} healthy)`);
    } else {
      logger.info('EmbeddingService initialized in disabled state.');
    }
  }

  /**
   * Get or create the singleton instance.
   * Returns Result pattern for safe initialization.
   */
  public static getInstance(): Result<EmbeddingService> {
    if (EmbeddingService.instance) {
      return { success: true, data: EmbeddingService.instance };
    }

    const managerResult = ApiKeyManager.getInstance();
    if (!managerResult.success) {
      return managerResult; // Propagate critical error
    }

    const keyManager = managerResult.data;

    // Handle disabled case
    if (keyManager.getKeyCount() === 0) {
      EmbeddingService.instance = new EmbeddingService(keyManager);
      return { success: true, data: EmbeddingService.instance };
    }

    // Handle enabled case
    const keyResult = keyManager.getKey();
    if (!keyResult.success) {
      // This is an unexpected state if keys exist
      return {
        success: false,
        error: new Error('Failed to retrieve key from a non-empty ApiKeyManager'),
      };
    }

    EmbeddingService.instance = new EmbeddingService(keyManager, keyResult.data);
    return { success: true, data: EmbeddingService.instance };
  }

  /**
   * Reset singleton (for testing).
   */
  public static resetInstance(): void {
    EmbeddingService.instance = null;
  }

  /**
   * Refresh the client with a new key from the rotation pool.
   */
  private refreshClient(): void {
    const keyResult = this.keyManager.getKey();
    if (!keyResult.success) {
      logger.error('[EmbeddingService] Failed to get new key during rotation:', keyResult.error);
      return;
    }

    if (keyResult.data !== this.currentKey) {
      this.currentKey = keyResult.data;
      this.genAI = new GoogleGenerativeAI(this.currentKey);
      logger.info(`[EmbeddingService] Rotated to new API key ...${this.currentKey.slice(-4)}`);
    }
  }

  /**
   * Generate embedding for text with automatic key rotation on failures.
   *
   * @param text - The text to generate embedding for (max 8000 chars)
   * @returns Result containing the embedding vector or an error
   */
  async generateEmbedding(text: string): Promise<Result<number[]>> {
    const keyCount = this.keyManager.getKeyCount();
    if (keyCount === 0) {
      return {
        success: false,
        error: new Error('EmbeddingService is disabled. GOOGLE_GEMINI_API_KEY is not configured.'),
      };
    }
    if (!text) {
      return { success: false, error: new Error('Text is required') };
    }

    const cleanText = text.trim().substring(0, 8000);

    try {
      const data = await this.keyManager.execute(async (key) => {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: this.model });
        const result = await model.embedContent(cleanText);
        return result.embedding.values;
      }, {
        maxRetries: keyCount + 1,
        timeoutMs: 30000, // 30s timeout for embeddings
        // NOTE: Do NOT pass `prompt` here — the semantic cache's getEmbedding
        // callback calls this method, so passing prompt would cause infinite recursion.
      });

      return { success: true, data };
    } catch (error: any) {
      logger.error('[EmbeddingService] All keys exhausted or fatal error', { error: error.message });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }
}

let _embeddingServiceInstance: EmbeddingService | null = null;

/**
 * Get the singleton instance, throwing on initialization failure.
 * Use EmbeddingService.getInstance() for Result-pattern access.
 */
export function getEmbeddingService(): EmbeddingService {
  if (!_embeddingServiceInstance) {
    const result = EmbeddingService.getInstance();
    if (!result.success) {
      throw result.error;
    }
    _embeddingServiceInstance = result.data;
  }
  return _embeddingServiceInstance;
}

// Lazy proxy — the real service is initialized on first property access,
// not at import time. This prevents crashes during app startup.
export const embeddingService = new Proxy({} as EmbeddingService, {
  get(_target, prop: string | symbol) {
    return (getEmbeddingService() as any)[prop];
  },
  set(_target, prop: string | symbol, value: any) {
    (getEmbeddingService() as any)[prop] = value;
    return true;
  },
});
export default embeddingService;
