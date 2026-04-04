import { MessageContext, GlobalContext } from '../../types/index.js';
import axios from 'axios';

interface SfileResult {
  title: string;
  size: string;
  link: string;
}

export default {
  name: 'sfilesearch',
  aliases: ['sfile', 'sfiles'],
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
      const apiUrl = `https://api.hang.fun/search/sfile?q=${encodeURIComponent(input)}`;
      const { data } = await axios.get<{ result: SfileResult[] }>(apiUrl);
      const result = data.result;

      const resultText = result
        .map(
          (res: SfileResult) =>
            `${formatter.quote(`Nama: ${res.title}`)}
` +
            `${formatter.quote(`Ukuran: ${res.size}`)}
${formatter.quote(`URL: ${res.link}`)}`
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
