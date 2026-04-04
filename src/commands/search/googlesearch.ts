import { MessageContext, GlobalContext } from '../../types/index.js';
import axios from 'axios';
import z from 'zod';
import logger from '../../utils/logger.js';

interface GoogleResult {
  title: string;
  desc: string;
  url: string;
}

export default {
  name: 'googlesearch',
  aliases: ['google', 'googles'],
  category: 'search',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, config, tools } = ctx.channel.context as GlobalContext;

    try {
      const input = ctx.args.join(' ');

      // Validation
      const querySchema = z.string().min(1, { message: 'Please provide a search query.' });
      const queryCheck = querySchema.safeParse(input);

      if (!queryCheck.success) {
        return ctx.reply(
          formatter.quote(
            `❎ ${queryCheck.error.issues[0].message}\n\nExample: .google what is whatsapp`
          )
        );
      }
      const query = queryCheck.data;

      const apiUrl = tools.api.createUrl('neko', '/search/google', { q: query });

      const { data } = await axios.get<{ result: GoogleResult[] }>(apiUrl);
      const result = data.result;

      if (!result || result.length === 0) {
        return ctx.reply(formatter.quote(config.msg.notFound || 'Result not found'));
      }

      const resultText = result
        .map(
          (res: GoogleResult) =>
            `${formatter.quote(`Title: ${res.title}`)}\n` +
            `${formatter.quote(`Description: ${res.desc}`)}\n${formatter.quote(`URL: ${res.url}`)}`
        )
        .join(`\n${formatter.quote('· · ─ ·✶· ─ · ·')}\n`);

      return ctx.reply({
        text: resultText,
        footer: config.msg.footer,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Google search command error:', err);
      return ctx.reply(formatter.quote(`An error occurred: ${err.message}`));
    }
  },
};
