import { MessageContext } from '../../types/index.js';
import axios from 'axios';

export default {
  name: 'spotifydl',
  aliases: ['spotidl'],
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
            'https://open.spotify.com/track/5RhWszHMSKzb7KiXk4Ae0M'
          )
        )}`
      );

    const isUrl = tools.cmd.isUrl(url);
    if (!isUrl) return await ctx.reply(config.msg.urlInvalid);

    try {
      const apiUrl = tools.api.createUrl('diibot', '/api/download/spotify', {
        url,
      });
      const result = (await axios.get(apiUrl)).data.result.audio;

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
