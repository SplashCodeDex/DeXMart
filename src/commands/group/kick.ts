import { MessageContext } from '../../types/index.js';

export default {
  name: 'kick',
  aliases: ['dor', 'remove'],
  category: 'group',
  permissions: {
    admin: true,
    channelAdmin: true,
    group: true
  },
  code: async (ctx: MessageContext) => {
    const { formatter } = ctx.channel.context;

    // Resolve target JID from quoted message or mentions
    const mentions = ctx.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quotedJid = ctx.msg.message?.extendedTextMessage?.contextInfo?.participant;
    const accountJid = quotedJid || mentions[0] || null;

    if (!accountJid) {
      return await ctx.reply(formatter.quote('⚠️ Please reply to a user or mention them to kick.'));
    }

    // Check if target is owner (safety check)
    // Note: ctx.group() creates functions scoped to the sender, so isOwner() checks if sender is owner
    // We need to check if the TARGET is owner.
    // GroupFunctions interface has `owner(): Promise<string | null>`
    const groupOwner = await ctx.group().owner();
    if (groupOwner === accountJid) {
      return await ctx.reply(formatter.quote('❎ Cannot kick the group owner!'));
    }

    try {
      await ctx.group().kick([accountJid]);
      await ctx.reply(formatter.quote('✅ User kicked successfully!'));
    } catch (error: unknown) {
      const err = error instanceof Error ? error.message : String(error);
      ctx.channel.context.logger.error('Kick command failed', { error: err });
      await ctx.reply(formatter.quote(`❌ Failed to kick user: ${err}`));
    }
  },
};
