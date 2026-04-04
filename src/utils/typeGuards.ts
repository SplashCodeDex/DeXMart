import { CommonMessage } from '../types/omnichannel.js';

/**
 * Type guard to check if a message is a CommonMessage (Omnichannel)
 */
export function isCommonMessage(msg: any): msg is CommonMessage {
    return (
        msg &&
        typeof msg === 'object' &&
        'platform' in msg &&
        'content' in msg &&
        'from' in msg &&
        'to' in msg &&
        !('key' in msg) // Baileys specific
    );
}

/**
 * Type guard to check if a message is a Baileys message (WhatsApp specific)
 */
export function isBaileysMessage(msg: any): msg is any {
    return (
        msg &&
        typeof msg === 'object' &&
        'key' in msg &&
        ('message' in msg || 'type' in msg)
    );
}
