import { type ChannelAdapter, type ChannelId } from "./ChannelAdapter.js";

/**
 * Manages multiple channel adapters and routes messages to the correct channel.
 */
export class ChannelManager {
    private static instance: ChannelManager;
    private adapters: Map<ChannelId, ChannelAdapter> = new Map();

    private constructor() { }

    public static getInstance(): ChannelManager {
        if (!ChannelManager.instance) {
            ChannelManager.instance = new ChannelManager();
        }
        return ChannelManager.instance;
    }

    /**
   * Register a new channel adapter
   */
    public registerAdapter(adapter: ChannelAdapter): void {
        const key = adapter.instanceId || adapter.id;
        if (this.adapters.has(key)) {
            const oldAdapter = this.adapters.get(key)!;
            console.warn(`[ChannelManager] Shutting down stale adapter before overwrite for key: ${key}`);
            oldAdapter.shutdown().catch(e => console.error(`[ChannelManager] Stale adapter shutdown error:`, e));
        }
        this.adapters.set(key, adapter);
        console.log(`[ChannelManager] Registered adapter for key: ${key}`);
    }

    /**
     * Get an adapter by instance ID or channel ID
     */
    public getAdapter(key: string): ChannelAdapter | undefined {
        return this.adapters.get(key);
    }

    /**
     * Send a message to a specific channel instance
     */
    public async sendMessage(key: string, to: string, content: string): Promise<void> {
        const adapter = this.adapters.get(key);
        if (!adapter) {
            throw new Error(`No adapter registered for key: ${key}`);
        }
        await adapter.sendMessage(to, content);
    }

    /**
     * Shut down and unregister an adapter
     */
    public async shutdownAdapter(key: string): Promise<void> {
        const adapter = this.adapters.get(key);
        if (adapter) {
            console.log(`[ChannelManager] Shutting down adapter: ${key}`);
            try {
                await adapter.shutdown();
            } catch (err) {
                console.error(`[ChannelManager] Error during adapter shutdown for ${key}:`, err);
            } finally {
                // Always deregister, even if shutdown threw, to prevent zombie adapters
                this.adapters.delete(key);
            }
        }
    }

    /**
     * Get all registered keys
     */
    public getRegisteredChannelKeys(): string[] {
        return Array.from(this.adapters.keys());
    }
}

export const channelManager = ChannelManager.getInstance();
