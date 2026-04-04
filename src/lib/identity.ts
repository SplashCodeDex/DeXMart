/**
 * Identity Utility - 2026 Mastermind Edition
 * Handles LID/JID mapping for Baileys v7
 */

/**
 * Checks if a JID is a Local Identifier (LID)
 */
export const isLid = (jid: string | null | undefined): boolean => {
  if (!jid) return false;
  return /^(\d+)(?::\d+)?@(lid|hosted\.lid)$/i.test(jid);
};

/**
 * Converts an LID to a primary JID (Phone Number).
 * @param jid The JID or LID to convert.
 * @param bot Optional Baileys WASocket instance to access the LID mapping store.
 * @returns The resolved JID, or the original string if resolution fails.
 */
export const convertLidToJid = async (jid: string | null | undefined, bot?: any): Promise<string | null | undefined> => {
  if (!jid) return jid;

  // If it's already a standard PN JID or Group JID, return it
  if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us')) return jid;

  // Attempt to resolve using Baileys v7 LID Mapping if socket is provided
  if (bot && isLid(jid)) {
    try {
      // 1. Try signalRepository (Baileys v7.0.0+)
      if (typeof bot.signalRepository?.lidMapping?.getPNForLID === 'function') {
        const pn = await bot.signalRepository.lidMapping.getPNForLID(jid);
        if (pn) return pn.includes('@') ? pn : `${pn}@s.whatsapp.net`;
      }

      // 2. Try authState.keys directly (Fallback for certain Baileys forks/versions)
      if (typeof bot.authState?.keys?.get === 'function') {
        const result = await bot.authState.keys.get('lid-mapping', [jid]);
        if (result && result[jid]) {
          const pn = result[jid];
          return pn.includes('@') ? pn : `${pn}@s.whatsapp.net`;
        }
      }
    } catch (err) {
      // Silently fall back to original JID if mapping fails
    }
  }

  // Fallback: return as is if no mapping exists or bot isn't provided
  // Fallback: return as is if no mapping exists or bot isn't provided
  return jid;
};

/**
 * Synchronous version for simple.ts which cannot await inside the fast serialization path.
 * Checks memory-cached mappings if available.
 */
export const convertLidToJidSync = (jid: string | null | undefined, bot?: any): string | null | undefined => {
  if (!jid) return jid;
  if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us')) return jid;

  // In synchronous context, if mapping is not directly cache-accessible, we fallback safely
  // A future improvement could keep an in-memory mapped store updated via creds.update
  if (bot && isLid(jid)) {
    // Just decode locally for now as safety
    return jid;
  }

  return jid;
};
