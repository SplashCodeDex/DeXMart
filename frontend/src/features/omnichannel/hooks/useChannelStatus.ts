import { useState, useEffect, useCallback, useRef } from "react";
import { useGateway } from "@/lib/gateway/gateway-hooks";
import type { MethodMap } from "@/lib/gateway/gateway-rpc";

type ChannelsStatusResult = MethodMap["channels.status"]["result"];
type ChannelAccountSnapshot = ChannelsStatusResult["channelAccounts"][string][number];

interface UseChannelStatusOptions {
  interval?: number;
  enabled?: boolean;
}

export function useChannelStatus(options: UseChannelStatusOptions = {}) {
  const { interval = 5000, enabled = true } = options;
  const { rpc, status: gatewayStatus } = useGateway();
  const [data, setData] = useState<ChannelsStatusResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!rpc || gatewayStatus !== "connected") return;

    try {
      setIsLoading(true);
      const result = await rpc.call("channels.status", { probe: true });

      // Process result to add qrDataUrl if rawQr is present
      const processedResult = { ...result };
      if (processedResult.channelAccounts) {
        for (const channelId in processedResult.channelAccounts) {
          const accounts = processedResult.channelAccounts[channelId];
          if (accounts) {
            processedResult.channelAccounts[channelId] = accounts.map((acc) => {
              const probe = acc.probe as any;
              if (probe?.rawQr) {
                return {
                  ...acc,
                  probe: {
                    ...probe,
                    qrDataUrl: `data:image/png;base64,${probe.rawQr}`,
                  },
                };
              }
              return acc;
            });
          }
        }
      }

      setData(processedResult);
      setError(null);
    } catch (err) {
      console.error("[useChannelStatus] Failed to fetch channel status:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [rpc, gatewayStatus]);

  const logout = useCallback(
    async (channel: string, accountId?: string) => {
      if (!rpc) return;
      try {
        // Optimistic update
        setData((prev) => {
          if (!prev || !prev.channelAccounts[channel]) return prev;
          const updatedAccounts = prev.channelAccounts[channel].map((acc) => {
            if (
              acc.accountId === accountId ||
              (!accountId && acc.accountId === prev.channelDefaultAccountId[channel])
            ) {
              return { ...acc, status: "logged_out" as any, connected: false };
            }
            return acc;
          });
          return {
            ...prev,
            channelAccounts: {
              ...prev.channelAccounts,
              [channel]: updatedAccounts,
            },
          };
        });

        await rpc.call("channels.logout", { channel, accountId });
        await fetchStatus(); // Refresh status after logout
      } catch (err) {
        console.error("[useChannelStatus] Logout failed:", err);
        throw err;
      }
    },
    [rpc, fetchStatus],
  );

  useEffect(() => {
    if (!enabled || gatewayStatus !== "connected") {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    fetchStatus();

    timerRef.current = setInterval(fetchStatus, interval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, gatewayStatus, interval, fetchStatus]);

  return {
    channels: data?.channels ?? {},
    channelAccounts: data?.channelAccounts ?? {},
    channelOrder: data?.channelOrder ?? [],
    channelLabels: data?.channelLabels ?? {},
    channelDefaultAccountId: data?.channelDefaultAccountId ?? {},
    isLoading,
    error,
    logout,
    refresh: fetchStatus,
  };
}
