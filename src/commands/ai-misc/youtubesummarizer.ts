import { MessageContext } from '../../types/index.js';
import axios from 'axios';

interface YoutubeSummaryPoint {
  point: string;
  summary: string;
}

export default {
  name: 'youtubesummarizer',
  aliases: ['ytsummarizer'],
  category: 'ai-misc',
  permissions: {
    premium: true,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config } = ctx.channel.context;
    const url = ctx.args[0] || null;

    if (!url)
      return await ctx.reply(
        `${formatter.quote(tools.msg.generateInstruction(['send'], ['text']))}\n${formatter.quote(
          tools.msg.generateCmdExample(ctx.used, 'https://youtube.com/watch?v=v18fHSc813k')
        )}`
      );

    const isUrl = tools.cmd.isUrl(url);
    if (!isUrl) return await ctx.reply(config.msg.urlInvalid);

    try {
      const apiUrl = tools.api.createUrl('neko', '/tools/yt-summarizer', {
        url,
      });
      const { result } = (await axios.get(apiUrl)).data;

      const resultText = result.keyPoints
        .map((res: YoutubeSummaryPoint) => `${formatter.quote(`Poin: ${res.point}`)}\n${formatter.quote(res.summary)}`)
        .join('\n' + `${formatter.quote('· · ─ ·✶· ─ · ·')}\n`);
      await ctx.reply({
        text:
          `${formatter.quote(result.summary)}\n` +
          `${formatter.quote('· · ─ ·✶· ─ · ·')}\n${resultText}`,
        footer: config.msg.footer,
      });
    } catch (error: unknown) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
