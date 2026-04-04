import { proto } from 'baileys';

/**
 * Ensures a string is a valid WhatsApp JID
 */
const getJid = (input: string): string => {
  if (
    input.endsWith('@s.whatsapp.net') ||
    input.endsWith('@g.us') ||
    input.endsWith('@lid') ||
    input.endsWith('@hosted.lid')
  ) {
    return input;
  }
  return `${input.replace(/[^\d]/g, '')}@s.whatsapp.net`;
};

/**
 * Extracts the sender JID from a message
 */
const getSender = (msg: proto.IWebMessageInfo): string => {
  if (!msg.key) return '';
  if (msg.key.fromMe) return getJid(msg.key.remoteJid!);
  const participant = msg.key.participant || msg.key.remoteJid;
  return getJid(participant!);
};

/**
 * Extracts the group JID if the message is from a group
 */
const getGroup = (msg: proto.IWebMessageInfo): string | null => {
  if (!msg.key) return null;
  const remoteJid = msg.key.remoteJid || '';
  return remoteJid.endsWith('@g.us') ? remoteJid : null;
};

export { getJid, getSender, getGroup };
