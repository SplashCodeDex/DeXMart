import { MessageContext } from '../../types/index.js';
export default {
  name: 'setdesc',
  category: 'group',
  permissions: {
    admin: true,
    channelAdmin: true,
    group: true,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools } = ctx.channel.context;
    const input = ctx.args.join(' ') || ctx.quoted?.content || null;

    if (!input)
      return await ctx.reply(
        `${formatter.quote(tools.msg.generateInstruction(['send'], ['text']))}\n${formatter.quote(
          tools.msg.generateCmdExample(ctx.used, 'by itsreimau')
        )}`
      );

    try {
      await ctx.group().updateDescription(input);

      await ctx.reply(formatter.quote('✅ Berhasil mengubah deskripsi grup!'));
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error);
    }
  },
};
