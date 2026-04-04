import { MessageContext } from '../../types/index.js';
import axios from 'axios';

export default {
  name: 'mediafiredl',
  aliases: ['mediafire', 'mf', 'mfdl'],
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
            'https://www.mediafire.com/file/on2jvy5540bi22u/humanity-turned-into-lcl-scene.mp4/file'
          )
        )}`
      );

    const isUrl = tools.cmd.isUrl(url);
    if (!isUrl) return await ctx.reply(config.msg.urlInvalid);

    try {
      const apiUrl = tools.api.createUrl('neko', '/downloader/mediafire', {
        url,
      });
      const { result } = (await axios.get(apiUrl)).data;

      await ctx.reply({
        document: {
          url: result.download.url,
        },
        fileName: result.fileName,
        mimetype: result.mimetype || 'application/octet-stream',
        caption: formatter.quote(`URL: ${url}`),
        footer: config.msg.footer,
      });
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
