import { MessageContext, GlobalContext } from '../../types/index.js';
import axios from 'axios';

interface NpmResult {
  title: string;
  author: string;
  links: {
    npm: string;
  };
}

export default {
  name: 'npmsearch',
  aliases: ['npm', 'npms'],
  category: 'search',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config } = ctx.channel.context as GlobalContext;
    const input = ctx.args.join(' ') || null;

    if (!input) {
      const instruction = tools.msg.generateInstruction(['send'], ['text']);
      const example = tools.msg.generateCmdExample(ctx.used, 'baileys');
      return await ctx.reply(`${formatter.quote(instruction)}
${formatter.quote(example)}`);
    }

    try {
      const apiUrl = `https://api.hang.fun/search/npm?q=${encodeURIComponent(input)}`;
      const { data } = await axios.get<{ result: NpmResult[] }>(apiUrl);
      const result = data.result;

      const resultText = result
        .map(
          (res: NpmResult) =>
            `${formatter.quote(`Name: ${res.title}`)}
` +
            `${formatter.quote(`Developer: ${res.author}`)}
${formatter.quote(
              `URL: ${res.links.npm}`
            )}`
        )
        .join('\n' + `${formatter.quote('· · ─ ·✶· ─ · ·')}\n`);
      await ctx.reply({
        text: resultText || config.msg.notFound || 'No results found',
        footer: config.msg.footer,
      });
    } catch (error: unknown) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
