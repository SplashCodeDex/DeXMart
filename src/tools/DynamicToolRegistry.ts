import logger from '../utils/logger.js';
import { ActiveChannel, Command, Result } from '../types/index.js';

interface ToolSchema {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required: string[];
    };
  };
}

interface ToolInfo {
  name: string;
  command: Command;
  schema: ToolSchema;
  category: string;
  enabled: boolean;
  usage: string;
  description: string;
}

export class DynamicToolRegistry {
  private channel: ActiveChannel;
  private tools: Map<string, ToolInfo>;
  private categories: Map<string, string[]>;
  private toolSchemas: ToolSchema[];

  constructor(channel: ActiveChannel) {
    this.channel = channel;
    this.tools = new Map();
    this.categories = new Map();
    this.toolSchemas = [];
    logger.info('Initializing Dynamic Tool Registry');
  }

  async registerAllCommands(): Promise<number> {
    let registered = 0;
    for (const [name, command] of this.channel.cmd) {
      try {
        const schema = await this.createToolSchema(name, command);
        this.tools.set(name, {
          name,
          command,
          schema,
          category: command.category,
          enabled: true,
          usage: command.usage || '',
          description: command.description || `Execute ${name}`
        });
        this.toolSchemas.push(schema);
        registered++;
      } catch (e: unknown) {
        logger.warn(`Failed to register tool: ${name}`);
      }
    }
    this.categorizeTools();
    return registered;
  }

  private async createToolSchema(name: string, command: Command): Promise<ToolSchema> {
    const params = await this.inferParameters(name, command.category);
    return {
      type: 'function',
      function: {
        name,
        description: command.description || `Execute ${name}`,
        parameters: {
          type: 'object',
          properties: params.properties,
          required: params.required
        }
      }
    };
  }

  private async inferParameters(name: string, category: string): Promise<{ properties: Record<string, any>; required: string[] }> {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    if (category === 'downloader' || name.includes('dl')) {
      properties.url = { type: 'string', description: 'URL' };
      required.push('url');
    } else {
      properties.input = { type: 'string', description: 'Input' };
    }

    return { properties, required };
  }

  private categorizeTools(): void {
    for (const tool of this.tools.values()) {
      if (!this.categories.has(tool.category)) this.categories.set(tool.category, []);
      this.categories.get(tool.category)!.push(tool.name);
    }
  }

  public getToolSchemas(): ToolSchema[] {
    return this.toolSchemas.filter(s => this.tools.get(s.function.name)?.enabled);
  }

  public setToolEnabled(name: string, enabled: boolean): void {
    const tool = this.tools.get(name);
    if (tool) tool.enabled = enabled;
  }
}

export default DynamicToolRegistry;
