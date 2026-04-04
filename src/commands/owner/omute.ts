import { MessageContext } from '../../types/index.js';
export default {
  name: 'omute',
  category: 'owner',
  permissions: {
    group: true,
    owner: true,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config, database: db } = ctx.channel.context;
    const groupId = ctx.getId(ctx.id);

    if (ctx.args[0]?.toLowerCase() === 'bot') {
      await db.set(`group.${groupId}.mutechannel`, 'owner');
      return await ctx.reply(formatter.quote('✅ Berhasil me-mute grup ini dari bot!'));
    }

    const accountJid = ctx.quoted?.senderJid || (ctx.getMentioned ? (await ctx.getMentioned())[0] : null) || null;

    if (!accountJid)
      return await ctx.reply({
        text:
          `${formatter.quote(tools.msg.generateInstruction(['send'], ['text']))}\n` +
          `${formatter.quote(tools.msg.generateCmdExample(ctx.used, `@${ctx.getId(ctx.sender.jid)}`))}\n${formatter.quote(
            tools.msg.generateNotes([
              'Balas atau kutip pesan untuk menjadikan pengirim sebagai akun target.',
              `Ketik ${formatter.inlineCode(`${ctx.used.prefix + ctx.used.command} bot`)} untuk me-mute bot.`,
            ])
          )}`,
        mentions: [ctx.sender.jid],
      });

    const accountId = ctx.getId(accountJid);
    if (accountId === config.channel.id)
      return await ctx.reply(
        formatter.quote(
          `❎ Ketik ${formatter.inlineCode(`${ctx.used.prefix + ctx.used.command} bot`)} untuk me-mute bot.`
        )
      );
    if (await ctx.group().isOwner(accountJid))
      return await ctx.reply(formatter.quote('❎ Dia adalah owner grup!'));

    try {
      const muteList = (await db.get<string[]>(`group.${groupId}.mute`)) || [];
      if (!muteList.includes(accountId)) muteList.push(accountId);
      await db.set(`group.${groupId}.mute`, muteList);

      await ctx.reply(formatter.quote('✅ Berhasil me-mute pengguna itu dari grup ini!'));
    } catch (error: unknown) {
      await tools.cmd.handleError(ctx, error);
    }
  },
};
