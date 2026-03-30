import path from 'node:path';
import fs from 'node:fs';
import { toolRegistry, ToolDefinition } from './toolRegistry.js';
import { getCreateOpenClawTools, getHandleWhatsAppAction, getHandleTelegramAction, getWorkspaceSkills } from '@/utils/openclawImports.js';
import logger from '../utils/logger.js';
import configManager from '../config/ConfigManager.js';

/**
 * Bridge between OpenClaw skills and the DeXMart Unified Tool Registry.
 *
 * Responsibilities:
 * 1. Create OpenClaw tools with full configuration options
 * 2. Register all AI tools in the unified tool registry
 * 3. Register channel-specific AI actions (WhatsApp/Telegram)
 */
export class OpenClawSkillBridge {

  /**
   * Registers all available OpenClaw tools in the unified registry.
   */
  public static async registerSkills(): Promise<void> {
    try {
      // Ensure the agent working directory exists (required for Image Tool)
      const agentDir = path.join(process.cwd(), '.openclaw-agents');
      if (!fs.existsSync(agentDir)) {
        fs.mkdirSync(agentDir, { recursive: true });
        logger.info(`📁 Created OpenClaw agent directory: ${agentDir}`);
      }

      // Create tools with full project configuration
      logger.info('🔧 Creating OpenClaw tools with deep configuration...');
      const createOpenClawTools = await getCreateOpenClawTools();
      const ocTools = createOpenClawTools({
        // --- Static options (set once at boot) ---
        allowHostBrowserControl: true,
        sandboxed: false,
        modelHasVision: true,       // Gemini 2.0 supports vision — enables image understanding tools
        workspaceDir: process.cwd(), // Project root boundary for file tools
        agentDir,                    // Unlocks Image Tool (it's null without this!)
        senderIsOwner: true,         // System-level boot = owner permissions
        config: {
          ...configManager.config,
          plugins: {
            enabled: false // Disable heavy plugin discovery to prevent port 3001 hang
          }
        } as any
      });
      logger.info(`🛠️ Created ${ocTools.length} OpenClaw tools. Bridging...`);

      for (const ocTool of ocTools) {
        this.bridgeOpenClawTool(ocTool);
      }
      logger.info(`✅ Successfully bridged ${ocTools.length} OpenClaw tools.`);

      // Bridge native prompt-based skills
      logger.info('🧠 Bridging native OpenClaw prompt skills...');
      const skillsModule = await getWorkspaceSkills();
      const skillEntries = await skillsModule.loadWorkspaceSkillEntries(process.cwd());
      let bridgedSkillsCount = 0;

      for (const entry of skillEntries as any[]) {
        // Skip if already registered (e.g. by built-in tools)
        if (toolRegistry.getAllTools().some(t => t.name === entry.skill.name)) continue;

        const tool: ToolDefinition = {
          name: entry.skill.name,
          description: entry.skill.description || entry.frontmatter?.title || entry.skill.name,
          parameters: {
            type: 'object',
            properties: entry.skill.parameters?.properties || {},
            required: entry.skill.parameters?.required || []
          },
          source: 'openclaw',
          category: entry.frontmatter?.category || 'Intelligence',
          execute: async (args, _context) => {
            // These are primarily prompt-based, but if they have execution logic,
            // we'll need a generic way to handle them. For now, we bridge the metadata
            // so they appear in the UI and can be enabled/disabled.
            logger.info(`Executing prompt skill: ${entry.skill.name}`);
            return `Skill ${entry.skill.name} executed with args: ${JSON.stringify(args)}`;
          }
        };

        toolRegistry.registerTool(tool);
        bridgedSkillsCount++;
      }
      logger.info(`✅ Successfully bridged ${bridgedSkillsCount} native OpenClaw prompt skills.`);

      // Register channel-specific AI actions
      this.registerChannelActions(configManager.config);

    } catch (error) {
      logger.error('Failed to bridge OpenClaw skills:', error);
    }
  }

  /**
   * Bridges a single OpenClaw tool into the unified registry.
   */
  private static bridgeOpenClawTool(ocTool: any): void {
    const tool: ToolDefinition = {
      name: ocTool.name,
      description: ocTool.description,
      parameters: this.convertSchema(ocTool.parameters),
      source: 'openclaw',
      execute: async (args, _context) => {
        // OpenClaw tools expect (toolCallId, args)
        const toolCallId = `oc_${Math.random().toString(36).substring(7)}`;
        return await ocTool.execute(toolCallId, args);
      }
    };

    toolRegistry.registerTool(tool);
  }

  /**
   * Registers channel-specific AI actions (WhatsApp + Telegram) as
   * discrete tools in the unified registry.
   *
   * These give the AI brain platform-native capabilities:
   * - WhatsApp: reactions (with auth/account resolution)
   * - Telegram: react, sendMessage, deleteMessage, editMessage,
   *             sendSticker, searchSticker, createForumTopic
   */
  private static registerChannelActions(config: any): void {
    // --- WhatsApp Actions Tool ---
    const whatsappActionTool: ToolDefinition = {
      name: 'whatsapp_action',
      description: [
        'Perform WhatsApp-specific actions.',
        'Supported actions:',
        '  - react: Send/remove emoji reactions on a WhatsApp message.',
        '    Params: action="react", chatJid (string), messageId (string), emoji (string).',
        '    Optional: participant (string), accountId (string), fromMe (boolean).',
        '    To remove a reaction, set remove=true.',
      ].join('\n'),
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'The action to perform. Currently: "react".' },
          chatJid: { type: 'string', description: 'The WhatsApp chat JID.' },
          messageId: { type: 'string', description: 'The message ID to react to.' },
          emoji: { type: 'string', description: 'The emoji to react with.' },
          remove: { type: 'boolean', description: 'Set to true to remove the reaction.' },
          participant: { type: 'string', description: 'Participant JID (for group reactions).' },
          accountId: { type: 'string', description: 'WhatsApp account ID (multi-account).' },
          fromMe: { type: 'boolean', description: 'Whether the original message was sent by the bot.' },
        },
        required: ['action'],
      },
      source: 'openclaw-channel',
      execute: async (args) => {
        const handleWhatsAppAction = await getHandleWhatsAppAction();
        return await handleWhatsAppAction(args as Record<string, unknown>, config);
      },
    };
    toolRegistry.registerTool(whatsappActionTool);
    logger.info('🟢 Registered WhatsApp AI action tool (react)');

    // --- Telegram Actions Tool ---
    const telegramActionTool: ToolDefinition = {
      name: 'telegram_action',
      description: [
        'Perform Telegram-specific actions.',
        'Supported actions:',
        '  - react: Send/remove emoji reactions on a Telegram message.',
        '    Params: action="react", chatId (string|number), messageId (number), emoji (string).',
        '  - sendMessage: Send a message to a Telegram chat.',
        '    Params: action="sendMessage", to (string), content (string).',
        '    Optional: mediaUrl, buttons, replyToMessageId, messageThreadId, quoteText, asVoice, silent, accountId.',
        '  - deleteMessage: Delete a message.',
        '    Params: action="deleteMessage", chatId, messageId.',
        '  - editMessage: Edit a message.',
        '    Params: action="editMessage", chatId, messageId, content.',
        '  - sendSticker: Send a sticker.',
        '    Params: action="sendSticker", to (string), fileId (string).',
        '  - searchSticker: Search for stickers by query.',
        '    Params: action="searchSticker", query (string). Optional: limit (number).',
        '  - createForumTopic: Create a forum topic in a Telegram supergroup.',
        '    Params: action="createForumTopic", chatId, name (string).',
      ].join('\n'),
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'The action to perform.' },
          to: { type: 'string', description: 'Target chat/user for sendMessage/sendSticker.' },
          chatId: { type: 'string', description: 'Chat ID for react/deleteMessage/editMessage/createForumTopic.' },
          messageId: { type: 'number', description: 'Message ID for react/deleteMessage/editMessage.' },
          content: { type: 'string', description: 'Message content for sendMessage/editMessage.' },
          emoji: { type: 'string', description: 'Emoji for reactions.' },
          remove: { type: 'boolean', description: 'Set to true to remove a reaction.' },
          mediaUrl: { type: 'string', description: 'Media URL for sendMessage.' },
          fileId: { type: 'string', description: 'Sticker file ID for sendSticker.' },
          query: { type: 'string', description: 'Search query for searchSticker.' },
          limit: { type: 'number', description: 'Max results for searchSticker.' },
          name: { type: 'string', description: 'Topic name for createForumTopic.' },
          replyToMessageId: { type: 'number', description: 'Message ID to reply to.' },
          messageThreadId: { type: 'number', description: 'Forum thread ID for topic routing.' },
          quoteText: { type: 'string', description: 'Quote text for reply.' },
          asVoice: { type: 'boolean', description: 'Send as voice note.' },
          silent: { type: 'boolean', description: 'Send silently (no notification).' },
          accountId: { type: 'string', description: 'Telegram account ID (multi-account).' },
          buttons: { type: 'array', description: 'Inline button rows for sendMessage/editMessage.' },
          iconColor: { type: 'number', description: 'Icon color for createForumTopic.' },
          iconCustomEmojiId: { type: 'string', description: 'Custom emoji icon for createForumTopic.' },
        },
        required: ['action'],
      },
      source: 'openclaw-channel',
      execute: async (args) => {
        const handleTelegramAction = await getHandleTelegramAction();
        return await handleTelegramAction(args as Record<string, unknown>, config);
      },
    };
    toolRegistry.registerTool(telegramActionTool);
    logger.info('🟢 Registered Telegram AI action tool (7 actions: react, sendMessage, deleteMessage, editMessage, sendSticker, searchSticker, createForumTopic)');
  }

  /**
   * Converts TypeBox/JSON Schema to Gemini-compatible parameter schema.
   */
  private static convertSchema(schema: any): any {
    // Both follow JSON Schema standards, so we just ensure it's an object
    return {
      type: 'object',
      properties: schema.properties || {},
      required: schema.required || []
    };
  }
}
