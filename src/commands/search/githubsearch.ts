import { MessageContext, GlobalContext } from '../../types/index.js';
import axios from 'axios';

interface GithubResult {
  full_name: string;
  description: string;
  stars: number;
  forks: number;
  language: string;
  url: string;
}

export default {
  name: 'githubsearch',
  aliases: ['github', 'githubs'],
  category: 'search',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config } = ctx.channel.context as GlobalContext;
    const input = ctx.args.join(' ') || null;

    if (!input) {
      const instruction = tools.msg.generateInstruction(['send'], ['text']);
      const example = tools.msg.generateCmdExample(ctx.used, 'DeXMart');
      return await ctx.reply(`${formatter.quote(instruction)}
${formatter.quote(example)}`);
    }

    try {
      const apiUrl = tools.api.createUrl('neko', '/search/github-search', { q: input });
      const { data } = await axios.get<{ result: GithubResult[] }>(apiUrl);
      const result = data.result;

      const resultText = result
        .map(
          (res: GithubResult) =>
            `${formatter.quote(`Name: ${res.full_name}`)}
` +
            `${formatter.quote(`Description: ${res.description}`)}
` +
            `${formatter.quote(`Count: ${res.stars} stars, ${res.forks} forks`)}
` +
            `${formatter.quote(`Language: ${res.language}`)}
${formatter.quote(`URL: ${res.url}`)}`
        )
        .join('\n' + `${formatter.quote('· · ─ ·✶· ─ · ·')}\n`);
      await ctx.reply({
        text: resultText || config.msg.notFound || 'Result not found',
        footer: config.msg.footer,
      });
    } catch (error: unknown) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
