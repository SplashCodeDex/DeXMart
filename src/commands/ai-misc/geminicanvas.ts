import { MessageContext } from '../../types/index.js';
import axios from 'axios';
import tools from '../../tools/exports.js';

export default {
  name: 'geminicanvas',
  aliases: ['gcanvas'],
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
      tools.cmd.checkQuotedMedia(ctx.quoted?.contentType, 'image'),
    ]);

    if (!checkMedia && !checkQuotedMedia)
      return await ctx.reply(
        formatter.quote(tools.msg.generateInstruction(['send', 'reply'], 'image'))
      );

    try {
      const buffer = (await ctx.getMedia()?.toBuffer?.()) || (await ctx.getQuoted()?.media?.toBuffer?.());
      const uploadUrl = await tools.api.uploadImage(buffer);
      const apiUrl = tools.api.createUrl('neko', '/ai/gemini-canvas', {
        text: input,
        imageUrl: uploadUrl,
      });
      const result = Buffer.from((await axios.get(apiUrl)).data.result.image.base64, 'base64');

      await ctx.reply({
        image: result,
        mimetype: tools.mime.lookup('jpeg'),
        caption: formatter.quote('Untukmu, tuan!'),
        footer: config.msg.footer,
      });
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
