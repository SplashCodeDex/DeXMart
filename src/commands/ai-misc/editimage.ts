import { MessageContext } from '../../types/index.js';
export default {
  name: 'editimage',
  aliases: ['editimg'],
  category: 'ai-misc',
  permissions: {
    premium: true,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config } = ctx.channel.context;
    const input = ctx.args.join(' ') || null;

    if (!input)
      return await ctx.reply(
        `${formatter.quote(tools.msg.generateInstruction(['send'], ['text']))}\n${formatter.quote(
          tools.msg.generateCmdExample(ctx.used, 'make it evangelion art style')
        )}`
      );

    const [checkMedia, checkQuotedMedia] = await Promise.all([
      tools.cmd.checkMedia(ctx.getContentType(), 'image'),
      tools.cmd.checkQuotedMedia(ctx.getQuoted()?.contentType, 'image'),
    ]);

    if (!checkMedia && !checkQuotedMedia)
      return await ctx.reply(
        formatter.quote(tools.msg.generateInstruction(['send', 'reply'], 'image'))
      );

    try {
      const media = ctx.getMedia();
      const quotedMedia = ctx.getQuoted()?.media;
      const buffer = (await media?.toBuffer?.()) || (await quotedMedia?.toBuffer?.());
      const uploadUrl = await tools.api.uploadImage(buffer);
      const result = tools.api.createUrl('zell', '/ai/editimg', {
        imageUrl: uploadUrl,
        prompt: input,
      });

      await ctx.reply({
        image: {
          url: result,
        },
        mimetype: tools.mime.lookup('png'),
        caption: formatter.quote('Untukmu, tuan!'),
        footer: config.msg.footer,
      });
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
