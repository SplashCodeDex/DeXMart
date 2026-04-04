
/**
 * Command utilities
 */

type FlagOptions = {
    [key: string]: {
        type: 'boolean' | 'value';
        key: string;
        validator?: (val: string) => boolean;
        parser?: (val: string) => unknown;
    };
};

/**
 * Parses flags from arguments
 * @param args - The argument string
 * @param options - Flag configuration definition
 */
export const parseFlag = (args: string | null | undefined, options: FlagOptions): Record<string, unknown> & { input: string } => {
    if (!args) return { input: '' };
    const result: Record<string, unknown> & { input: string } = { input: args };
    const argsArray = args.split(' ');

    const keysToRemove: number[] = [];

    for (const [flag, config] of Object.entries(options)) {
        const index = argsArray.indexOf(flag);
        if (index !== -1) {
            if (config.type === 'boolean') {
                result[config.key] = true;
                keysToRemove.push(index);
            } else if (config.type === 'value') {
                const value = argsArray[index + 1];
                if (value) {
                    if (config.validator && !config.validator(value)) {
                        continue;
                    }
                    result[config.key] = config.parser ? config.parser(value) : value;
                    keysToRemove.push(index); // flag
                    keysToRemove.push(index + 1); // value
                }
            }
        }
    }

    // Sort descending to remove back-to-front
    keysToRemove.sort((a, b) => b - a);
    for (const idx of keysToRemove) {
        argsArray.splice(idx, 1);
    }

    result.input = argsArray.join(' ').trim();
    return result;
};

import logger from '../utils/logger.js';
import { MessageContext } from '../types/index.js';
import GeminiService from '../services/gemini.js';

export const isOwner = (owners: string[], senderId: string, ...args: any[]) => {
    return owners.includes(senderId);
};

export const handleError = async (ctx: MessageContext, error: unknown, reply: boolean = true, ...args: any[]) => {
    const { formatter } = ctx.channel.context;
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Command Execution Error:', {
        command: ctx.command,
        user: ctx.sender.jid,
        error: err.message,
        stack: err.stack
    });
    if (reply) {
        await ctx.reply(formatter.quote(`An error occurred: ${err.message}`));
    }
};

// AUDIT-INTENTIONAL(#20): This builds a WhatsApp quoted-message structure for AI replies.
// 'META_AI_MOCK' is a sentinel ID so downstream code can distinguish AI-generated quotes
// from real user quotes. 'status@broadcast' is a standard WhatsApp system JID.
// This is NOT test/mock data — it's a protocol-level utility.
export const fakeMetaAiQuotedText = (text: string) => {
    return {
        key: {
            remoteJid: 'status@broadcast',
            fromMe: false,
            id: 'META_AI_MOCK',
        },
        message: {
            conversation: text,
        },
        pushName: 'Meta AI',
    };
};

export const isUrl = (url: string) => {
    return url.match(
        new RegExp(
            /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/,
            'gi'
        )
    );
};

export const checkQuotedMedia = (type: string | undefined, expectedTypes: string | string[]) => {
    if (!type) return false;
    const types = Array.isArray(expectedTypes) ? expectedTypes : [expectedTypes];
    return types.some(t => type.toLowerCase().includes(t.toLowerCase()));
};

export const checkMedia = (type: string | undefined, expectedTypes: string | string[]) => {
    if (!type) return false;
    const types = Array.isArray(expectedTypes) ? expectedTypes : [expectedTypes];
    return types.some(t => type.toLowerCase().includes(t.toLowerCase()));
};

export const getRandomElement = <T>(arr: T[]): T => {
    if (!Array.isArray(arr) || arr.length === 0) return undefined as any;
    return arr[Math.floor(Math.random() * arr.length)];
};

export const translate = async (text: string, lang: string = 'id'): Promise<string> => {
    try {
        const geminiService = new GeminiService();
        const prompt = `Translate the following text to ${lang}. Return ONLY the direct translation, with no extra conversational filler, formatting, or surrounding quotes.\n\nText: ${text}`;

        const response = await geminiService.getChatCompletion(prompt);
        return response ? response.trim() : text;
    } catch (error) {
        logger.error('Translation failed, falling back to original text', { error });
        return text;
    }
};
