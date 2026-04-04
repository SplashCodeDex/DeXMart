import { MessageContext } from '../../types/index.js';
export default {
  name: 'screenshot',
  aliases: ['ss', 'sshp', 'sspc', 'sstab', 'ssweb'],
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
          tools.msg.generateCmdExample(ctx.used, 'https://itsreimau.is-a.dev')
        )}`
      );

    const isUrl = tools.cmd.isUrl(url);
    if (!isUrl) return await ctx.reply(config.msg.urlInvalid);

    try {
      let endpoint = '/api/tools/sspc';
      if (ctx.used.command == 'sshp') endpoint = '/api/tools/sshp';
      if (ctx.used.command == 'sstab') endpoint = '/api/tools/sstab';
      const result = tools.api.createUrl('diibot', endpoint, {
        url,
      });

      await ctx.reply({
        image: {
          url: result,
        },
        mimetype: tools.mime.lookup('jpg'),
        caption: formatter.quote(`URL: ${url}`),
        footer: config.msg.footer,
      });
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
