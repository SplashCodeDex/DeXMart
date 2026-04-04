import { MessageContext } from '../../types/index.js';
export default {
  name: 'setmaxwarnings',
  category: 'group',
  permissions: {
    admin: true,
    channelAdmin: true,
    group: true,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, database: db } = ctx.channel.context;
    const input = parseInt(ctx.args[0], 10) || null;

    if (!input)
      return await ctx.reply(
        `${formatter.quote(tools.msg.generateInstruction(['send'], ['text']))}\n${formatter.quote(
          tools.msg.generateCmdExample(ctx.used, '8')
        )}`
      );

    try {
      const groupId = ctx.getId(ctx.id);
      await db.set(`group.${groupId}.maxwarnings`, input);

      await ctx.reply(formatter.quote(`✅ Berhasil mengubah max warnings!`));
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error);
    }
  },
};
