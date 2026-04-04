import { MessageContext } from '../../types/index.js';
import { handleWelcome } from '../../events/handler.js';

export default {
  name: 'simulate',
  category: 'group',
  permissions: {
    channelAdmin: true,
    group: true,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools } = ctx.channel.context;
    const input = ctx.args.join(' ') || null;

    if (!input)
      return await ctx.reply(
        `${formatter.quote(tools.msg.generateInstruction(['send'], ['text']))}\n` +
        `${formatter.quote(tools.msg.generateCmdExample(ctx.used, 'join'))}\n${formatter.quote(
          tools.msg.generateNotes([
            `Selain ${formatter.inlineCode('join')}, gunakan ${formatter.inlineCode('leave')} untuk mensimulasikan keluar dari grup.`,
          ])
        )}`
      );

    try {
      const m = {
        id: ctx.id,
        participants: [ctx.sender.jid],
      };

      switch (input.toLowerCase()) {
        case 'j':
        case 'join':
          await handleWelcome(ctx, m, 'add', true);
          break;
        case 'l':
        case 'leave':
          await handleWelcome(ctx, m, 'remove', true);
          break;
        default:
          await ctx.reply(
            formatter.quote(`❎ Simulasi ${formatter.inlineCode(input)} tidak valid!`)
          );
      }
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error);
    }
  },
};
