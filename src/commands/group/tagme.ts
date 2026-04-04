import { MessageContext } from '../../types/index.js';
export default {
  name: 'tagme',
  category: 'group',
  permissions: {
    group: true,
  },
  code: async (ctx: MessageContext) => {
    await ctx.reply({
      text: `@${ctx.getId(ctx.sender.jid)}`,
      mentions: [ctx.sender.jid],
    });
  },
};
