import { MessageContext, GlobalContext } from '../../types/index.js';
import axios from 'axios';

interface YoutubeResult {
  title: string;
  duration: string;
  url: string;
}

export default {
  name: 'youtubesearch',
  aliases: ['youtube', 'youtubes', 'yt', 'yts', 'ytsearch'],
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
      const apiUrl = `https://api.davidcyriltech.my.id/youtube/search?query=${encodeURIComponent(input)}`;
      const { data } = await axios.get<{ results: YoutubeResult[] }>(apiUrl);
      const result = data.results;

      const resultText = result
        .map(
          (res: YoutubeResult) =>
            `${formatter.quote(`Judul: ${res.title}`)}
` +
            `${formatter.quote(`Durasi: ${res.duration}`)}
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
