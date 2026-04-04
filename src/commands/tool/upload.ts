import { MessageContext } from '../../types/index.js';
// Note: Removed deprecated @itsreimau/gktw import (migrated to baileys)

/* Deprecated: gktw migrated to baileys

*/

export default {
  name: 'upload',
  aliases: ['tourl'],
  category: 'tool',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config } = ctx.channel.context;
    const [checkMedia, checkQuotedMedia] = await Promise.all([
      tools.cmd.checkMedia(ctx.getContentType(), ['audio', 'document', 'image', 'video', 'sticker']),
      tools.cmd.checkQuotedMedia(ctx.quoted?.contentType, [
        'audio',
        'document',
        'image',
        'video',
        'sticker',
      ]),
    ]);

    if (!checkMedia && !checkQuotedMedia)
      return await ctx.reply(
        formatter.quote(
          tools.msg.generateInstruction(
            ['send', 'reply'],
            ['audio', 'document', 'image', 'video', 'sticker']
          )
        )
      );

    try {
      const buffer = (await ctx.getMedia()?.toBuffer?.()) || (await ctx.getQuoted()?.media?.toBuffer?.());
      const filename = `file.${tools.mime.extension(ctx.getMedia().mimetype || ctx.quoted?.media.mimetype)}`;
      const result = await tools.api.uploadFile(buffer, filename);

      await ctx.reply({
        text: formatter.quote(`URL: ${result}`),
        footer: config.msg.footer,
        interactiveButtons: [
          {
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
              display_text: 'Salin URL',
              copy_code: result,
            }),
          },
        ],
      });
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
