"use client";

import React, { useEffect, useState, useRef, ReactNode } from "react";
import { circuitBreaker } from "../../lib/api/apiCircuitBreaker";
import { createGatewayClient } from "../../lib/gateway/gateway-client";
import { GatewayContext, GatewayContextState } from "../../lib/gateway/gateway-hooks";
import { GatewayRpc } from "../../lib/gateway/gateway-rpc";

interface GatewayProviderProps {
  url: string;
  getToken?: () => Promise<string>;
  children: ReactNode;
}

export const GatewayProvider: React.FC<GatewayProviderProps> = ({ url, getToken, children }) => {
  const [state, setState] = useState<GatewayContextState>({
    rpc: null,
    status: "connecting",
    error: null,
    isHalted: false,
  });

  const clientRef = useRef<ReturnType<typeof createGatewayClient> | null>(null);

  useEffect(() => {
    const client = createGatewayClient({
      url,
      getToken: getToken || (async () => ""),
      onStatusChange: (status) => {
        if (status === "connected") {
          circuitBreaker.unblockGroup("omnichannel");
        }
        setState((prev) => ({
          ...prev,
          status,
          isHalted: client.isHalted,
        }));
      },
      onAuthFailed: (err) => {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: new Error(err.message),
          isHalted: true,
        }));
      },
    });
    clientRef.current = client;

    const rpc = new GatewayRpc(client);
    setState((prev) => ({ ...prev, rpc }));

    client.connect().catch((err: Error) => {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err,
        isHalted: client.isHalted,
      }));
    });

    return () => {
      client.disconnect();
    };
  }, [url, getToken]);

  return <GatewayContext.Provider value={state}>{children}</GatewayContext.Provider>;
};
