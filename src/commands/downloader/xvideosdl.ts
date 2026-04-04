import { MessageContext } from '../../types/index.js';
import axios from 'axios';

export default {
  name: 'xvideosdl',
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
            'https://www.xvideos.com/video.kfhcdpb267b/evangelion_hentai'
          )
        )}`
      );

    const isUrl = tools.cmd.isUrl(url);
    if (!isUrl) return await ctx.reply(config.msg.urlInvalid);

    try {
      const apiUrl = tools.api.createUrl('neko', '/downloader/xvideos', {
        url,
      });
      const result = (await axios.get(apiUrl)).data.result.videos;

      await ctx.reply({
        video: {
          url: result.high || result.low,
        },
        mimetype: tools.mime.lookup('mp4'),
        caption: formatter.quote(`URL: ${url}`),
        footer: config.msg.footer,
      });
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
