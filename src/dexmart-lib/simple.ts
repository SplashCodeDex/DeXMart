import { jidDecode, downloadContentFromMessage, getContentType, proto } from 'baileys';
import { isLid, convertLidToJidSync } from './identity.js';

interface JidDecodeResult {
  user: string;
  server: string;
  domainType?: number;
}

export const decodeJid = (jid: string | null | undefined): string | null | undefined => {
  if (!jid) return jid;
  if (/:\d+@/gi.test(jid)) {
    const decode = jidDecode(jid) as JidDecodeResult | undefined;
    if (decode && decode.user && decode.server) {
      return `${decode.user}@${decode.server}`;
    }
  }
  return jid;
};

export const serialize = (bot: any, m: any) => {
  if (!m) return m;
  const M: any = {};
  if (m.key) {
    M.key = m.key;
    M.id = m.key.id;
    M.isBaileys = M.id.startsWith('BAE5') && M.id.length === 16;
    M.chat = m.key.remoteJid;
    M.fromMe = m.key.fromMe;
    M.isGroup = M.chat.endsWith('@g.us');
    M.sender = M.fromMe ? bot.user?.id : M.isGroup ? m.key.participant : M.chat;
    if (M.sender) M.sender = decodeJid(M.sender);

    // 2026 Mastermind: Handle LID normalization and PN Resolution
    if (M.sender && isLid(M.sender)) M.sender = convertLidToJidSync(M.sender, bot);
    if (M.chat && isLid(M.chat)) M.chat = convertLidToJidSync(M.chat, bot);
  }

  if (m.message) {
    M.message = m.message;
    M.type = getContentType(m.message) || Object.keys(m.message)[0];
    M.msg = m.message[M.type];

    // Alias for compatibility
    M.contentType = M.type;

    // Handle ephemeral/view once messages
    if (['viewOnceMessage', 'viewOnceMessageV2'].includes(M.type)) {
      M.msg = m.message[M.type].message[getContentType(m.message[M.type].message)!];
      M.type = getContentType(m.message[M.type].message);
      M.contentType = M.type;
    }

    // Text extraction
    M.text =
      M.msg?.text ||
      M.msg?.caption ||
      M.msg?.conversation ||
      M.msg?.contentText ||
      M.msg?.selectedDisplayText ||
      M.msg?.title ||
      '';

    // Quoted message handling
    M.quoted = M.msg?.contextInfo?.quotedMessage ? {} : null;
    if (M.quoted) {
      const type = getContentType(M.msg.contextInfo.quotedMessage)!;
      M.quoted.message = M.msg.contextInfo.quotedMessage;
      M.quoted.key = {
        remoteJid: M.msg.contextInfo.remoteJid || M.chat,
        fromMe: M.msg.contextInfo.participant === (bot.user ? bot.user.id : bot.decodeJid(bot.user.id)), // Safeguard approach
        id: M.msg.contextInfo.stanzaId,
        participant: decodeJid(M.msg.contextInfo.participant),
      };
      M.quoted.type = type;
      M.quoted.id = M.msg.contextInfo.stanzaId;
      M.quoted.chat = M.quoted.key.remoteJid;
      M.quoted.sender = M.quoted.key.participant;
      if (M.quoted.sender && isLid(M.quoted.sender)) M.quoted.sender = decodeJid(M.quoted.sender);
      M.quoted.fromMe = M.quoted.key.fromMe;
      M.quoted.text =
        M.quoted.message[type]?.text ||
        M.quoted.message[type]?.caption ||
        M.quoted.message[type]?.conversation ||
        M.quoted.message[type]?.contentText ||
        M.quoted.message[type]?.selectedDisplayText ||
        M.quoted.message[type]?.title ||
        '';
      M.quoted.isBaileys = M.quoted.id
        ? M.quoted.id.startsWith('BAE5') && M.quoted.id.length === 16
        : false;

      // Helper: Download Quoted Media
      M.quoted.download = async () => {
        const stream = await downloadContentFromMessage(
          M.quoted.message[M.quoted.type],
          M.quoted.type.replace('Message', '') as any
        );
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
      };
    }
  }

  // Helper: Reply
  M.reply = async (text: string, options: any = {}) => {
    return await bot.sendMessage(M.chat, { text, ...options }, { quoted: m });
  };

  // Helper: React
  M.react = async (emoji: string) => {
    return await bot.sendMessage(M.chat, {
      react: {
        text: emoji,
        key: M.key,
      },
    });
  };

  // Helper: Download Media
  M.download = async () => {
    if (!M.msg) throw new Error('No message content to download');
    const stream = await downloadContentFromMessage(M.msg, M.type.replace('Message', '') as any);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
  };

  // Helper: Copy & Forward
  M.copyNForward = async (jid: string, forceForward = false, options: any = {}) => {
    let vtype;
    if (options.readViewOnce) {
      M.message[M.type].viewOnce = false;
      if (M.message[M.type].message && getContentType(M.message[M.type].message)) {
        M.message[M.type].message[getContentType(M.message[M.type].message)!].viewOnce = false;
      }
      vtype = Object.keys(M.message[M.type].message || {})[0];
      if (vtype) {
        delete M.message[M.type].message[vtype].viewOnce;
        M.message[M.type].message[vtype].viewOnce = false;
      }
    }
    const mtype = getContentType(M.message);
    if (!mtype) return;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const content = M.message[mtype];

    // Basic forward implementation using Baileys built-in if available, or manual copy
    return await bot.sendMessage(jid, { forward: m, force: forceForward, ...options });
  };

  return M;
};

export default { serialize, decodeJid };
