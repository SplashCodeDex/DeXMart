import { MessageContext, Command } from '../../types/index.js';
import { databaseService } from '../../services/database.js';

export const command: Command = {
    name: 'welcome',
    category: 'group',
    description: 'Manage welcome and goodbye messages for the group.',
    usage: '!welcome <on|off> | !welcome set <message> | !welcome remove <message>',
    permissions: {
        admin: true,
        group: true
    },
    execute: async (ctx: MessageContext) => {
        const { bot, args, sender } = ctx;
        const groupJid = ctx.id;

        if (!ctx.isGroup()) {
            return ctx.reply('⚠️ This command can only be used in groups.');
        }

        const action = args[0]?.toLowerCase();

        // Fetch current group settings using scoped tenant logic
        const groupDoc = await databaseService.getDoc('groups', groupJid, bot.tenantId);

        if (!groupDoc) {
            // In proper flow, this should not happen if syncGroup is working, or we should auto-init
            return ctx.reply('⚠️ Group data not found. Please try interacting with the bot first.');
        }

        const currentSettings = (groupDoc as any).settings || {};
        const welcomeSettings = currentSettings.welcome || { enabled: false, message: '', leaveMessage: '' };

        // 1. Toggle ON/OFF
        if (action === 'on' || action === 'off') {
            const isEnabled = action === 'on';
            welcomeSettings.enabled = isEnabled;

            await databaseService.updateDoc('groups', groupJid, {
                settings: { ...currentSettings, welcome: welcomeSettings }
            }, bot.tenantId);

            return ctx.reply(`✅ Welcome messages are now **${action.toUpperCase()}**.`);
        }

        // 2. Set Welcome Message
        if (action === 'set') {
            const message = args.slice(1).join(' ');
            if (!message) {
                return ctx.reply('⚠️ Please provide a welcome message.\n\n*Placeholders:*\n@user - Mention new member\n@subject - Group Name\n@desc - Group Description');
            }

            welcomeSettings.message = message;
            await databaseService.updateDoc('groups', groupJid, {
                settings: { ...currentSettings, welcome: welcomeSettings }
            }, bot.tenantId);

            return ctx.reply('✅ Welcome message updated!');
        }

        // 3. Set Goodbye Message (using 'goodbye' or 'set-leave' alias logic if we want, but keeping simple here)
        // Let's support 'leave' or 'goodbye' as arg[0] for setting the leave message
        if (action === 'leave' || action === 'goodbye') {
            const message = args.slice(1).join(' ');
            if (!message) {
                return ctx.reply('⚠️ Please provide a goodbye message.\n\n*Placeholders:*\n@user - Mention leaving member');
            }

            welcomeSettings.leaveMessage = message;
            await databaseService.updateDoc('groups', groupJid, {
                settings: { ...currentSettings, welcome: welcomeSettings }
            }, bot.tenantId);

            return ctx.reply('✅ Goodbye message updated!');
        }

        // Default: Show Status
        const status = welcomeSettings.enabled ? 'ON' : 'OFF';
        return ctx.reply(
            `👋 **Welcome Settings**\n\n` +
            `🔹 **Status**: ${status}\n` +
            `🔹 **Welcome Message**: ${welcomeSettings.message || '(Not Set)'}\n` +
            `🔹 **Goodbye Message**: ${welcomeSettings.leaveMessage || '(Not Set)'}\n\n` +
            `*Usage:*\n` +
            `!welcome on/off\n` +
            `!welcome set <message>\n` +
            `!welcome leave <message>`
        );
    }
};
