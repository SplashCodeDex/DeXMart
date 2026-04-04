import { MessageContext, GlobalContext } from '../../types/index.js';
import axios from 'axios';

interface SpotifyResult {
  trackName: string;
  artistName: string;
  externalUrl: string;
}

export default {
  name: 'spotifysearch',
  aliases: ['spotify', 'spotifys'],
  category: 'search',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config } = ctx.channel.context as GlobalContext;
    const input = ctx.args.join(' ') || null;

    if (!input) {
      const instruction = tools.msg.generateInstruction(['send'], ['text']);
      const example = tools.msg.generateCmdExample(ctx.used, 'one last kiss - hikaru utada');
      return await ctx.reply(`${formatter.quote(instruction)}
${formatter.quote(example)}`);
    }

    try {
      const apiUrl = `https://api.diibot.fun/api/search/spotify?query=${encodeURIComponent(input)}`;
      const { data } = await axios.get<{ result: SpotifyResult[] }>(apiUrl);
      const result = data.result;

      const resultText = result
        .map(
          (res: SpotifyResult) =>
            `${formatter.quote(`Judul: ${res.trackName}`)}
` + 
            `${formatter.quote(`Artis: ${res.artistName}`)}
${formatter.quote(
              `URL: ${res.externalUrl}`
            )}`
        )
        .join('\n' + `${formatter.quote('· · ─ ·✶· ─ · ·')}
`);
      await ctx.reply({
        text: resultText || config.msg.notFound || 'No results found',
        footer: config.msg.footer,
      });
    } catch (error: unknown) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
