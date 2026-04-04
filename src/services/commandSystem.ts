/**
 * UNIFIED COMMAND SYSTEM - Consolidates all command loading approaches
 * 2026 Mastermind Edition - Stateless & Multi-Tenant Optimized & Strictly Typed
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { trace, SpanStatusCode } from '@opentelemetry/api';

import performanceMonitor from '../utils/performanceMonitor.js';
import { proto, downloadContentFromMessage, getContentType } from 'baileys';
import { type ActiveChannel, type Command, type MessageContext, type GlobalContext, type GroupFunctions } from '../types/index.js';
import { MessageNormalizer } from '../utils/messageNormalizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tracer = trace.getTracer('DeXMart-command-system');

export class CommandSystem {
  private context: GlobalContext;
  private commands: Map<string, Command>;
  private aliases: Map<string, string>;
  private categories: Map<string, string[]>;
  private prefixes: string[];
  public loadedCount: number = 0;
  public failedCount: number = 0;

  constructor(context: GlobalContext) {
    this.context = context;
    this.commands = new Map();
    this.aliases = new Map();
    this.categories = new Map();

    // Command prefixes
    this.prefixes = ['.', '!', '/', '#'];

    this.context.logger.info('🔧 Unified Command System initialized');
  }

  /**
   * LOAD ALL COMMANDS
   */
  async loadCommands() {
    const startTime = Date.now();
    this.loadedCount = 0;
    this.failedCount = 0;

    this.commands.clear();
    this.aliases.clear();
    this.categories.clear();

    const commandsDir = path.join(__dirname, '..', 'commands');
    this.context.logger.info('🔄 Parallelizing command loading...');

    try {
      const categories = await fs.readdir(commandsDir, { withFileTypes: true });

      // Parallelize category loading
      await Promise.all(categories.map(async (category) => {
        if (!category.isDirectory()) return;

        const categoryPath = path.join(commandsDir, category.name);
        const commandFiles = await fs.readdir(categoryPath);

        this.categories.set(category.name, []);

        // Parallelize file loading within category
        await Promise.all(commandFiles.map(async (file) => {
          if ((file.endsWith('.js') || file.endsWith('.ts')) && !file.endsWith('.d.ts')) {
            try {
              const commandPath = path.join(categoryPath, file);
              const command = await this.loadSingleCommand(commandPath, category.name);

              if (command) {
                // Since this is asynchronous, we use a synchronized registration
                this.registerCommand(command, category.name);
              }
            } catch (error: unknown) {
              const err = error instanceof Error ? error.message : String(error);
              this.context.logger.error(`  ❌ Error loading ${file}:`, { error: err });
            }
          }
        }));
      }));

      const duration = Date.now() - startTime;
      this.context.logger.info(`🎉 High-Speed Load Complete: ${this.loadedCount} commands in ${duration}ms`);

    } catch (error: unknown) {
      const err = error instanceof Error ? error.message : String(error);
      this.context.logger.error('❌ Command loading failed:', { error: err });
    }
  }

  /**
   * LOAD SINGLE COMMAND
   */
  async loadSingleCommand(commandPath: string, categoryName: string): Promise<Command | null> {
    try {
      const absolutePath = path.resolve(commandPath);
      const commandUrl = pathToFileURL(absolutePath).href;

      const commandModule = await import(commandUrl);
      const command = commandModule.default || commandModule;

      if (command) {
        if (command.execute && !command.code) command.code = command.execute;
        else if (command.run && !command.code) command.code = command.run;
      }

      if (!this.validateCommand(command)) return null;

      const enhancedCommand: Command = {
        ...command,
        category: categoryName,
        aliases: command.aliases || [],
        permissions: command.permissions || {},
        filePath: commandPath,
        loadedAt: Date.now(),
        // Default values for robustness
        description: command.description || 'No description',
        usage: command.usage || command.name
      };

      this.loadedCount += 1;
      return enhancedCommand;

    } catch (error: unknown) {
      const err = error instanceof Error ? error.message : String(error);
      this.failedCount += 1;
      this.context.logger.error(`Failed to load command: ${commandPath}`, { error: err });
      return null;
    }
  }

  public getCommands(): Map<string, Command> {
    return this.commands;
  }

  public getCategorizedCommands(): Record<string, { name: string; desc: string }[]> {
    const categorized: Record<string, { name: string; desc: string }[]> = {};

    for (const [category, commandNames] of this.categories.entries()) {
      categorized[category] = commandNames
        .map(name => {
          const cmd = this.commands.get(name);
          return cmd ? { name: cmd.name, desc: cmd.description } : null;
        })
        .filter((cmd): cmd is { name: string; desc: string } => cmd !== null);
    }

    return categorized;
  }

  registerCommand(command: Command, categoryName: string) {
    this.commands.set(command.name, command);
    if (command.aliases) {
      command.aliases.forEach((alias: string) => {
        this.aliases.set(alias, command.name);
      });
    }
    if (!this.categories.has(categoryName)) this.categories.set(categoryName, []);
    this.categories.get(categoryName)?.push(command.name);
  }

  validateCommand(command: unknown): command is Command {
    return !!(command && typeof command === 'object' && 'name' in command && typeof (command as Command).code === 'function');
  }

  async processMessage(bot: ActiveChannel, messageData: proto.IWebMessageInfo) {
    const text = this.extractText(messageData);
    if (!text) return false;

    const commandInfo = this.parseCommand(text);
    if (!commandInfo) return false;

    const commandName = this.aliases.get(commandInfo.name) || commandInfo.name;
    const command = this.commands.get(commandName);

    if (!command) return false;

    return await this.executeCommand(bot, command, messageData, commandInfo);
  }

  parseCommand(text: string) {
    const trimmed = text.trim();
    const prefix = this.prefixes.find(p => trimmed.startsWith(p));
    if (!prefix) return null;

    const withoutPrefix = trimmed.substring(prefix.length);
    const parts = withoutPrefix.split(/\s+/);
    const name = parts[0].toLowerCase();
    const args = parts.slice(1);

    return { name, args, fullText: text, prefix };
  }

  async executeCommand(bot: ActiveChannel, command: Command, messageData: proto.IWebMessageInfo, commandInfo: { name: string; args: string[]; prefix: string }) {
    const timer = performanceMonitor.startTimer('command_execution', {
      command: command.name,
      userId: messageData.key?.remoteJid || 'unknown',
      tenantId: bot.tenantId
    });

    return await tracer.startActiveSpan(`command:${command.name}`, {
      attributes: {
        'app.command': command.name,
        'app.tenant_id': bot.tenantId,
        'app.user_jid': messageData.key?.remoteJid || 'unknown',
        'app.is_group': !!messageData.key?.remoteJid?.endsWith('@g.us')
      }
    }, async (span) => {
      try {
        const ctx = await this.createContext(bot, messageData, commandInfo, command);

        // Execute command through middleware pipeline
        await bot.executeMiddleware(ctx, async () => {
          if (command.code) {
            await command.code(ctx);
          }
        });

        const duration = timer.end();
        this.context.logger.command(command.name, messageData.key?.remoteJid || 'unknown', true, duration);
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return true;

      } catch (error: unknown) {
        timer.end();
        const err = error instanceof Error ? error : new Error(String(error));
        this.context.logger.command(command.name, messageData.key?.remoteJid || 'unknown', false, null, err);

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err.message
        });
        span.recordException(err);
        span.end();

        if (messageData.key?.remoteJid) {
          await bot.sendMessage(messageData.key.remoteJid, { text: `❌ Error: ${err.message}` }, { quoted: messageData });
        }
        return true;
      }
    });
  }

  async createContext(bot: ActiveChannel, messageData: proto.IWebMessageInfo, commandInfo: { args: string[]; prefix: string }, command: Command): Promise<MessageContext> {
    const text = MessageNormalizer.getText(messageData);
    const jid = messageData.key?.remoteJid || '';

    const getGroupFunctions = (targetJid?: string): GroupFunctions => {
      const effectiveJid = targetJid || (jid.endsWith('@g.us') ? jid : '');

      if (!effectiveJid) {
        return this.context.groupService.createFunctions(bot, bot.tenantId, 'invalid@g.us', messageData.key?.participant || jid);
      }
      return this.context.groupService.createFunctions(bot, bot.tenantId, effectiveJid, messageData.key?.participant || jid);
    };

    // Extract quoted message if available
    const quotedMsg = messageData.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedContext = quotedMsg ? {
      content: quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || quotedMsg.imageMessage?.caption || '',
      contentType: getContentType(quotedMsg) || Object.keys(quotedMsg)[0],
      senderJid: messageData.message?.extendedTextMessage?.contextInfo?.participant || '',
      media: quotedMsg.imageMessage || quotedMsg.videoMessage || quotedMsg.audioMessage || quotedMsg.stickerMessage || quotedMsg.documentMessage,
      key: {
        id: messageData.message?.extendedTextMessage?.contextInfo?.stanzaId,
        remoteJid: jid,
        participant: messageData.message?.extendedTextMessage?.contextInfo?.participant
      }
    } : undefined;

    // Fetch tenant settings for this bot's tenant
    const tenantResult = await (bot.context as GlobalContext).tenantConfigService.getTenantSettings(bot.tenantId);
    const tenantSettings = tenantResult.success ? tenantResult.data : ({} as any);

    const msgContext: MessageContext = {
      ...messageData,
      tenant: tenantSettings,
      isOwner: false,
      isAdmin: false,
      id: jid,
      body: text,
      args: commandInfo.args,
      command: command.name,
      prefix: commandInfo.prefix,
      commandDef: command,
      sender: {
        jid,
        name: messageData.pushName || 'Unknown',
        pushName: messageData.pushName ?? undefined,
        isOwner: false, // Will be set below
        isAdmin: false,
      },
      author: {
        id: jid // Legacy alias for sender.jid
      },
      quoted: quotedContext as any,
      msg: messageData as any,
      channel: bot,
      getContentType: () => (messageData.message ? getContentType(messageData.message) : undefined) || '',
      getBody: () => text,
      getMedia: () => {
        const type = messageData.message ? getContentType(messageData.message) : undefined;
        return type ? (messageData.message as any)[type] : undefined;
      },
      getPlatform: () => 'whatsapp', // Baileys specific createContext
      getSenderJid: () => jid,
      getQuoted: () => quotedContext as any,
      isFromMe: () => !!messageData.key?.fromMe,
      reply: async (msg: string | { text?: string;[key: string]: unknown }) => {
        const content = typeof msg === 'string' ? { text: msg } : msg;
        return await bot.sendMessage(jid, content, { quoted: messageData });
      },
      sendMessage: async (targetJid: string, content: Record<string, unknown>, options?: Record<string, unknown>) => {
        return await bot.sendMessage(targetJid, content, options);
      },
      replyReact: async (emoji: string) => {
        return await bot.sendMessage(jid, { react: { text: emoji, key: messageData.key } });
      },
      isGroup: () => jid.endsWith('@g.us'),
      usage: {},
      getId: (target: string) => target.split('@')[0],
      simulateTyping: async () => {
        if (bot.sendPresenceUpdate) {
          await bot.sendPresenceUpdate('composing', jid).catch(() => { });
        }
      },
      sendPresenceUpdate: async (presence: any, jid?: string) => {
        if (bot.sendPresenceUpdate) {
          await bot.sendPresenceUpdate(presence, jid || messageData.key?.remoteJid || '').catch(() => { });
        }
      },
      used: {
        command: command.name,
        prefix: commandInfo.prefix,
        args: commandInfo.args,
        text: commandInfo.args.join(' ')
      },
      cooldown: null,

      // Group Functions
      group: getGroupFunctions,

      download: async () => {
        // 2026: Functional Media Download
        const messageToDownload = msgContext.quoted?.media ?
          { [msgContext.quoted.contentType]: msgContext.quoted.media } :
          messageData.message;

        if (!messageToDownload) throw new Error('No media found to download');

        const type = getContentType(messageToDownload);
        if (!type) throw new Error('Could not determine media type');

        const stream = await downloadContentFromMessage(
          (messageToDownload as any)[type],
          type.replace('Message', '') as any
        );

        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
      }
    };

    return msgContext;
  }

  extractText(messageData: proto.IWebMessageInfo) {
    return MessageNormalizer.getText(messageData);
  }
}

export default CommandSystem;
