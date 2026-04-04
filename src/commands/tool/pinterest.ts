import { MessageContext } from '../../types/index.js';
import axios from 'axios';

export default {
  name: 'pinterest',
  aliases: ['pin', 'pint'],
  category: 'tool',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config } = ctx.channel.context;
    const input = ctx.args.join(' ') || null;

    if (!input)
      return await ctx.reply(
        `${formatter.quote(tools.msg.generateInstruction(['send'], ['text']))}\n${formatter.quote(
          tools.msg.generateCmdExample(ctx.used, 'rei ayanami')
        )}`
      );

    try {
      const apiUrl = tools.api.createUrl('izumi', '/search/pinterest', {
        text: input,
      });
      const result = (tools.cmd.getRandomElement((await axios.get(apiUrl)).data.result.pins) as any).media;

      await ctx.reply({
        image: {
          url: result,
        },
        mimetype: tools.mime.lookup('jpg'),
        caption: formatter.quote(`Kueri: ${input}`),
        footer: config.msg.footer,
        buttons: [
          {
            buttonId: `${ctx.used.prefix + ctx.used.command} ${input}`,
            buttonText: {
              displayText: 'Ambil Lagi',
            },
          },
        ],
      });
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
