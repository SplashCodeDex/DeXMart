import { MessageContext } from '../../types/index.js';
import axios from 'axios';

export default {
  name: 'sfiledl',
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
          tools.msg.generateCmdExample(ctx.used, 'https://sfile.mobi/a1NTccB8T6m')
        )}`
      );

    const isUrl = tools.cmd.isUrl(url);
    if (!isUrl) return await ctx.reply(config.msg.urlInvalid);

    try {
      const apiUrl = tools.api.createUrl('zell', '/download/sfile', {
        url,
      });
      const { result } = (await axios.get(apiUrl)).data;

      await ctx.reply({
        document: {
          url: result.download_url,
        },
        fileName: result.metadata.filename,
        mimetype: result.metadata.mimetype || 'application/octet-stream',
        caption: formatter.quote(`URL: ${url}`),
        footer: config.msg.footer,
      });
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
