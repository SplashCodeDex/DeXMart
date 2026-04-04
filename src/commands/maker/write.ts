import { MessageContext } from '../../types/index.js';
export default {
  name: 'write',
  aliases: ['tulis'],
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
        `${formatter.quote(tools.msg.generateCmdExample(ctx.used, 'get in the fucking robot, shinji!'))}\n${formatter.quote(
          tools.msg.generateNotes([
            'Balas atau quote pesan untuk menjadikan teks sebagai input target, jika teks memerlukan baris baru.',
          ])
        )}`
      );

    try {
      const result = tools.api.createUrl('zenzxz', '/maker/nulis', {
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
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
