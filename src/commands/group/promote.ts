import { MessageContext } from '../../types/index.js';
export default {
  name: 'promote',
  category: 'group',
  permissions: {
    admin: true,
    channelAdmin: true,
    group: true,
  },
  code: async (ctx: MessageContext) => {
    const { formatter } = ctx.channel.context;

    // Resolve target JID from quoted message or mentions
    const mentions = ctx.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quotedJid = ctx.msg.message?.extendedTextMessage?.contextInfo?.participant;
    const accountJid = quotedJid || mentions[0] || null;

    if (!accountJid) {
      return await ctx.reply(formatter.quote('⚠️ Please reply to a user or mention them to promote.'));
    }

    // Check if target is owner via direct metadata check
    const groupOwner = await ctx.group().owner();
    if (groupOwner === accountJid) {
      return await ctx.reply(formatter.quote('❎ Only the owner can be demoted by no one!'));
    }

    try {
      await ctx.group().promote([accountJid]);
      await ctx.reply(formatter.quote('✅ User promoted to admin successfully!'));
    } catch (error: unknown) {
      const err = error instanceof Error ? error.message : String(error);
      ctx.channel.context.logger.error('Promote command failed', { error: err });
      await ctx.reply(formatter.quote(`❌ Failed to promote user: ${err} `));
    }
  },
};
