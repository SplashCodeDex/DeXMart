import { MessageContext, GlobalContext, Command } from '../../types/index.js';
import moment from 'moment-timezone';

export default {
    name: 'menu',
    aliases: ['allmenu', 'help', 'list', 'listmenu'],
    category: 'main',
    description: 'Display the bot\'s command menu.',
    code: async (ctx: MessageContext) => {
        const { config, formatter, state, tenantConfigService } = ctx.channel.context as GlobalContext;
        const tenantId = (ctx.channel as any).tenantId;

        try {
            const tenantResult = await tenantConfigService.getTenantSettings(tenantId);
            const ownerName = tenantResult.success ? tenantResult.data.ownerName || 'Unknown' : 'Unknown';

            const tag: Record<string, string> = {
                'ai-chat': 'AI (Chat)',
                'ai-image': 'AI (Image)',
                'ai-video': 'AI (Video)',
                'ai-misc': 'AI (Miscellaneous)',
                converter: 'Converter',
                downloader: 'Downloader',
                entertainment: 'Entertainment',
                game: 'Game',
                group: 'Group',
                maker: 'Maker',
                profile: 'Profile',
                search: 'Search',
                tool: 'Tool',
                owner: 'Owner',
                information: 'Information',
                misc: 'Miscellaneous',
                main: 'Main',
            };

            const allCommands = Array.from(ctx.channel.cmd.values()) as Command[];
            const disabledCommands = ctx.channel.config?.disabledCommands || [];

            const text =
                `Hello, @${ctx.getId(ctx.sender.jid)}! I am a WhatsApp bot named ${config.channel.name}, owned by ${ownerName}. I can perform many commands, such as creating stickers, using AI for specific tasks, and other useful commands.\n` +
                '\n' +
                `${formatter.quote(`Date: ${moment.tz(config.system.timeZone).locale('en').format('dddd, DD MMMM YYYY')}`)}
` +
                `${formatter.quote(`Time: ${moment.tz(config.system.timeZone).format('HH:mm:ss')}`)}
` +
                '\n' +
                `${formatter.quote(`Uptime: ${state?.uptime || 'unknown'}`)}
` +
                `${formatter.quote(`Database: ${state?.dbSize || '0'} (Firebase)`)}
` +
                `${formatter.quote('Library: baileys')}
` +
                '\n' +
                `${formatter.italic(`Type ${formatter.monospace(`${ctx.used.prefix}menu <command>`)} to see command details.`)}
` +
                '\n' +
                Object.keys(tag)
                    .map((c) => {
                        const commands = allCommands.filter(
                            (cmd: Command) =>
                                cmd.category === c &&
                                !(cmd as any).hide &&
                                !disabledCommands.includes(cmd.name)
                        );
                        if (commands.length === 0) return '';
                        return (
                            `*${tag[c]}* _(${commands.length})_\n` +
                            commands
                                .map((cmd: Command) => formatter.monospace(cmd.name))
                                .sort()
                                .join(', ')
                        );
                    })
                    .filter(Boolean)
                    .join('\n\n');

            await ctx.reply({
                text,
                mentions: [ctx.sender.jid]
            });
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            await ctx.reply(`Error: ${err.message}`);
        }
    },
};
