"use client";

import { useEffect } from "react";
import { useSocket } from "@/hooks/useSocket";
import { logger } from "@/lib/logger";
import { useOmnichannelStore } from "@/stores/useOmnichannelStore";
import type { Channel } from "@/types";

/**
 * OmnichannelSocketManager
 *
 * A headless component that handles WebSocket subscriptions for the Omnichannel Hub
 * and keeps the Zustand store in sync with the backend.
 */
export function OmnichannelSocketManager(): null {
  const { on, isConnected } = useSocket();
  const { fetchAllChannels, handleProgressUpdate, addActivityEvent, updateChannelStatus } =
    useOmnichannelStore();

  // Effect 1: Initial data fetch on mount — uses fetchAllChannels so channels assigned
  // to non-system_default agents are included. fetchChannels() only retrieves
  // system_default channels and replaces the entire store, which would wipe out any
  // channels under other agents if it resolved after fetchAllChannels.
  useEffect(() => {
    fetchAllChannels();
  }, [fetchAllChannels]);

  // Effect 2: Socket event subscriptions — re-runs when the socket connects or reconnects.
  // `on()` captures socketRef.current at call-time, so we must wait until isConnected is true
  // before registering listeners; otherwise the socket ref is null and returns a no-op.
  useEffect(() => {
    if (!isConnected) return;

    // Subscribe to Bot Progress Updates (Connecting, Initializing, etc.)
    const cleanupProgress = on("bot_progress_update", (data) => {
      logger.info("[Omnichannel] Progress Update:", data);
      handleProgressUpdate(data as Parameters<typeof handleProgressUpdate>[0]);
    });

    // Subscribe to Activity Events (Messages, Skills, etc.)
    const cleanupActivity = on("activity_event", (data) => {
      logger.info("[Omnichannel] Activity Event:", data);
      addActivityEvent(data as Parameters<typeof addActivityEvent>[0]);
    });

    // Subscribe to Connection Status Updates
    const cleanupChannelStatus = on("channel_status_update", (data) => {
      logger.info("[Omnichannel] Channel Status Update:", data);
      const update = data as { channelId: string; status: Channel["status"] };
      updateChannelStatus(update.channelId, update.status);
    });

    // Subscribe to Logs
    const cleanupLogs = on("bot_log", (data) => {
      const log = data as { botId?: string; message?: string; timestamp?: string };
      addActivityEvent({
        botId: log.botId ?? "system",
        channel: "system",
        type: "system",
        message: log.message ?? "",
        timestamp: log.timestamp || new Date().toISOString(),
      });
    });

    return () => {
      cleanupProgress();
      cleanupActivity();
      cleanupChannelStatus();
      cleanupLogs();
    };
  }, [isConnected, on, handleProgressUpdate, addActivityEvent, updateChannelStatus]);

  return null; // Headless component
}
