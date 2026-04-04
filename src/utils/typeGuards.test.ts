import { describe, it, expect } from 'vitest';
import { isCommonMessage, isBaileysMessage } from './typeGuards.js';
import { CommonMessage } from '../types/omnichannel.js';

describe('Type Guards', () => {
    describe('isCommonMessage', () => {
        it('should return true for a valid CommonMessage', () => {
            const msg: CommonMessage = {
                id: '123',
                platform: 'telegram',
                from: 'user1',
                to: 'bot1',
                content: { text: 'hello' },
                timestamp: Date.now()
            };
            expect(isCommonMessage(msg)).toBe(true);
        });

        it('should return false for a Baileys message', () => {
            const msg = {
                key: { remoteJid: '123@s.whatsapp.net', fromMe: false, id: 'ABC' },
                message: { conversation: 'hello' }
            };
            expect(isCommonMessage(msg)).toBe(false);
        });
    });

    describe('isBaileysMessage', () => {
        it('should return true for a Baileys message', () => {
            const msg = {
                key: { remoteJid: '123@s.whatsapp.net', fromMe: false, id: 'ABC' },
                message: { conversation: 'hello' }
            };
            expect(isBaileysMessage(msg)).toBe(true);
        });

        it('should return false for a CommonMessage', () => {
            const msg: CommonMessage = {
                id: '123',
                platform: 'telegram',
                from: 'user1',
                to: 'bot1',
                content: { text: 'hello' },
                timestamp: Date.now()
            };
            expect(isBaileysMessage(msg)).toBe(false);
        });
    });
});
