import { toolRegistry, ToolDefinition } from './toolRegistry.js';
import { Channel, Command } from '../types/index.js';
import logger from '../utils/logger.js';
import { channelManager } from './channels/ChannelManager.js';

/**
 * Bridge between DeXMart legacy commands and the Unified Tool Registry.
 */
export class DeXMartToolBridge {

  /**
   * Registers a subset of high-value DeXMart commands as AI tools.
   */
  public static registerCommands(channel: Channel): void {
    const config = (channel as any).config || {};
    
    // 2026 Mastermind: Dynamic tool selection
    let toolsToBridge = [
      'youtubevideo', 'youtubeaudio', 'instagramdl', 'tiktokdl', 'facebookdl',
      'dalle', 'animagine', 'editimage', 'upscale', 'removebg',
      'weather', 'translate', 'joke', 'meme', 'screenshot', 'ocr'
    ];

    if (config.enabledTools && Array.isArray(config.enabledTools)) {
      toolsToBridge = config.enabledTools;
      logger.info(`>>> [MASTERMIND] Using configured tools for bridging: ${toolsToBridge.join(', ')}`);
    } else if (config.enableAllTools) {
      toolsToBridge = Array.from((channel as any).cmd.keys()) as string[];
      logger.info(`>>> [MASTERMIND] Bridging ALL available commands (${toolsToBridge.length})`);
    }

    console.log(`>>> [MASTERMIND] Bridging ${toolsToBridge.length} commands...`);

    for (const name of toolsToBridge) {
      const command = (channel as any).cmd.get(name);
      if (command) {
        this.bridgeCommand(name, command, channel);
      } else {
        // Only warn if it was explicitly requested in config
        if (config.enabledTools) {
           console.warn(`>>> [MASTERMIND] Requested tool not found in channel: ${name}`);
        }
      }
    }
  }

  private static bridgeCommand(name: string, command: Command, channel: Channel): void {
    const tool: ToolDefinition = {
      name,
      description: command.description || `Execute ${name} command`,
      parameters: this.inferParameters(name, command.category),
      source: 'DeXMart',
      category: command.category,
      execute: async (args, context) => {
        // 2026 Mastermind: Resolve the specific channel instance from context
        const { channelId } = context;
        let activeChannel: any = channel;

        if (channelId) {
          const adapter = channelManager.getAdapter(channelId);
          if (adapter) {
            activeChannel = adapter;
          }
        }

        // Prepare a mock context for the legacy command
        const mockCtx = {
          ...context,
          args: Object.values(args).map(v => String(v)),
          body: Object.values(args).join(' '),
          used: { command: name }, // For middleware identification
          channel: activeChannel // Pass resolved channel
        };

        const handler = command.code || command.execute || (command as any).run;
        if (handler) {
          let blocked = true;
          // Security enforcement via Middleware (Permissions, Cooldowns, etc.)
          await activeChannel.executeMiddleware(mockCtx as any, async () => {
            blocked = false;
            await handler(mockCtx as any);
          });

          if (blocked) {
            return { success: false, error: 'Execution blocked by security middleware.' };
          }

          return { success: true, message: `Command ${name} executed.` };
        }

        return { success: false, error: 'Command has no executable code.' };
      }
    };

    toolRegistry.registerTool(tool);
  }

  private static inferParameters(name: string, category: string): any {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    if (category === 'downloader' || name.includes('dl')) {
      properties.url = { type: 'string', description: 'URL of the content to download' };
      required.push('url');
    } else if (name === 'translate') {
      properties.text = { type: 'string', description: 'Text to translate' };
      properties.to = { type: 'string', description: 'Target language code' };
      required.push('text', 'to');
    } else {
      properties.input = { type: 'string', description: 'Input for the command' };
    }

    return {
      type: 'object',
      properties,
      required
    };
  }
}
