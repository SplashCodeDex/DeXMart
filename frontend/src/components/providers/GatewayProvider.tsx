"use client";

import React, { useEffect, useState, useRef, ReactNode } from "react";
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
    });
    clientRef.current = client;

    const rpc = new GatewayRpc(client);

    client
      .connect()
      .then(() => {
        setState((prev) => ({
          ...prev,
          rpc,
          status: "connected",
          error: null,
          isHalted: client.isHalted,
        }));
      })
      .catch((err: Error) => {
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
