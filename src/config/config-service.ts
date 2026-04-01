import configManager, { Config } from '../config/ConfigManager.js';
import logger from '../utils/logger.js';
import { Job } from 'bullmq';

/**
 * Singleton service for managing application configuration.
 * Refactored to wrap ConfigManager for centralized authority.
 */
export class ConfigService {
  private static instance: ConfigService;
  private config: Config;
  private _jid: string = '';

  private constructor() {
    this.config = configManager.config;
    logger.info('ConfigService initialized as wrapper for ConfigManager');
  }

  /**
   * Sets the channel's WhatsApp JID at connection time.
   */
  public setJid(jid: string): void {
    this._jid = jid;
    logger.info(`ConfigService: Channel JID set to ${jid}`);
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Resets the singleton instance.
   * STRICT: Used for test isolation only.
   */
  public static resetInstance(): void {
    // @ts-ignore - access private static member
    ConfigService.instance = undefined;
  }

  /**
   * Retrieves a configuration value by key.
   * Supports dot notation for nested properties.
   */
  public get(key: string): any {
    return configManager.get(key);
  }

  /**
   * Getter for channel-specific configuration.
   */
  public get channel() {
    return {
      ...this.config.channel,
      jid: this._jid,
      id: this._jid,
      groupJid: this.get('GROUP_JID'),
      readyAt: new Date(),
      uptime: '0s',
      dbSize: '0B',
      groupLink: this.get('GROUP_LINK') || 'https://chat.whatsapp.com/CodeDeX'
    };
  }

  /**
   * Getter for message/comestics configuration.
   */
  public get msg(): import('../types/index.js').Config['msg'] {
    return {
      name: this.config.channel.name,
      footer: `© ${new Date().getFullYear()} ${this.config.channel.name}`,
      notFound: '❎ Result not found!',
      readmore: String.fromCharCode(8206).repeat(4001),
      wait: '⏳ Please wait...',
      error: '❌ Internal Error',
      success: '✅ Success',
      admin: '⚠️ You are not an admin!',
      channelAdmin: '⚠️ I am not an admin!',
      owner: '⚠️ Owner only command!',
      group: '⚠️ Group only command!',
      private: '⚠️ Private chat only command!',
      channel: '⚠️ Channel only command!',
      premium: '⚠️ Premium only!',
      nsfw: '🔞 NSFW disabled!',
      banned: '❌ You are banned!',
      gamerestrict: '🎮 Game restricted!',
      privatePremiumOnly: '💎 Premium only feature!',
      groupPremiumOnly: '💎 Group premium only!',
      urlInvalid: '🔗 Invalid URL provided!',
      channelGroupMembership: '🚫 You must join our official group first!',
      groupSewa: '🔒 This group is not registered for full access!',
      unavailableAtNight: '😴 The channel is sleeping, try again tomorrow!',
      coin: '🪙 Not enough coins!',
      restrict: '⚠️ This command is restricted in this chat!',
    };
  }

  /**
   * Getter for system-level configuration.
   */
  public get system() {
    return {
      ...this.config.system,
      requireChannelGroupMembership: this.get('system.requireChannelGroupMembership'),
      requireGroupSewa: this.get('REQUIRE_GROUP_SEWA'),
      unavailableAtNight: this.get('UNAVAILABLE_AT_NIGHT'),
      privatePremiumOnly: this.get('PRIVATE_PREMIUM_ONLY'),
      restrict: this.get('RESTRICT_COMMANDS'),
      useCoin: this.get('USE_COIN')
    };
  }

  /**
   * Getter for AI-related configuration.
   */
  public get ai() {
    return {
      ...this.config.ai,
      geminiKey: this.config.ai.google.apiKey,
      metaKey: this.get('META_AI_KEY'),
      gemini: {
        model: this.config.ai.google.model,
        generationConfig: {
          temperature: this.config.ai.google.temperature,
          maxOutputTokens: this.config.ai.google.maxTokens,
        }
      },
      memory: {
        maxSize: this.get('AI_MEMORY_MAX_SIZE'),
        ttl: this.get('AI_MEMORY_TTL'),
        cleanupInterval: this.get('AI_MEMORY_CLEANUP_INTERVAL'),
      }
    };
  }

  /**
   * Getter for server-level configuration.
   */
  public get server() {
    return this.config.server;
  }
}

// Export singleton instance and a global config constant
export const configService = ConfigService.getInstance();
export const config = configService; // Alias for easier access
export default configService;
