import { MessageContext } from '../../types/index.js';
export default {
  name: 'bluearchivelogo',
  aliases: ['balogo'],
  category: 'maker',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config } = ctx.channel.context;
    const input = ctx.args.join(' ') || null;

    if (!input)
      return await ctx.reply(
        `${formatter.quote(tools.msg.generateInstruction(['send'], ['text']))}\n${formatter.quote(
          tools.msg.generateCmdExample(ctx.used, 'evang|elion')
        )}`
      );

    try {
      const [left, right] = input.split('|');
      const result = tools.api.createUrl('neko', '/maker/ba-logo', {
        textL: left,
        textR: right,
      });

      await ctx.reply({
        image: {
          url: result,
        },
        mimetype: tools.mime.lookup('png'),
        footer: config.msg.footer,
      });
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
