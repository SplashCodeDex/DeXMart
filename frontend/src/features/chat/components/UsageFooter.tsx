import { Coins, Database, Zap } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useRpcCall } from "@/lib/gateway/gateway-hooks";
import { useChatStore } from "../store";

interface UsageFooterProps {
  sessionKey: string;
}

export function UsageFooter({ sessionKey }: UsageFooterProps) {
  const [usage, setUsage] = useState<any>(null);
  const callSessionsUsage = useRpcCall("sessions.usage");
  const isStreaming = useChatStore((state) => state.isStreaming);

  const fetchUsage = async () => {
    try {
      const res = await callSessionsUsage({ key: sessionKey });
      const firstSession = res.sessions[0];
      if (firstSession) {
        setUsage(firstSession.usage);
      }
    } catch (err) {
      console.error("Failed to fetch session usage", err);
    }
  };

  useEffect(() => {
    fetchUsage();
    // Poll while streaming or every 30s
    const interval = setInterval(fetchUsage, isStreaming ? 5000 : 30000);
    return () => clearInterval(interval);
  }, [sessionKey, isStreaming, callSessionsUsage]);

  if (!usage) return null;

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
    }).format(cost);
  };

  return (
    <div className="flex items-center gap-6 px-4 py-2 border-t border-border/30 bg-muted/20 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
      <div className="flex items-center gap-1.5">
        <Database className="h-3 w-3" />
        <span>
          Tokens: <span className="text-foreground">{usage.totalTokens || 0}</span>
        </span>
        <span className="opacity-50">
          (i: {usage.input || 0} / o: {usage.output || 0})
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Coins className="h-3 w-3" />
        <span>
          Cost: <span className="text-foreground">{formatCost(usage.totalCost || 0)}</span>
        </span>
      </div>

      {usage.latency && usage.latency.count > 0 && (
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3" />
          <span>
            Avg Latency:{" "}
            <span className="text-foreground">
              {(usage.latency.sum / usage.latency.count / 1000).toFixed(2)}s
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
