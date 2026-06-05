"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { circuitBreaker } from "@/lib/api/apiCircuitBreaker";
import { useGateway } from "@/lib/gateway/gateway-hooks";

export function ConnectionStatus(): null {
  const { status, isHalted } = useGateway();
  const [cbState, setCbState] = useState(circuitBreaker.getState("omnichannel"));
  const toastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
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
  const isConnected = status === "connected" && !isCbOpen && !isHalted;

  useEffect(() => {
    // Dismiss any existing toast before showing a new one
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }

    if (isHalted) {
      toastIdRef.current = toast.error("Authentication failed", {
        description: "Please check your credentials.",
        duration: Infinity,
      });
    } else if (isReconnecting) {
      toastIdRef.current = toast.loading("Reconnecting...", {
        description: "Attempting to restore connection to Gateway.",
      });
    } else if (isError) {
      toastIdRef.current = toast.error("Connection Lost", {
        description: "Attempting to restore service.",
        duration: Infinity,
      });
    } else if (isConnected) {
      // Optional: Show a brief success toast when recovering
      // toast.success("Connected", { description: "Service restored." });
    }
  }, [isHalted, isReconnecting, isError, isConnected]);

  return null;
}
