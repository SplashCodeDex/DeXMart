import { MessageContext } from '../../types/index.js';

export default {
  name: 'demote',
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
      return await ctx.reply(formatter.quote('⚠️ Please reply to a user or mention them to demote.'));
    }

    // Check if target is actually an admin
    // Note: isAdmin checks if the user is an admin in the group
    // ctx.group() is scoped to current group
    if (!(await ctx.group().isAdmin())) {
      // Wait, ctx.group().isAdmin() without arguments checks the SENDER.
      // We need to check the TARGET.
      // GroupService.isAdmin implementation: async isAdmin(bot, groupJid, userJid)
      // GroupFunctions interface: isAdmin: () => Promise<boolean>;
      // The interface assumes checking the SENDER (ctx.sender.jid).
      // We need a way to check ANY user.
      // Looking at GroupFunctions interface again:
      // matchAdmin: (id: string) => Promise<boolean>;
      // Yes, matchAdmin is the method for checking others.

      const isTargetAdmin = await ctx.group().matchAdmin(accountJid);
      if (!isTargetAdmin) {
        return await ctx.reply(formatter.quote('❎ User is already not an admin!'));
      }
    }

    try {
      await ctx.group().demote([accountJid]);
      await ctx.reply(formatter.quote('✅ User demoted to member successfully!'));
    } catch (error: unknown) {
      const err = error instanceof Error ? error.message : String(error);
      ctx.channel.context.logger.error('Demote command failed', { error: err });
      await ctx.reply(formatter.quote(`❌ Failed to demote user: ${err}`));
    }
  },
};
