import { describe, it, expect, vi, beforeEach } from 'vitest';
import { translate } from './cmd.js';
import GeminiService from '../services/gemini.js';
import logger from '../utils/logger.js';

// Mock the logger
vi.mock('../utils/logger.js', () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
    }
}));

describe('translate', () => {
    let mockGetChatCompletion: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetChatCompletion = vi.spyOn(GeminiService.prototype, 'getChatCompletion');
    });

    it('should translate text using GeminiService', async () => {
        const textToTranslate = 'Hello world';
        const targetLang = 'id';
        const expectedTranslation = 'Halo dunia';

        mockGetChatCompletion.mockResolvedValueOnce(expectedTranslation);

        const result = await translate(textToTranslate, targetLang);

        expect(result).toBe(expectedTranslation);
        expect(mockGetChatCompletion).toHaveBeenCalledTimes(1);
        expect(mockGetChatCompletion.mock.calls[0][0]).toContain(`Translate the following text to ${targetLang}`);
        expect(mockGetChatCompletion.mock.calls[0][0]).toContain(`Text: ${textToTranslate}`);
    });

    it('should fall back to original text on GeminiService error', async () => {
        const textToTranslate = 'Hello world';
        const targetLang = 'id';

        mockGetChatCompletion.mockRejectedValueOnce(new Error('API Rate Limit'));

        const result = await translate(textToTranslate, targetLang);

        expect(result).toBe(textToTranslate);
        expect(logger.error).toHaveBeenCalled();
        expect(mockGetChatCompletion).toHaveBeenCalledTimes(1);
    });

    it('should trim whitespace from the translation response', async () => {
        const textToTranslate = 'Good morning';

        mockGetChatCompletion.mockResolvedValueOnce(' Selamat pagi \n');

        const result = await translate(textToTranslate, 'id');

        expect(result).toBe('Selamat pagi');
    });
});
