import { CommonMessage } from '../../types/omnichannel.js';

export type ChannelId = string;

/**
 * Defines the standardized constructor signature for all ChannelAdapters.
 * This enables the true registry pattern in ChannelService.
 */
export interface ChannelAdapterConstructor {
  new (
    tenantId: string,
    channelId: string,
    fullPath: string | undefined,
    channelData: any // Partial<Channel>
  ): ChannelAdapter;
}

/**
 * ChannelAdapter is the base interface for all messaging channel adapters
 * in DeXMart. It follows the pattern established by OpenClaw but is
 * tailored for DeXMart's multi-tenant architecture.
 */
export interface ChannelAdapter {
  /**
   * Unique identifier for the channel type (e.g., 'whatsapp', 'telegram').
   */
  readonly id: ChannelId;
  readonly status?: string;
  getSocket?(): any;

  /**
   * Optional unique identifier for the specific channel instance.
   */
  readonly instanceId?: string;

  /**
   * Initializes the channel adapter.
   */
  initialize(): Promise<void>;

  /**
   * Shuts down the channel adapter and cleans up resources.
   */
  shutdown(): Promise<void>;

  /**
   * Connects the adapter to its messaging service.
   */
  connect(): Promise<void>;

  /**
   * Disconnects the adapter from its messaging service.
   */
  disconnect(): Promise<void>;

  /**
   * Sends a message through this channel.
   * @param target The recipient identifier (e.g., phone number, username).
   * @param content The message content (text, media, etc.).
   */
  sendMessage(target: string, content: any): Promise<void>;

  /**
   * Sends a standardized common message through this channel.
   * @param message The common message object.
   */
  sendCommon(message: CommonMessage): Promise<void>;

  /**
   * Standardized webhook handler for platforms that use them (Telegram, Discord, etc.).
   */
  handleWebhook?: (req: any, res: any) => Promise<void>;

  /**
   * Registers a handler for inbound messages.
   */
  onMessage(handler: (event: InboundMessageEvent) => Promise<void>): void;

  /**
   * Updates the internal routing path for the adapter.
   * Useful when a channel is moved between agents.
   */
  updatePath?(newPath: string): void;

  /**
   * Sends a reaction to a message.
   */
  sendReaction?(chatJid: string, messageId: string, emoji: string): Promise<void>;

  /**
   * Sends a poll.
   */
  sendPoll?(to: string, question: string, options: string[]): Promise<void>;
}

/**
 * Represents an inbound message from any channel.
 */
export interface InboundMessageEvent {
  tenantId: string;
  channelId: string; // The specific instance ID
  channelType: ChannelId; // 'whatsapp', 'telegram', etc.
  fullPath?: string;
  sender: string;
  content: any;
  timestamp: Date;
  raw: any;
}
