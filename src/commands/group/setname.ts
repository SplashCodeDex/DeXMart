import { MessageContext } from '../../types/index.js';
export default {
  name: 'setname',
  category: 'group',
  permissions: {
    admin: true,
    channelAdmin: true,
    group: true,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools } = ctx.channel.context;
    const input = ctx.args.join(' ') || null;

    if (!input)
      return await ctx.reply(
        `${formatter.quote(tools.msg.generateInstruction(['send'], ['text']))}\n${formatter.quote(
          tools.msg.generateCmdExample(ctx.used, 'DeXMart')
        )}`
      );

    try {
      await ctx.group().updateSubject(input);

      await ctx.reply(formatter.quote('✅ Successfully changed the group name!'));
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error);
    }
  },
};
