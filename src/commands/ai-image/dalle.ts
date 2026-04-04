import { MessageContext } from '../../types/index.js';
import { imageGenerationQueue } from '../../lib/queues.js';

export default {
  name: 'dalle',
  category: 'ai-image',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config } = ctx.channel.context;
    const input = ctx.args.join(' ') || ctx.quoted?.content || null;

    if (!input)
      return await ctx.reply(
        `${formatter.quote(tools.msg.generateInstruction(['send'], ['text']))}\n` +
        `${formatter.quote(tools.msg.generateCmdExample(ctx.used, 'anime girl with short blue hair'))}\n${formatter.quote(
          tools.msg.generateNotes([
            'Balas atau quote pesan untuk menjadikan teks sebagai input target, jika teks memerlukan baris baru.',
          ])
        )}`
      );

    try {
      // Add a job to the image generation queue (BullMQ signature: add(name, data, options))
      await imageGenerationQueue.add('generate', {
        input: input,
        userJid: ctx.sender.jid,
        used: ctx.used, // Pass the 'used' context for the reply button
      });

      // Inform the user that their request is being processed
      await ctx.reply(config.msg.wait);

    } catch (error: any) {
      // Handle potential errors from adding the job to the queue
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
