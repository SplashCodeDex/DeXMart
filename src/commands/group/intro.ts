import { MessageContext } from '../../types/index.js';
export default {
  name: 'intro',
  category: 'group',
  permissions: {
    channelAdmin: true,
    group: true,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, database: db } = ctx.channel.context;
    try {
      const groupId = ctx.getId(ctx.id);
      const introText =
        (await db.get(`group.${groupId}.text.intro`)) ||
        formatter.quote('❎ Grup ini tidak memiliki intro.');

      await ctx.reply(introText);
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error);
    }
  },
};
