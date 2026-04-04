import { MessageContext } from '../../types/index.js';
import axios from 'axios';

export default {
  name: 'getgithubgist',
  aliases: ['getgist', 'gist', 'githubgist'],
  category: 'tool',
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
            'https://gist.github.com/itsreimau/55792fc0386d183a581f8f723a6e4c73'
          )
        )}`
      );

    const isUrl = tools.cmd.isUrl(url);
    if (!isUrl) return await ctx.reply(config.msg.urlInvalid);

    try {
      const apiUrl = tools.api.createUrl('neko', '/tools/getgist', {
        url,
      });
      const result = (await axios.get(apiUrl)).data.result.content;

      await ctx.reply(result);
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
