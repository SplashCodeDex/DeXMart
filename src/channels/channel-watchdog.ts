import logger from '@/utils/logger.js';
import { channelManager } from './ChannelManager.js';
import { multiTenantService } from '../multiTenantService.js';
import { channelService } from '../ChannelService.js';

class ChannelWatchdog {
    private static instance: ChannelWatchdog;
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;

    // Exponential backoff tracking: channelId -> { attempts, nextRetryTime }
    private retryTracker: Map<string, { attempts: number; nextRetryTime: number }> = new Map();

    private constructor() { }

    public static getInstance(): ChannelWatchdog {
        if (!ChannelWatchdog.instance) {
            ChannelWatchdog.instance = new ChannelWatchdog();
        }
        return ChannelWatchdog.instance;
    }

    /**
     * Start the watchdog loop
     * @param intervalMs How often to poll (default 60s)
     */
    public start(intervalMs: number = 60000): void {
        if (this.isRunning) return;

        this.isRunning = true;
        logger.info(`>>> [MASTERMIND] Starting ChannelWatchdog (interval: ${intervalMs}ms)`);

        this.intervalId = setInterval(() => {
            this.checkChannels().catch(err => {
                logger.error('[ChannelWatchdog] Check loop failed:', err);
            });
        }, intervalMs);
    }

    /**
     * Stop the watchdog loop
     */
    public stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        logger.info('<<< [MASTERMIND] Stopped ChannelWatchdog');
    }

    /**
     * The core healing loop
     */
    private async checkChannels(): Promise<void> {
        const tenants = await multiTenantService.listTenants();
        const now = Date.now();
        let checkedCount = 0;
        let healedCount = 0;

        for (const tenant of tenants) {
            if (tenant.status !== 'active') continue;

            const channelsResult = await channelService.getAllChannelsAcrossAgents(tenant.id);
            if (!channelsResult.success) continue;

            for (const channel of channelsResult.data) {
                checkedCount++;

                // We only care if Firestore thinks it SHOULD be connected.
                // If it's explicitly disconnected by a user, we leave it alone.
                if (channel.status === 'connected' || channel.status === 'connecting' || channel.status === 'qr_pending') {
                    const adapter = channelManager.getAdapter(channel.id);

                    if (!adapter) {
                        // It's supposed to be alive, but it's dead in memory.
                        const backoff = this.retryTracker.get(channel.id);

                        // Check if we are still in a cooldown period
                        if (backoff && now < backoff.nextRetryTime) {
                            continue; // Skip this tick for this channel
                        }

                        logger.warn(`[ChannelWatchdog] Dead channel detected: ${channel.id} (${channel.name}). Attempting auto-heal...`);

                        try {
                            // ALWAYS cleanly wipe the broken memory state first
                            await channelManager.shutdownAdapter(channel.id);

                            // Attempt to restart
                            const startResult = await channelService.startChannel(tenant.id, channel.id, channel.assignedAgentId || undefined);

                            if (startResult.success) {
                                logger.info(`[ChannelWatchdog] ✅ Successfully healed channel ${channel.id}`);
                                this.retryTracker.delete(channel.id); // Reset backoff on success
                                healedCount++;
                            } else {
                                throw startResult.error;
                            }
                        } catch (err: any) {
                            logger.error(`[ChannelWatchdog] ❌ Failed to heal channel ${channel.id}:`, err.message || err);
                            const maxReached = this.applyBackoff(channel.id, now);
                            if (maxReached) {
                                logger.error(`[ChannelWatchdog] 🚨 Channel ${channel.id} reached MAX BACKOFF. Marking as 'error' in Firestore.`);
                                await channelService.updateChannel(tenant.id, channel.id, {
                                    status: 'error'
                                }, channel.assignedAgentId || undefined).catch(e => {
                                    logger.error(`[ChannelWatchdog] Failed to set error status for ${channel.id}:`, e);
                                });
                                this.retryTracker.delete(channel.id);
                            }
                        }
                    } else {
                        // It's healthy. Clear any lingering backoff.
                        if (this.retryTracker.has(channel.id)) {
                            this.retryTracker.delete(channel.id);
                        }
                    }
                }
            }
        }

        if (healedCount > 0) {
            logger.info(`[ChannelWatchdog] Check complete. Verified ${checkedCount} channels. Healed: ${healedCount}.`);
        }
    }

    /**
     * Exponential backoff calculator
     * Cap at 30 minutes max delay.
     * Returns true if max attempts threshold is reached (>= 7 attempts).
     */
    private applyBackoff(channelId: string, now: number): boolean {
        const current = this.retryTracker.get(channelId) || { attempts: 0, nextRetryTime: 0 };
        current.attempts += 1;

        // Base 30 seconds
        const delayMs = Math.min(30000 * Math.pow(2, current.attempts - 1), 1800000); // Max 30 mins
        current.nextRetryTime = now + delayMs;

        this.retryTracker.set(channelId, current);

        const delayMins = (delayMs / 60000).toFixed(1);
        logger.warn(`[ChannelWatchdog] Backoff applied for ${channelId}. Attempt ${current.attempts}. Next retry in ~${delayMins} mins.`);

        return current.attempts >= 7;
    }
}

export const channelWatchdog = ChannelWatchdog.getInstance();
