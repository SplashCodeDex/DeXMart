import { MessageContext } from '../../types/index.js';

export default {
  name: 'group',
  category: 'group',
  permissions: {
    admin: true,
    channelAdmin: true,
    group: true,
  },
  code: async (ctx: MessageContext) => {
    const { formatter, tools, config } = ctx.channel.context;
    const input = ctx.args.join(' ') || null;

    if (!input)
      return await ctx.reply(
        `${formatter.quote(tools.msg.generateInstruction(['send'], ['text']))}\n` +
        `${formatter.quote(tools.msg.generateCmdExample(ctx.used, 'open'))}\n${formatter.quote(
          tools.msg.generateNotes([
            `Ketik ${formatter.inlineCode(`${ctx.used.prefix + ctx.used.command} list`)} untuk melihat daftar.`,
          ])
        )}`
      );

    const action = input.toLowerCase();

    if (action === 'list') {
      const listText = await tools.list.get('group');
      return await ctx.reply({
        text: listText,
        footer: config.msg.footer,
      });
    }

    try {
      const group = ctx.group();
      switch (action) {
        case 'open':
          await group.open();
          break;
        case 'close':
          await group.close();
          break;
        case 'lock':
          await group.lock();
          break;
        case 'unlock':
          await group.unlock();
          break;
        case 'approve':
          await group.joinApproval('on');
          break;
        case 'disapprove':
          await group.joinApproval('off');
          break;
        case 'invite':
          await group.membersCanAddMemberMode(true);
          break;
        case 'restrict':
          await group.membersCanAddMemberMode(false);
          break;
        default:
          return await ctx.reply(formatter.quote(`❎ Setelan "${input}" tidak valid!`));
      }

      await ctx.reply(formatter.quote('✅ Berhasil mengubah setelan grup!'));
    } catch (error: unknown) {
      await tools.cmd.handleError(ctx, error);
    }
  },
};
