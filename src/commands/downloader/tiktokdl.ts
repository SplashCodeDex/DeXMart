import { MessageContext } from '../../types/index.js';
import axios from 'axios';

export default {
  name: 'tiktokdl',
  aliases: ['tiktok', 'tiktoknowm', 'tt', 'ttdl', 'vt', 'vtdl', 'vtdltiktok', 'vtnowm'],
  category: 'downloader',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const {
      formatter,
      config,
      tools: { msg, cmd, api, mime },
    } = ctx.channel.context;
    const url = ctx.args[0] || null;

    if (!url)
      return await ctx.reply(
        `${formatter.quote(msg.generateInstruction(['send'], ['text']))}\n${formatter.quote(
          msg.generateCmdExample(
            ctx.used,
            'https://www.tiktok.com/@grazeuz/video/7486690677888158984'
          )
        )}`
      );

    const isUrl = cmd.isUrl(url);
    if (!isUrl) return await ctx.reply(config.msg.urlInvalid);

    try {
      const apiUrl = api.createUrl('diibot', '/api/download/tiktok', {
        url,
      });
      const { result } = (await axios.get(apiUrl)).data;

      if (result.play && !result.images) {
        await ctx.reply({
          video: {
            url: result.play,
          },
          mimetype: mime.lookup('mp4'),
          caption: formatter.quote(`URL: ${url}`),
          footer: config.msg.footer,
        });
      } else if (result.images) {
        const album = result.images.map((imageUrl: string) => ({
          image: {
            url: imageUrl,
          },
          mimetype: mime.lookup('jpeg'),
        }));

        await ctx.reply({
          album,
          caption: formatter.quote(`URL: ${url}`),
        });
      }
    } catch (error: unknown) {
      await cmd.handleError(ctx, error, true);
    }
  },
};
