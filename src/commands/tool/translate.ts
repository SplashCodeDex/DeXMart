import { MessageContext, GlobalContext } from '../../types/index.js';
import axios from 'axios';
import z from 'zod';
// Assuming createUrl is available via imports or tools if standard
import logger from '../../utils/logger.js';

interface Language {
  code: string;
  language: string;
}

export default {
  name: 'translate',
  aliases: ['tr'],
  category: 'tool',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, config } = ctx.channel.context as GlobalContext;

    try {
      const langCode = ctx.args[0]?.length === 2 ? ctx.args[0] : 'id';
      const input =
        ctx.args.slice(ctx.args[0]?.length === 2 ? 1 : 0).join(' ') || (ctx.quoted as any)?.content || '';

      if (ctx.args[0]?.toLowerCase() === 'list') {
        const langListUrl = 'https://raw.githubusercontent.com/itsecurityco/to-google-translate/refs/heads/master/supported_languages.json';
        const response = await axios.get<Language[]>(langListUrl);
        const listText = response.data
          .map(
            (lang: Language) =>
              `${formatter.quote(`Language Code: ${lang.code}`)}
${formatter.quote(`Language: ${lang.language}`)}`
          )
          .join(`
${formatter.quote('· · ─ ·✶· ─ · ·')}
`);
        return ctx.reply({ text: listText, footer: config.msg.footer });
      }

      // Validation
      const inputSchema = z.string().min(1, { message: 'Please provide text to translate.' });
      const inputCheck = inputSchema.safeParse(input);
      if (!inputCheck.success) {
        return ctx.reply(
          formatter.quote(`❎ ${inputCheck.error.issues[0].message}

Example: .tr en hello world`)
        );
      }
      const textToTranslate = inputCheck.data;

      // API Call
      const apiUrl = `https://api.davidcyriltech.my.id/tools/translate?text=${encodeURIComponent(textToTranslate)}&to=${langCode}`;
      const { data } = await axios.get<{ translated_text: string }>(apiUrl);
      const result = data.translated_text;

      return ctx.reply(result);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Translate command error:', err);
      return ctx.reply(formatter.quote(`An error occurred: ${err.message}`));
    }
  },
};
