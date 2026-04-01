import logger from '../utils/logger.js';
import { Result } from '../types/index.js';

import { toolPersistenceService } from './toolPersistenceService.js';
import { mastermindStreamService } from './MastermindStreamService.js';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  execute: (args: any, context: any) => Promise<any>;
  source: 'DeXMart' | 'openclaw' | 'openclaw-channel';
  category?: string;
}

/**
 * Unified Tool Registry (2026 Edition)
 * Merges legacy DeXMart commands with OpenClaw skills.
 */
export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ToolDefinition> = new Map();

  private constructor() { }

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * Registers a new tool in the unified registry.
   */
  public registerTool(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`Overwriting tool: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    logger.info(`Registered tool: [${tool.source}] ${tool.name}`);
  }

  /**
   * Gets all tool definitions for Gemini function calling.
   */
  public getGeminiTools(): any[] {
    return Array.from(this.tools.values()).map(tool => ({
      functionDeclarations: [{
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }]
    }));
  }

  /**
   * Executes a tool by name.
   */
  public async executeTool(name: string, args: any, context: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    const { tenantId, agentId = 'system_default' } = context;

    try {
      logger.info(`Executing tool: ${name} with args:`, args);
      
      // MASTERMIND: Emit tool invocation
      if (tenantId) {
        mastermindStreamService.invokeTool(tenantId, agentId, name, args);
      }

      const result = await tool.execute(args, context);

      // MASTERMIND: Emit tool result
      if (tenantId) {
        mastermindStreamService.toolResult(tenantId, agentId, name, result);
      }

      // Persist result for chaining if context has enough info
      if (context.tenantId && context.platform && context.userId) {
        const scope = {
          tenantId: context.tenantId,
          platform: context.platform,
          chatId: context.userId
        };
        await toolPersistenceService.storeResult(scope, name, result);

        // Ensure the key is registered in the session list
        const toolKey = `tool:res:${scope.tenantId}:${scope.platform}:${scope.chatId}:${name}`;
        await toolPersistenceService.registerKey(scope, toolKey);
      }

      return result;
    } catch (error: any) {
      logger.error(`Error executing tool ${name}:`, error);
      
      // MASTERMIND: Emit tool error
      if (tenantId) {
        mastermindStreamService.error(tenantId, agentId, `Tool ${name} execution failed: ${error.message || 'Unknown error'}`);
      }

      throw error;
    }
  }

  public getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
}

export const toolRegistry = ToolRegistry.getInstance();
