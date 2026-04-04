import { describe, it, expect } from 'vitest';
import { convertLidToJid, isLid } from './identity.js';

describe('Identity Utility (LID Mapping)', () => {
  it('should detect LID correctly', () => {
    expect(isLid('12345@lid')).toBe(true);
    expect(isLid('123456789@s.whatsapp.net')).toBe(false);
    expect(isLid('group_123@g.us')).toBe(false);
  });

  it('should return original string if no bot instance is provided for LID mapping', async () => {
    const lid = 'lid_123@s.whatsapp.net'; // Normally LIDs are @lid, but this is testing the fallback

    // Without bot, the utility should at least return the input if no mapping
    expect(await convertLidToJid(lid)).toBe(lid);
    expect(await convertLidToJid('12345@lid')).toBe('12345@lid');
  });

  it('should handle undefined/null jids gracefully', async () => {
    expect(await convertLidToJid(undefined)).toBe(undefined);
    expect(await convertLidToJid(null)).toBe(null);
  });
});
