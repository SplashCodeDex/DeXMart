import { MessageContext } from '../../types/index.js';
import axios from 'axios';

interface TwitterResult {
  quality: string;
  url: string;
}

export default {
  name: 'twitterdl',
  aliases: ['twitter', 'twit', 'twitdl', 'x', 'xdl'],
  category: 'downloader',
  permissions: {
    premium: true,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config } = ctx.channel.context;
    const url = ctx.args[0] || null;

    if (!url)
      return await ctx.reply(
        `${formatter.quote(tools.msg.generateInstruction(['send'], ['text']))}\n${formatter.quote(
          tools.msg.generateCmdExample(
            ctx.used,
            'https://x.com/kaotaro12/status/1459493783964250118/video/1'
          )
        )}`
      );

    const isUrl = tools.cmd.isUrl(url);
    if (!isUrl) return await ctx.reply(config.msg.urlInvalid);

    try {
      const apiUrl = tools.api.createUrl('davidcyril', '/twitterv2', {
        url,
      });
      const response = await axios.get(apiUrl);
      const result = response.data.result.find((res: TwitterResult) =>
        res.quality.includes('720p')
      );

      if (!result) {
        throw new Error('No 720p video found');
      }

      await ctx.reply({
        video: {
          url: result.url,
        },
        mimetype: tools.mime.lookup('mp4'),
        caption: formatter.quote(`URL: ${url}`),
        footer: config.msg.footer,
      });
    } catch (error: unknown) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
