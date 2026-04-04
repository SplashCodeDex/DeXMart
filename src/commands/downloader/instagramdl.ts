import { MessageContext } from '../../types/index.js';
import axios from 'axios';

interface InstagramMedia {
  url: string;
  type: string;
  ext: string;
}

export default {
  name: 'instagramdl',
  aliases: ['ig', 'igdl', 'instagram'],
  category: 'downloader',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config } = ctx.channel.context;
    const url = ctx.args[0] || null;

    if (!url)
      return await ctx.reply(
        `${formatter.quote(tools.msg.generateInstruction(['send'], ['text']))}\n${formatter.quote(
          tools.msg.generateCmdExample(ctx.used, 'https://www.instagram.com/p/DLzgi9pORzS')
        )}`
      );

    const isUrl = tools.cmd.isUrl(url);
    if (!isUrl) return await ctx.reply(config.msg.urlInvalid);

    try {
      const apiUrl = tools.api.createUrl('zell', '/download/instagram', {
        url,
      });
      const response = await axios.get(apiUrl);
      const result: InstagramMedia[] = response.data.result.url;
      const album = result.map((res: InstagramMedia) => {
        const isVideo = res.type === 'mp4';
        return {
          [isVideo ? 'video' : 'image']: {
            url: res.url,
          },
          mimetype: tools.mime.lookup(res.ext),
        };
      });

      await ctx.reply({
        album,
        caption: formatter.quote(`URL: ${url}`),
      });
    } catch (error: unknown) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
