import { describe, it, expect } from 'vitest';
// @ts-ignore - File doesn't exist yet
import { CommonMessageSchema, CommonAttachmentSchema } from './omnichannel';

describe('Omnichannel Common Interface', () => {
  describe('CommonAttachmentSchema', () => {
    it('should validate a valid image attachment', () => {
      const attachment = {
        type: 'image',
        url: 'https://example.com/image.png',
        mimeType: 'image/png',
        name: 'test.png'
      };
      const result = CommonAttachmentSchema.safeParse(attachment);
      expect(result.success).toBe(true);
    });

    it('should validate a document attachment', () => {
      const attachment = {
        type: 'document',
        url: 'https://example.com/doc.pdf',
        mimeType: 'application/pdf',
        name: 'test.pdf'
      };
      const result = CommonAttachmentSchema.safeParse(attachment);
      expect(result.success).toBe(true);
    });
  });

  describe('CommonMessageSchema', () => {
    it('should validate a simple text message', () => {
      const message = {
        id: 'msg_123',
        platform: 'whatsapp',
        from: 'user_123',
        to: 'bot_123',
        content: {
          text: 'Hello Mastermind!'
        },
        timestamp: Date.now()
      };
      const result = CommonMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should validate a message with attachments', () => {
      const message = {
        id: 'msg_456',
        platform: 'telegram',
        from: 'user_456',
        to: 'bot_456',
        content: {
          text: 'Here is a file',
          attachments: [
            {
              type: 'image',
              url: 'https://example.com/photo.jpg',
              mimeType: 'image/jpeg'
            }
          ]
        },
        timestamp: Date.now()
      };
      const result = CommonMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should require a platform and content', () => {
      const invalidMessage = {
        id: 'msg_789',
        from: 'user_789'
      };
      const result = CommonMessageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });
  });
});
