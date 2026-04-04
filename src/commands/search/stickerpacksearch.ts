import { MessageContext, GlobalContext } from '../../types/index.js';
import axios from 'axios';

interface StickerPackResult {
  name: string;
  author: string;
  url: string;
}

export default {
  name: 'stickerpacksearch',
  aliases: ['stickerpack', 'stickerpacks'],
  category: 'search',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config } = ctx.channel.context as GlobalContext;
    const input = ctx.args.join(' ') || null;

    if (!input) {
      const instruction = tools.msg.generateInstruction(['send'], ['text']);
      const example = tools.msg.generateCmdExample(ctx.used, 'evangelion');
      return await ctx.reply(`${formatter.quote(instruction)}
${formatter.quote(example)}`);
    }

    try {
      const apiUrl = `https://api.neko.fun/search/stickerpack?q=${encodeURIComponent(input)}`;
      const { data } = await axios.get<{ result: StickerPackResult[] }>(apiUrl);
      const result = data.result;

      const resultText = result
        .map(
          (res: StickerPackResult) =>
            `${formatter.quote(`Nama: ${res.name}`)}
` +
            `${formatter.quote(`Pembuat: ${res.author}`)}
${formatter.quote(`URL: ${res.url}`)}`
        )
        .join('\n' + `${formatter.quote('· · ─ ·✶· ─ · ·')}\n`);
      await ctx.reply({
        text: resultText || config.msg.notFound || 'No results found',
        footer: config.msg.footer,
      });
    } catch (error: unknown) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
