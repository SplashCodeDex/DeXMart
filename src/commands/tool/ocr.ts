import { MessageContext } from '../../types/index.js';
// Note: Removed deprecated @itsreimau/gktw import (migrated to baileys)
import axios from 'axios';

/* Deprecated: gktw migrated to baileys

*/

export default {
  name: 'ocr',
  aliases: ['image2text', 'imagetotext', 'img2text', 'imgtotext'],
  category: 'tool',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools } = ctx.channel.context;
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
      const apiUrl = tools.api.createUrl('hang', '/tools/ocr', {
        url: uploadUrl,
      });
      const { result } = (await axios.get(apiUrl)).data;

      await ctx.reply(result);
    } catch (error: any) {
      await tools.cmd.handleError(ctx, error, true);
    }
  },
};
