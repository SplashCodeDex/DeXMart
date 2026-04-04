import DeXMartBrain from '../services/DeXMartBrain.js';
import moment from 'moment-timezone';
import { ActiveChannel, GlobalContext, MessageContext, ChannelMember, Command } from '../types/index.js';
import { cooldownMiddleware } from './cooldown.js';

/**
 * Check if user has enough coins
 * @returns {Promise<boolean>} true if BLOCKED (not enough coins), false if allowed
 */
const checkCoin = async (database: any, required: number | string, userDb: ChannelMember | null, senderId: string, isOwner: boolean): Promise<boolean> => {
    if (isOwner) return false;
    const requiredCoins = Number(required);
    const userCoins = userDb?.coin || 0;
    return userCoins < requiredCoins;
};

// Main bot middleware
const mainMiddleware = (channel: ActiveChannel, context: GlobalContext) => {
    const {
        database,
        tools: { cmd },
        config,
        formatter,
    } = context;
    const brain = new DeXMartBrain(channel, context);

    channel.use(cooldownMiddleware);

    channel.use(async (ctx: MessageContext, next: () => Promise<void>) => {
        // Common variables
        const isGroup = ctx.isGroup();
        const isPrivate = !isGroup;
        const senderJid = ctx.sender.jid;
        const senderId = ctx.getId(senderJid);
        const groupJid = isGroup ? ctx.id : null;
        const groupId = isGroup ? ctx.getId(groupJid!) : null;
        const isOwner = ctx.sender.isOwner;
        const isAdmin = isGroup ? await ctx.group().isAdmin(senderJid) : false;

        // Get database
        const userDb = await database.user.get(senderId, ctx.channel.tenantId);
        const groupDb = isGroup ? await database.group.get(groupId!, ctx.channel.tenantId) : null;

        // Process message with the brain
        await brain.processMessage(ctx);

        // Log incoming command
        if (isGroup && !ctx.isFromMe()) {
            context.logger.info(`Incoming command: ${ctx.used.command} from group: ${groupId} by: ${senderId}`);
        } else if (isPrivate && !ctx.isFromMe()) {
            context.logger.info(`Incoming command: ${ctx.used.command} from: ${senderId}`);
        }

        // Add user XP and handle level-ups
        const xpGain = 10;
        const xpToLevelUp = 100;
        let newUserXp = (userDb?.xp || 0) + xpGain;
        if (newUserXp >= xpToLevelUp) {
            const newUserLevel = (userDb?.level || 0) + 1;
            newUserXp -= xpToLevelUp;

            if (userDb?.autolevelup) {
                await ctx.reply({
                    text: formatter.quote(`Congratulations! You have leveled up to level ${newUserLevel}.`),
                });
            }

            await database.user.update(senderId, { xp: newUserXp, level: newUserLevel }, ctx.channel.tenantId);
        } else {
            await database.user.update(senderId, { xp: newUserXp }, ctx.channel.tenantId);
        }

        // Simulate typing
        const simulateTyping = () => {
            // 2026: Auto-typing behavior
            ctx.simulateTyping();
        };

        // Check restriction conditions
        const restrictions = [
            {
                key: 'banned',
                condition: userDb?.banned && ctx.used.command !== 'owner',
                msg: config.msg.banned,
                reaction: '🚫',
            },
            {
                key: 'gamerestrict',
                condition:
                    (groupDb as any)?.option?.gamerestrict &&
                    isGroup &&
                    !isAdmin &&
                    ctx.channel.cmd.get(ctx.used.command)?.category === 'game',
                msg: config.msg.gamerestrict,
                reaction: '🎮',
            },
            {
                key: 'privatePremiumOnly',
                condition:
                    config.system.privatePremiumOnly &&
                    isPrivate &&
                    !isOwner &&
                    !userDb?.premium &&
                    !['price', 'owner'].includes(ctx.used.command),
                msg: config.msg.privatePremiumOnly,
                reaction: '💎',
            },
            {
                key: 'requireChannelGroupMembership',
                condition:
                    config.system.requireChannelGroupMembership &&
                    !isOwner &&
                    !userDb?.premium &&
                    ctx.used.command !== 'channelgroup' &&
                    config.channel.groupJid &&
                    !(await ctx.group(config.channel.groupJid).members()).some(
                        jid => jid === senderJid
                    ),
                msg: config.msg.channelGroupMembership,
                reaction: '🚫',
            },
            {
                key: 'requireGroupSewa',
                condition:
                    config.system.requireGroupSewa &&
                    isGroup &&
                    !isOwner &&
                    !['price', 'owner'].includes(ctx.used.command) &&
                    (groupDb as any)?.sewa !== true,
                msg: config.msg.groupSewa,
                reaction: '🔒',
            },
            {
                key: 'unavailableAtNight',
                condition: (() => {
                    const now = moment().tz(config.system.timeZone);
                    const hour = now.hour();
                    return (
                        config.system.unavailableAtNight &&
                        !isOwner &&
                        !userDb?.premium &&
                        hour >= 0 &&
                        hour < 6
                    );
                })(),
                msg: config.msg.unavailableAtNight,
                reaction: '😴',
            },
        ];

        for (const { condition, msg, reaction, key } of restrictions) {
            if (condition) {
                const now = Date.now();
                const lastSentMsg = userDb?.lastSentMsg?.[key] || 0;
                const oneDay = 24 * 60 * 60 * 1000;
                if (!lastSentMsg || now - lastSentMsg > oneDay) {
                    simulateTyping();
                    await database.user.update(senderId, {
                        lastSentMsg: { ...userDb?.lastSentMsg, [key]: now },
                    }, ctx.channel.tenantId);
                    return await ctx.reply({
                        text: msg,
                    });
                }
                return await ctx.replyReact(reaction);
            }
        }

        // Check permission conditions
        const command = ctx.channel.cmd.get(ctx.used.command);
        if (!command) return await next();

        const permissions = command.permissions || {};
        const permissionChecks = [
            {
                key: 'admin' as const,
                condition: isGroup && !isAdmin,
                msg: config.msg.admin,
                reaction: '🛡️',
            },
            {
                key: 'channelAdmin' as const,
                condition: isGroup && !(await ctx.group().isChannelAdmin()),
                msg: config.msg.channelAdmin,
                reaction: '🤖',
            },
            {
                key: 'coin' as const,
                condition:
                    permissions.coin &&
                    config.system.useCoin &&
                    (await checkCoin(database, permissions.coin, userDb, senderId, isOwner)),
                msg: config.msg.coin,
                reaction: '💰',
            },
            {
                key: 'group' as const,
                condition: isPrivate,
                msg: config.msg.group,
                reaction: '👥',
            },
            {
                key: 'owner' as const,
                condition: !isOwner,
                msg: config.msg.owner,
                reaction: '👑',
            },
            {
                key: 'premium' as const,
                condition: !isOwner && !userDb?.premium,
                msg: config.msg.premium,
                reaction: '💎',
            },
            {
                key: 'private' as const,
                condition: isGroup,
                msg: config.msg.private,
                reaction: '📩',
            },
            {
                key: 'restrict' as const,
                condition: config.system.restrict,
                msg: config.msg.restrict,
                reaction: '🚫',
            },
        ];

        for (const { key, condition, msg, reaction } of permissionChecks) {
            const hasPermissionRequirement = (permissions as any)[key];
            if (hasPermissionRequirement && condition) {
                const now = Date.now();
                const lastSentMsg = userDb?.lastSentMsg?.[key] || 0;
                const oneDay = 24 * 60 * 60 * 1000;
                if (!lastSentMsg || now - lastSentMsg > oneDay) {
                    simulateTyping();
                    await database.user.update(senderId, {
                        lastSentMsg: { ...userDb?.lastSentMsg, [key]: now },
                    }, ctx.channel.tenantId);
                    return await ctx.reply({
                        text: msg,
                    });
                }
                return await ctx.replyReact(reaction);
            }
        }

        simulateTyping();
        await next(); // Continue to the next process
    });
};
export default mainMiddleware;
