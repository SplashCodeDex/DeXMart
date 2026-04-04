import { MessageContext, GlobalContext } from '../../types/index.js';

interface Warning {
  userId: string;
  count: number;
}

export default {
  name: 'warning',
  category: 'group',
  permissions: {
    admin: true,
    channelAdmin: true,
    group: true,
    restrict: true,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config, database: db } = ctx.channel.context as GlobalContext;
    const accountJid = ctx.quoted?.senderJid || (ctx.getMentioned ? (await ctx.getMentioned())[0] : null) || null;
    if (!accountJid) {
      return await ctx.reply({
        text:
          `${formatter.quote(tools.msg.generateInstruction(['send'], ['text']))}\n` +
          `${formatter.quote(tools.msg.generateCmdExample(ctx.used, `@${ctx.getId(ctx.sender.jid)}`))}\n${formatter.quote(
            tools.msg.generateNotes([
              'Balas atau kutip pesan untuk menjadikan pengirim sebagai akun target.',
            ])
          )}`,
        mentions: [ctx.sender.jid],
      });
    }

    const accountId = ctx.getId(accountJid);

    if (accountId === config.channel.id)
      return await ctx.reply(formatter.quote(`❎ Tidak bisa memberikan warning ke bot!`));
    if (await ctx.group().isOwner(accountJid))
      return await ctx.reply(formatter.quote('❎ Tidak bisa memberikan warning ke admin grup!'));

    try {
      const groupId = ctx.getId(ctx.id);
      const groupDb = (await db.get<{ warnings?: Warning[]; maxwarnings?: number }>(`group.${groupId}`)) || {};
      const warnings: Warning[] = groupDb?.warnings || [];

      const userWarning = warnings.find((warning: Warning) => warning.userId === accountId);
      const currentWarnings = userWarning ? userWarning.count : 0;
      const newWarning = currentWarnings + 1;

      if (userWarning) {
        userWarning.count = newWarning;
      } else {
        warnings.push({
          userId: accountId,
          count: newWarning,
        });
      }

      await db.set(`group.${groupId}.warnings`, warnings);
      await ctx.reply(
        formatter.quote(
          `✅ Berhasil menambahkan warning pengguna itu menjadi ${newWarning}/${groupDb?.maxwarnings || 3}.`
        )
      );
    } catch (error: unknown) {
      await tools.cmd.handleError(ctx, error);
    }
  },
};
