import { cacheService } from './cache.js';
import logger from '../utils/logger.js';
import { Result } from '../types/index.js';

/**
 * ToolPersistenceService
 * Manages temporary storage of tool outputs to allow chaining in agentic loops.
 */
export class ToolPersistenceService {
  private static instance: ToolPersistenceService;
  private readonly TTL = 1800; // 30 minutes

  private constructor() {}

  public static getInstance(): ToolPersistenceService {
    if (!ToolPersistenceService.instance) {
      ToolPersistenceService.instance = new ToolPersistenceService();
    }
    return ToolPersistenceService.instance;
  }

  /**
   * Store a tool result for later use in the same session
   */
  async storeResult(scope: { tenantId: string, platform: string, chatId: string }, toolName: string, result: any): Promise<void> {
    const key = this.createKey(scope, toolName);
    await cacheService.set(key, {
      tool: toolName,
      data: result,
      timestamp: Date.now()
    }, this.TTL);
    
    logger.info(`Persisted tool result for ${toolName} in session ${scope.chatId}`);
  }

  /**
   * Retrieve all recent tool results for a session
   */
  async getSessionResults(scope: { tenantId: string, platform: string, chatId: string }): Promise<any[]> {
    // This is a bit tricky with Redis/CacheService since we don't have a 'search by pattern' easily
    // For now, we'll store a list of keys for the session
    const listKey = `session:tools:${scope.tenantId}:${scope.platform}:${scope.chatId}`;
    const keyListResult = await cacheService.get<string[]>(listKey);
    const keys = keyListResult.success && keyListResult.data ? keyListResult.data : [];

    const results = [];
    for (const key of keys) {
      const res = await cacheService.get<any>(key);
      if (res.success && res.data) {
        results.push(res.data);
      }
    }

    return results;
  }

  /**
   * Register a new result key to the session's key list
   */
  async registerKey(scope: { tenantId: string, platform: string, chatId: string }, toolKey: string): Promise<void> {
    const listKey = `session:tools:${scope.tenantId}:${scope.platform}:${scope.chatId}`;
    const keyListResult = await cacheService.get<string[]>(listKey);
    const keys = keyListResult.success && keyListResult.data ? keyListResult.data : [];
    
    if (!keys.includes(toolKey)) {
      keys.push(toolKey);
      // Keep only last 10 tool results to avoid bloat
      if (keys.length > 10) keys.shift();
      await cacheService.set(listKey, keys, this.TTL);
    }
  }

  private createKey(scope: { tenantId: string, platform: string, chatId: string }, toolName: string): string {
    return `tool:res:${scope.tenantId}:${scope.platform}:${scope.chatId}:${toolName}`;
  }
}

export const toolPersistenceService = ToolPersistenceService.getInstance();
