import { useState, useEffect } from "react";
import { api } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { logger } from "@/lib/logger";
import { useSocket } from "./useSocket";

interface ChannelStatusResult {
  status: Record<string, unknown> | null;
  qrCode: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useChannelStatus(
  channelId: string,
  agentId: string = "system_default",
  enabled: boolean = false,
): ChannelStatusResult {
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { on } = useSocket();

  useEffect(() => {
    if (!enabled || !channelId) {
      return;
    }

    // Track when QR was last updated via socket to prevent poll overwrites
    let lastSocketQrAt = 0;

    // MASTERMIND Goodie: Real-time Socket Updates
    const cleanupQrListener = on("channel_qr_update", (raw) => {
      const data = raw as Record<string, unknown>;
      if (data.channelId === channelId) {
        setQrCode(data.qrCode as string | null);
        lastSocketQrAt = Date.now();
      }
    });

    const cleanupStatusListener = on("channel_status_update", (raw) => {
      const data = raw as Record<string, unknown>;
      if (data.channelId === channelId) {
        setStatus((prev) => ({ ...(prev ?? {}), status: data.status }));
      }
    });

    let isMounted = true;

    const poll = async (): Promise<void> => {
      if (!isMounted) return;
      setIsLoading(true);
      try {
        // Poll Status
        const statusRes = await api.get<Record<string, unknown>>(
          API_ENDPOINTS.OMNICHANNEL.AGENTS.CHANNELS.STATUS(agentId, channelId),
        );

        if (!isMounted) return;

        if (statusRes.success) {
          setStatus(statusRes.data);
          setError(null);
          const statusData = statusRes.data;

          // If we need QR (connecting status or explicitly has QR)
          if (
            statusData.status === "connecting" ||
            statusData.status === "initializing" ||
            statusData.status === "qr_pending" ||
            statusData.hasQR
          ) {
            const timeSinceSocketQr = Date.now() - lastSocketQrAt;
            if (timeSinceSocketQr < 8000) {
              // Socket pushed a fresh QR recently, skip poll QR
            } else {
              const qrRes = await api.get<Record<string, unknown>>(
                API_ENDPOINTS.OMNICHANNEL.AGENTS.CHANNELS.QR_CODE(agentId, channelId),
              );

              if (!isMounted) return;

              if (qrRes.success && qrRes.data.qrCode) {
                setQrCode(qrRes.data.qrCode as string);
              } else {
                if (Date.now() - lastSocketQrAt > 8000) {
                  setQrCode(null);
                }
              }
            }
          } else {
            setQrCode(null);
          }
        } else {
          setError(statusRes.error?.message || "Failed to fetch status");
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Polling error");
          logger.error("[useChannelStatus] Polling error", err);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const interval = setInterval(poll, 10000); // Poll every 10s
    poll();

    return () => {
      isMounted = false;
      clearInterval(interval);
      cleanupQrListener();
      cleanupStatusListener();
    };
  }, [channelId, agentId, enabled, on]);

  return { status, qrCode, isLoading, error };
}
