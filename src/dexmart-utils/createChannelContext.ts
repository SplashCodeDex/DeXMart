import { db } from '../lib/firebase.js';
import { downloadContentFromMessage, getContentType, type proto } from 'baileys';
import { getJid, getSender, getGroup } from './baileysUtils.js';
import { isLid, convertLidToJid } from '../lib/identity.js';
import type { ActiveChannel, GlobalContext, MessageContext } from '../types/index.js';
import type { TenantSettings } from '../types/tenantConfig.js';
import type { CommonMessage } from '../types/omnichannel.js';
import { DeliberationService } from './deliberation.js';

/**
 * Unified Context Builder
 *
 * Creates a standard MessageContext from either a legacy Baileys message
 * or a modern platform-agnostic CommonMessage.
 */
const createChannelContext = async (
  channelInstance: ActiveChannel,
  messageSource: proto.IWebMessageInfo | CommonMessage,
  originalContext: GlobalContext,
  requestInfo: any = {}
): Promise<MessageContext> => {
  const { tools, config } = originalContext;

  // Determine message type
  const isCommonMessage = (msg: any): msg is CommonMessage => 'platform' in msg;

  let senderJid: string;
  let remoteJid: string;
  let isGroup: boolean;
  let groupId: string | undefined;
  let messageBody: string;
  let pushName: string | null = null;

  if (isCommonMessage(messageSource)) {
    senderJid = messageSource.from;
    remoteJid = messageSource.to; // In common message, 'to' is the destination (could be group or user)
    // For now we assume if 'to' ends with @g.us or similar platform specific group patterns
    isGroup = messageSource.metadata?.isGroup || false;
    groupId = isGroup ? remoteJid : undefined;
    messageBody = messageSource.content.text || '';
    pushName = messageSource.metadata?.pushName || 'User';
  } else {
    senderJid = getSender(messageSource);
    
    // Resolve LID to phone-number JID if possible
    if (isLid(senderJid)) {
      const resolved = await convertLidToJid(senderJid, channelInstance);
      if (resolved) senderJid = resolved;
    }

    remoteJid = messageSource.key?.remoteJid || '';
    isGroup = remoteJid.endsWith('@g.us');
    groupId = getGroup(messageSource) || undefined;
    messageBody = messageSource.message?.conversation ||
      messageSource.message?.extendedTextMessage?.text || '';
    pushName = messageSource.pushName || null;
  }

  const senderId = senderJid;
  const useDirectBaileys = (process.env.USE_BAILEYS_DIRECT === 'true' || process.env.NODE_ENV === 'production') && channelInstance.channelId.startsWith('wa_');

  // Fetch tenant settings strictly
  const tenantResult = await originalContext.tenantConfigService.getTenantSettings(channelInstance.tenantId);
  if (!tenantResult.success) {
    originalContext.logger.error(`Failed to load tenant settings for ${channelInstance.tenantId}`, tenantResult.error);
    throw new Error('Failed to load tenant configuration');
  }
  const tenantSettings: TenantSettings = tenantResult.data;

  // Surgical Migration: Resolve Agent-Channel Configuration
  const resolvedResult = await originalContext.tenantConfigService.resolveAgentChannelConfig(channelInstance.tenantId, channelInstance.channelId);
  if (resolvedResult.success) {
    channelInstance.config = resolvedResult.data;
  }

  // Unified Reply
  const reply = async (content: any) => {
    const messageContent = typeof content === 'string' ? { text: content } : content;

    // If it's a running adapter in memory, use its sendMessage
    if (channelInstance?.sendMessage) {
      return await channelInstance.sendMessage(remoteJid, messageContent, { quoted: !isCommonMessage(messageSource) ? messageSource : undefined });
    }

    // Fallback: If no direct adapter, could use a global send message utility
    originalContext.logger.warn(`[createChannelContext] No direct adapter found for reply on ${channelInstance.channelId}`);
  };

  const replyReact = async (emoji: string) => {
    if (channelInstance?.sendMessage) {
      return await channelInstance.sendMessage(remoteJid, { react: { text: emoji, key: !isCommonMessage(messageSource) ? messageSource.key : undefined } });
    }
  };

  const simulateTyping = async (text?: string | number) => {
    if (channelInstance?.sendPresenceUpdate) {
      try {
        await channelInstance.sendPresenceUpdate('composing', remoteJid);

        let delay = 1500;
        if (typeof text === 'string') {
          delay = DeliberationService.getTypingDelay(text);
        } else if (typeof text === 'number') {
          delay = text;
        } else {
          delay = DeliberationService.getThinkingJitter();
        }

        setTimeout(() => channelInstance.sendPresenceUpdate?.('paused', remoteJid).catch(() => { }), delay);
      } catch (_) { /* ignore */ }
    } else if (isCommonMessage(messageSource) && messageSource.metadata?.simulateTyping) {
      // Support metadata-driven simulation if provided by adapter
      await messageSource.metadata.simulateTyping(text);
    }
  };

  const sendPresenceUpdate = async (presence: any, jid: string = remoteJid) => {
    if (channelInstance?.sendPresenceUpdate) {
      try {
        await channelInstance.sendPresenceUpdate(presence, jid);
      } catch (_) { /* ignore */ }
    } else if (isCommonMessage(messageSource) && messageSource.metadata?.sendPresenceUpdate) {
      await messageSource.metadata.sendPresenceUpdate(presence, jid);
    }
  };

  // Implement ctx.group() methods
  const group = (jid = groupId) => ({
    isAdmin: async (userJid: string = senderId) => {
      if (!jid || !channelInstance.tenantId) return false;
      try {
        const memberSnapshot = await db.collection('tenants').doc(channelInstance.tenantId).collection('groups').doc(jid).collection('members').doc(userJid).get();
        if (memberSnapshot.exists) {
          const role = memberSnapshot.data()?.role;
          return role === 'admin' || role === 'superadmin';
        }
      } catch (e) { }
      return false;
    },
    matchAdmin: async (userJid: string) => {
      if (!jid || !channelInstance.tenantId) return false;
      try {
        const memberSnapshot = await db.collection('tenants').doc(channelInstance.tenantId).collection('groups').doc(jid).collection('members').doc(userJid).get();
        if (memberSnapshot.exists) {
          const role = memberSnapshot.data()?.role;
          return role === 'admin' || role === 'superadmin';
        }
      } catch (e) { }
      return false;
    },
    isActiveChannelAdmin: async () => {
      // Deriving from adapter if available
      return false; // Stub
    },
    isChannelAdmin: async () => {
      return false; // Stub for now, can be linked to isActiveChannelAdmin
    },
    members: async () => {
      if (!jid || !channelInstance.tenantId) return [];
      try {
        const membersSnapshot = await db.collection('tenants').doc(channelInstance.tenantId).collection('groups').doc(jid).collection('members').get();
        return membersSnapshot.docs.map(doc => doc.id);
      } catch (e) { return []; }
    },
    metadata: async () => {
      if (!jid || !channelInstance?.groupMetadata) return null;
      return await channelInstance.groupMetadata(jid);
    },
    owner: async () => {
      if (!jid || !channelInstance?.groupMetadata) return null;
      const meta = await channelInstance.groupMetadata(jid);
      return meta.owner || null;
    },
    name: async () => {
      if (!jid || !channelInstance?.groupMetadata) return '';
      const meta = await channelInstance.groupMetadata(jid);
      return meta.subject || '';
    },
    open: async () => {
      if (!jid || !channelInstance?.groupSettingUpdate) return null;
      return await channelInstance.groupSettingUpdate(jid, 'not_announcement');
    },
    close: async () => {
      if (!jid || !channelInstance?.groupSettingUpdate) return null;
      return await channelInstance.groupSettingUpdate(jid, 'announcement');
    },
    unlock: async () => {
      if (!jid || !channelInstance?.groupSettingUpdate) return null;
      return await channelInstance.groupSettingUpdate(jid, 'unlocked');
    },
    lock: async () => {
      if (!jid || !channelInstance?.groupSettingUpdate) return null;
      return await channelInstance.groupSettingUpdate(jid, 'locked');
    },
    add: async (jids: string[]) => {
      if (!jid || !channelInstance?.groupParticipantsUpdate) return null;
      return await channelInstance.groupParticipantsUpdate(jid, jids, 'add');
    },
    kick: async (jids: string[]) => {
      if (!jid || !channelInstance?.groupParticipantsUpdate) return null;
      return await channelInstance.groupParticipantsUpdate(jid, jids, 'remove');
    },
    promote: async (jids: string[]) => {
      if (!jid || !channelInstance?.groupParticipantsUpdate) return null;
      return await channelInstance.groupParticipantsUpdate(jid, jids, 'promote');
    },
    demote: async (jids: string[]) => {
      if (!jid || !channelInstance?.groupParticipantsUpdate) return null;
      return await channelInstance.groupParticipantsUpdate(jid, jids, 'demote');
    },
    inviteCode: async () => {
      if (!jid || !channelInstance?.groupInviteCode) return '';
      return await channelInstance.groupInviteCode(jid) || '';
    },
    pendingMembers: async () => [],
    approvePendingMembers: async (jids: string[]) => null,
    rejectPendingMembers: async (jids: string[]) => null,
    updateDescription: async (desc: string) => {
      if (!jid || !channelInstance?.groupUpdateDescription) return null;
      return await channelInstance.groupUpdateDescription(jid, desc);
    },
    updateSubject: async (subject: string) => {
      if (!jid || !channelInstance?.groupUpdateSubject) return null;
      return await channelInstance.groupUpdateSubject(jid, subject);
    },
    joinApproval: async (mode: 'on' | 'off') => {
      if (!jid || !channelInstance?.groupJoinApprovalMode) return null;
      return await channelInstance.groupJoinApprovalMode(jid, mode);
    },
    membersCanAddMemberMode: async (mode: any) => {
      if (!jid || !channelInstance?.groupMemberAddMode) return null;
      const val = mode === 'on' ? 'all_member_add' : 'admin_add';
      return await channelInstance.groupMemberAddMode(jid, val);
    },
    isOwner: async (userJid: string = senderId) => {
      if (!jid || !channelInstance.tenantId || !channelInstance.groupMetadata) return false;
      const meta = await channelInstance.groupMetadata(jid);
      return meta.owner === userJid;
    }
  });

  // Determine the prefix to use
  const prefixes = channelInstance.config?.prefix || [config.channel.prefix];

  let detectedPrefix = '';
  for (const p of prefixes) {
    if (messageBody.startsWith(p)) {
      detectedPrefix = p;
      break;
    }
  }

  // Handle Auto Read if configured (WhatsApp only)
  if (!isCommonMessage(messageSource) && channelInstance.config?.autoRead && messageSource.key?.remoteJid && channelInstance.readMessages) {
    channelInstance.readMessages([messageSource.key]).catch(() => { });
  }

  // Command parsing
  const used = {
    command: detectedPrefix ?
      messageBody.split(' ')[0].toLowerCase().substring(detectedPrefix.length) :
      '',
    prefix: detectedPrefix || prefixes[0],
    args: messageBody.split(' ').slice(1) || [],
    text: messageBody,
  };

  // MASTERMIND Intelligence (Phase 5): Pre-fetch relevant context
  let relevantContext: any[] = [];
  try {
    const { memoryService } = await import('../services/memoryService.js');
    const memResult = await memoryService.retrieveRelevantContext(senderId, messageBody, {
      platform: isCommonMessage(messageSource) ? messageSource.platform : 'whatsapp',
      chatId: remoteJid
    });
    if (memResult.success) {
      relevantContext = memResult.data;
    }
  } catch (err) {
    originalContext.logger.warn(`[createChannelContext] Failed to pre-fetch context:`, err);
  }

  // Validate Owner
  const ownerNumber = tenantSettings.ownerNumber || 'system';
  const isOwner = tools.cmd.isOwner([ownerNumber], senderId, !isCommonMessage(messageSource) ? (messageSource.key?.id || '') : messageSource.id);

  const isAdmin = isGroup ? await group().isAdmin(senderId) : false;

  // Extract quoted message if available
  let quotedContext: any = undefined;
  if (!isCommonMessage(messageSource)) {
    const quotedMsg = messageSource.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quotedMsg) {
      quotedContext = {
        content: quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || quotedMsg.imageMessage?.caption || '',
        contentType: getContentType(quotedMsg) || Object.keys(quotedMsg)[0],
        senderJid: messageSource.message?.extendedTextMessage?.contextInfo?.participant || '',
        media: quotedMsg.imageMessage || quotedMsg.videoMessage || quotedMsg.audioMessage || quotedMsg.stickerMessage || quotedMsg.documentMessage,
        key: {
          id: messageSource.message?.extendedTextMessage?.contextInfo?.stanzaId,
          remoteJid: remoteJid,
          participant: messageSource.message?.extendedTextMessage?.contextInfo?.participant
        }
      };
    }
  }

  const ctx = {
    channel: channelInstance,
    core: channelInstance, // Legacy support
    msg: messageSource as any, // Cast to any to satisfy the union type
    message: !isCommonMessage(messageSource) ? messageSource.message : undefined,
    id: groupId || remoteJid,
    isGroup: () => isGroup,
    sender: {
      jid: senderJid,
      name: pushName || 'Unknown',
      pushName: pushName,
      isOwner,
      isAdmin
    },
    getId: (jid: string) => getJid(jid),
    group,
    reply,
    replyReact,
    simulateTyping,
    sendPresenceUpdate,
    used,
    command: used.command,
    prefix: used.prefix,
    args: used.args,
    body: messageBody,
    relevantContext, // Phase 5 Intelligence
    tenant: tenantSettings,
    isOwner,
    isAdmin,
    cooldown: {},
    getContentType: () => {
      if (isCommonMessage(messageSource)) {
        return messageSource.content.attachments?.[0]?.type || 'text';
      }
      return (messageSource.message ? getContentType(messageSource.message) : undefined) || '';
    },
    getBody: () => messageBody,
    getMedia: () => {
      if (isCommonMessage(messageSource)) {
        return messageSource.content.attachments?.[0];
      }
      const type = messageSource.message ? getContentType(messageSource.message) : undefined;
      return type ? (messageSource.message as any)[type] : undefined;
    },
    getPlatform: () => isCommonMessage(messageSource) ? messageSource.platform : 'whatsapp',
    getSenderJid: () => senderJid,
    getQuoted: () => quotedContext as any,
    isFromMe: () => !isCommonMessage(messageSource) ? !!messageSource.key?.fromMe : false,
    sendMessage: async (jid: string, content: any, options: any = {}) => {
      if (channelInstance?.sendMessage) {
        return await channelInstance.sendMessage(jid, content, options);
      }
    },
    download: async () => {
      if (isCommonMessage(messageSource)) {
        // TODO: Implement download for CommonMessage (likely from URL or base64)
        throw new Error('Media download not yet implemented for omnichannel platforms');
      }

      const quotedMsg = messageSource.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const messageToDownload = quotedMsg ?
        { [Object.keys(quotedMsg)[0]]: (quotedMsg as any)[Object.keys(quotedMsg)[0]] } :
        messageSource.message;

      if (!messageToDownload) throw new Error('No media found to download');

      const type = getContentType(messageToDownload);
      if (!type) throw new Error('Could not determine media type');

      const stream = await downloadContentFromMessage(
        (messageToDownload as any)[type],
        type.replace('Message', '') as any
      );

      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }
      return buffer;
    }
  };

  return ctx;
};

export { createChannelContext };
export default createChannelContext;
