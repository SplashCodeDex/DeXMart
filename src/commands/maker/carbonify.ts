import { MessageContext } from '../../types/index.js';
import { createUrl } from '../../tools/api.js';
import logger from '../../utils/logger.js';
export default {
  name: 'carbonify',
  aliases: ['carbon'],
  category: 'maker',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config } = ctx.channel.context;
    const input = ctx.args.join(' ') || ctx.quoted?.content || null;

    if (!input)
      return await ctx.reply(
        `${formatter.quote(tools.msg.generateInstruction(['send'], ['text']))}\n` +
        `${formatter.quote(tools.msg.generateCmdExample(ctx.used, 'console.log("halo, dunia!");'))}\n${formatter.quote(
          tools.msg.generateNotes([
            'Balas atau quote pesan untuk menjadikan teks sebagai input target, jika teks memerlukan baris baru.',
          ])
        )}`
      );

    try {
      const result = createUrl('neko', '/maker/carbonify', {
        text: input,
      });

      await ctx.reply({
        image: {
          url: result,
        },
        mimetype: tools.mime.lookup('png'),
        footer: config.msg.footer,
      });
    } catch (error: any) {
      logger.error('Error in carbonify:', error);
      await ctx.reply(formatter.quote(`An error occurred: ${error.message}`));
    }
  },
};
