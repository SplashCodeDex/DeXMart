import { MessageContext } from '../../types/index.js';
import axios from 'axios';

export default {
  name: 'soundclouddl',
  aliases: ['scdl'],
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
          tools.msg.generateCmdExample(
            ctx.used,
            'https://soundcloud.com/hikaruutada/one-last-kiss-live-version'
          )
        )}`
      );

    const isUrl = tools.cmd.isUrl(url);
    if (!isUrl) return await ctx.reply(config.msg.urlInvalid);

    try {
      const apiUrl = tools.api.createUrl('izumi', '/downloader/soundcloud', {
        url,
      });
      const result = (await axios.get(apiUrl)).data.result.url;

      await ctx.reply({
        audio: {
          url: result,
        },
        mimetype: tools.mime.lookup('mp3'),
      });
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
