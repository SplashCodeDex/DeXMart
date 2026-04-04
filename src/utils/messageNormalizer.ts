import { proto } from 'baileys';
import { CommonMessage } from '../types/omnichannel.js';

/**
 * MessageNormalizer Utility
 *
 * Provides a unified interface to access properties from both Baileys (WhatsApp)
 * and CommonMessage (Omnichannel) message structures.
 *
 * This resolves TS2339 errors where properties like '.key' or '.message'
 * are accessed on the MessageContext.msg union type.
 */
export class MessageNormalizer {
    /**
     * Type guard to check if a message is a Baileys message
     */
    static isBaileys(msg: any): msg is proto.IWebMessageInfo {
        return !!(msg && typeof msg === 'object' && 'key' in msg && msg.key);
    }

    /**
     * Type guard to check if a message is an Omnichannel CommonMessage
     */
    static isCommon(msg: any): msg is CommonMessage {
        return !!(msg && typeof msg === 'object' && 'platform' in msg);
    }

    /**
     * Safely gets the message ID
     */
    static getId(msg: proto.IWebMessageInfo | CommonMessage): string {
        if (this.isBaileys(msg)) return msg.key?.id || '';
        return msg.id;
    }

    /**
     * Safely gets the message text content
     */
    static getText(msg: any): string {
        if (this.isBaileys(msg)) {
            const message = msg.message;
            if (!message) return '';

            // Handle various Baileys message types
            const text = message.conversation ||
                message.extendedTextMessage?.text ||
                message.imageMessage?.caption ||
                message.videoMessage?.caption ||
                '';
            return text;
        }

        if (this.isCommon(msg)) {
            return msg.content.text || '';
        }

        return '';
    }

    /**
     * Safely gets the sender identifier (JID or Platform-specific ID)
     */
    static getSender(msg: proto.IWebMessageInfo | CommonMessage): string {
        if (this.isBaileys(msg)) {
            if (!msg.key) return '';
            // Note: This returns raw JID or LID. Callers must handle LID resolution asynchronously
            // using convertLidToJid if they need the true E.164 identity.
            return msg.key.participant || msg.key.remoteJid || '';
        }
        return msg.from;
    }

    /**
     * Safely gets the timestamp
     */
    static getTimestamp(msg: proto.IWebMessageInfo | CommonMessage): number {
        if (this.isBaileys(msg)) {
            return (Number(msg.messageTimestamp) || 0) * 1000;
        }
        return msg.timestamp;
    }

    /**
     * Access Baileys specific properties safely (with type narrowing)
     */
    static asBaileys(msg: proto.IWebMessageInfo | CommonMessage): proto.IWebMessageInfo | null {
        return this.isBaileys(msg) ? msg : null;
    }

    /**
     * Access CommonMessage specific properties safely (with type narrowing)
     */
    static asCommon(msg: proto.IWebMessageInfo | CommonMessage): CommonMessage | null {
        return this.isCommon(msg) ? msg : null;
    }
}
