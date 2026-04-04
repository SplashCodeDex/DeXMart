import { MessageContext, GlobalContext } from '../../types/index.js';
import axios from 'axios';
import { Sticker } from 'wa-sticker-formatter';

export default {
  name: 'fetch',
  aliases: ['get'],
  category: 'tool',
  permissions: {
    coin: 10,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config } = ctx.channel.context as GlobalContext;
    const url = ctx.args[0] || null;

    if (!url) {
      const instruction = tools.msg.generateInstruction(['send'], ['text']);
      const example = tools.msg.generateCmdExample(ctx.used, 'https://example.com/image.jpg');
      return await ctx.reply(`${formatter.quote(instruction)}
${formatter.quote(example)}`);
    }

    const isUrl = tools.cmd.isUrl(url);
    if (!isUrl) return await ctx.reply(config.msg.urlInvalid);

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        validateStatus() {
          return true;
        },
      });

      const contentType = response?.headers?.['content-type'];

      if (/image/.test(contentType)) {
        await ctx.reply({
          image: response?.data,
          mimetype: tools.mime.contentType(contentType),
          caption: formatter.quote('Untukmu, tuan!'),
          footer: config.msg.footer,
        });
      } else if (/video/.test(contentType)) {
        await ctx.reply({
          video: response?.data,
          mimetype: tools.mime.contentType(contentType),
          caption: formatter.quote('Untukmu, tuan!'),
          footer: config.msg.footer,
        });
      } else if (/audio/.test(contentType)) {
        await ctx.reply({
          audio: response?.data,
          mimetype: tools.mime.contentType(contentType),
          caption: formatter.quote('Untukmu, tuan!'),
        });
      } else if (/webp/.test(contentType)) {
        const pack = (config as any).sticker?.packname || 'DeXMart';
        const author = (config as any).sticker?.author || 'CodeDeX';

        const sticker = new Sticker(response?.data, {
          pack,
          author,
          type: 'full', // StickerTypes.FULL
          categories: ['🤩'] as any, // Cast to any to bypass strict literal check for now
          id: ctx.id,
          quality: 50,
        });

        await ctx.reply({ sticker: await sticker.build() });
      } else if (!/utf-8|json|html|plain/.test(contentType)) {
        const disposition = response?.headers?.['content-disposition'];
        const fileName = /filename/i.test(disposition)
          ? disposition?.match(/filename=(.*)/)?.[1]?.replace(/["'];/g, '')
          : 'file';

        await ctx.reply({
          document: response?.data,
          fileName,
          mimetype: tools.mime.contentType(contentType),
        });
      } else {
        const text = response?.data.toString('utf-8');
        let json;

        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }

        const responseText = json ? walkJSON(json, 0, [], formatter) : text;
        await ctx.reply(responseText);
      }
    } catch (error: unknown) {
      await tools.cmd.handleError(ctx, error);
    }
  },
};

function walkJSON(json: any, depth: number = 0, array: string[] = [], formatter: any): string {
  for (const key in json) {
    array.push(`${'┊'.repeat(depth)}${depth > 0 ? ' ' : ''}${formatter.bold(key)}:`);
    if (typeof json[key] === 'object' && json[key] !== null) {
      walkJSON(json[key], depth + 1, array, formatter);
    } else {
      array[array.length - 1] += ` ${json[key]}`;
    }
  }
  return array.join('\n');
}
