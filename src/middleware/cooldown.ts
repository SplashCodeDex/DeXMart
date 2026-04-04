import { Middleware, MessageContext } from '../types/index.js';
import { rateLimiterService } from '../services/rateLimiter.js';

export const cooldownMiddleware: Middleware = async (ctx: MessageContext, next: () => Promise<void>) => {
  const tenantId = ctx.channel.tenantId;
  const userId = ctx.sender.jid;

  // 1. Channel-Level Global Cooldown (Strict enforcement for AI & Commands)
  const channelCooldownSec = (ctx.channel.config?.cooldownMs || 0) / 1000;
  if (channelCooldownSec > 0) {
    const globalKey = `global_cooldown:${tenantId}:${userId}`;
    const globalAllowed = await rateLimiterService.check(globalKey, {
      points: 1,
      duration: channelCooldownSec
    });

    if (!globalAllowed) {
      // 2026 Enhancement: Synchronize with presence
      if (ctx.sendPresenceUpdate) {
        await ctx.sendPresenceUpdate('paused');
      }
      await ctx.replyReact?.('⏳');
      return;
    }
  }

  // 2. Command-Specific Cooldown
  const cmd = ctx.commandDef || (ctx.used?.command ? ctx.channel.cmd?.get(ctx.used.command) : null);
  if (!cmd) {
    return next();
  }

  // 2. Command-Specific Cooldown
  const cooldownSec = (cmd as any).cooldown || 0;
  if (cooldownSec <= 0) return next();

  const commandName = cmd.name;

  // 3. Rate Limit Check
  const key = `cooldown:${tenantId}:${userId}:${commandName}`;
  const allowed = await rateLimiterService.check(key, {
    points: 1,
    duration: cooldownSec
  });

  if (!allowed) {
    await ctx.reply(`⏳ Please wait ${cooldownSec}s before using this command again.`);
    return;
  }

  return next();
};
