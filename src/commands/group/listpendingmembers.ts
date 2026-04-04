import { MessageContext } from '../../types/index.js';
export default {
  name: 'listpendingmembers',
  aliases: ['pendingmembers'],
  category: 'group',
  permissions: {
    admin: true,
    channelAdmin: true,
    group: true,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config } = ctx.channel.context;
    const pending = await ctx.group().pendingMembers();

    if (!pending || pending.length === 0)
      return await ctx.reply(formatter.quote('✅ Tidak ada anggota yang menunggu persetujuan.'));

    try {
      const resultText = pending
        .map((member, index) => {
          const id = ctx.getId(member.jid);
          return formatter.quote(`${index + 1}. ${id}`);
        })
        .join('\n');

      await ctx.reply({
        text: resultText,
        footer: config.msg.footer,
      });
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error);
    }
  },
};
