"use client";

import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, WifiOff } from "lucide-react";
import React, { useEffect, useState } from "react";
import { circuitBreaker } from "@/lib/api/apiCircuitBreaker";
import { useGateway } from "@/lib/gateway/gateway-hooks";

export function ConnectionStatus(): React.JSX.Element | null {
  const [status, setStatus] = useState<"CLOSED" | "OPEN" | "HALF_OPEN">(
    circuitBreaker.getState("omnichannel"),
  );

  const { status: gatewayStatus, isHalted: gatewayHalted } = useGateway();

  useEffect(() => {
    const unsubscribe = circuitBreaker.subscribe((group, newState) => {
      if (group === "omnichannel" || group === "auth") {
        setStatus(newState);
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const isHttpOk = status === "CLOSED";
  const isGatewayOk = gatewayStatus === "connected" && !gatewayHalted;

  if (isHttpOk && isGatewayOk) {
    return null;
  }

  const isError = status === "OPEN" || gatewayStatus === "error" || gatewayHalted;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="w-full bg-destructive/10 border-b border-destructive/20"
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-destructive">
            {isError ? (
              <WifiOff className="h-5 w-5" />
            ) : (
              <RefreshCw className="h-5 w-5 animate-spin" />
            )}
            <div className="flex flex-col">
              <span className="font-semibold text-sm">
                {isError ? "Connection Lost" : "Reconnecting..."}
              </span>
              <span className="text-xs opacity-90">
                {gatewayHalted
                  ? "Gateway authentication failed or token revoked."
                  : isError
                    ? "The autonomous engine is currently unreachable. Retrying automatically."
                    : "Attempting to re-establish connection to the omnichannel mesh."}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
