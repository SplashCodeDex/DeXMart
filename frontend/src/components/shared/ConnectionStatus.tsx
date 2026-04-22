"use client";

import { AlertCircle, RefreshCw, Lock } from "lucide-react";
import React, { useEffect, useState } from "react";
import { circuitBreaker } from "@/lib/api/apiCircuitBreaker";
import { useGateway } from "@/lib/gateway/gateway-hooks";
import { cn } from "@/lib/utils";

export function ConnectionStatus(): React.ReactElement | null {
  const { status, isHalted } = useGateway();
  const [cbState, setCbState] = useState(circuitBreaker.getState("omnichannel"));

  useEffect(() => {
    // Sync circuit breaker state
    const unsubscribe = circuitBreaker.subscribe((group, state) => {
      if (group === "omnichannel") {
        setCbState(state);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const isCbOpen = cbState === "OPEN";
  const isError = status === "error" || isCbOpen;
  const isReconnecting = status === "reconnecting" && !isHalted;

  if (!isError && !isReconnecting && !isHalted) {
    return null;
  }

  let content = null;

  if (isHalted) {
    content = (
      <>
        <Lock className="h-4 w-4" />
        <span>Authentication failed</span>
        <span className="text-sm opacity-80">. Please check your credentials.</span>
      </>
    );
  } else if (isReconnecting) {
    content = (
      <>
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>Reconnecting...</span>
      </>
    );
  } else if (isError) {
    content = (
      <>
        <AlertCircle className="h-4 w-4" />
        <span>Connection Lost</span>
        <span className="text-sm opacity-80">. Attempting to restore service.</span>
      </>
    );
  }

  return (
    <div
      className={cn(
        "fixed top-4 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl backdrop-blur-md border animate-in fade-in zoom-in duration-300",
        isHalted
          ? "bg-error/90 text-error-foreground border-error/20"
          : isReconnecting
            ? "bg-warning/90 text-warning-foreground border-warning/20"
            : "bg-error/90 text-error-foreground border-error/20",
      )}
    >
      {content}
    </div>
  );
}
