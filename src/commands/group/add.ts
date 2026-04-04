import { MessageContext } from '../../types/index.js';
import { getJid } from '../../utils/baileysUtils.js';

export default {
  name: 'add',
  category: 'group',
  permissions: {
    admin: true,
    channelAdmin: true,
    group: true
  },
  code: async (ctx: MessageContext) => {
    const { formatter } = ctx.channel.context;
    const input = ctx.args.join('');

    if (!input) {
      return await ctx.reply(formatter.quote('⚠️ Please provide a phone number to add.'));
    }

    // Basic cleaning found in original code
    const accountJid = getJid(input);

    try {
      // Verify user exists on WhatsApp using bot socket
      if (ctx.channel.onWhatsApp) {
        const results = await ctx.channel.onWhatsApp(accountJid);
        if (!results || results.length === 0 || !results[0].exists) {
          return await ctx.reply(formatter.quote('❎ Only numbers registered on WhatsApp can be added.'));
        }
      }

      await ctx.group().add([accountJid]);
      await ctx.reply(formatter.quote('✅ Request to add user sent!'));

    } catch (error: unknown) {
      const err = error instanceof Error ? error.message : String(error);
      ctx.channel.context.logger.error('Add command failed', { error: err });
      await ctx.reply(formatter.quote(`❌ Failed to add user: ${err}`));
    }
  },
};
