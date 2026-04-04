import { MessageContext } from '../../types/index.js';
import axios from 'axios';

export default {
  name: 'animagine',
  aliases: ['animaginexl'],
  category: 'ai-image',
  permissions: {
    premium: true,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config } = ctx.channel.context;
    const input = ctx.args.join(' ') || ctx.quoted?.content || null;

    if (!input)
      return await ctx.reply(
        `${formatter.quote(tools.msg.generateInstruction(['send'], ['text']))}\n` +
          `${formatter.quote(tools.msg.generateCmdExample(ctx.used, 'anime girl with short blue hair'))}\n${formatter.quote(
            tools.msg.generateNotes([
              'Balas atau quote pesan untuk menjadikan teks sebagai input target, jika teks memerlukan baris baru.',
            ])
          )}`
      );

    try {
      const apiUrl = tools.api.createUrl('neko', '/ai-img/animagine-xl-3.1', {
        text: input,
      });
      const result = tools.cmd.getRandomElement((await axios.get(apiUrl)).data.result);

      await ctx.reply({
        image: {
          url: result,
        },
        mimetype: tools.mime.lookup('jpeg'),
        caption: formatter.quote(`Prompt: ${input}`),
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
