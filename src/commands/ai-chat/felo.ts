import { MessageContext } from '../../types/index.js';
import axios from 'axios';
import { createUrl } from '../../tools/api.js';
import logger from '../../utils/logger.js';

export default {
  name: 'felo',
  aliases: ['feloai'],
  category: 'ai-chat',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const { formatter } = ctx.channel.context;
    const input = ctx.args.join(' ') || ctx.quoted?.content || null;

    if (!input) {
      return ctx.reply(formatter.quote('Please provide an input text.'));
    }

    try {
      const apiUrl = createUrl('izumi', '/ai/feloai', {
        query: input,
      });
      const response = await axios.get(apiUrl);
      const result = response.data.result.text;

      return ctx.reply(result);
    } catch (error: any) {
      logger.error('FeloAI command error:', error);
      return ctx.reply(formatter.quote(`An error occurred: ${error.message}`));
    }
  },
};
