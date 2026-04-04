import { MessageContext } from '../../types/index.js';

export default {
    name: 'tagall',
    category: 'group',
    description: 'Mention all members in the group.',
    permissions: {
        admin: true,
        group: true,
    },
    code: async (ctx: MessageContext) => {
        const { formatter, tools, config } = ctx.channel.context;
        const input = ctx.args.join(' ') || ctx.quoted?.content || formatter.quote('👋 Hello, everyone!');

        try {
            const members = await ctx.group().members();
            const mentions = members.map(jid => {
                const serialized = ctx.getId(jid);
                return {
                    tag: `@${serialized}`,
                    mention: jid,
                };
            });

            const resultText = mentions.map(mention => mention.tag).join(' ');
            await ctx.reply({
                text: `${input}\n` + `${config.msg.readmore}· · ─ ·✶· ─ · ·\n${resultText}`,
                mentions: mentions.map(mention => mention.mention),
            });
        } catch (error: any) {
            await tools.cmd.handleError(ctx, error);
        }
    },
};
