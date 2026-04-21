"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { GatewayRpc, MethodMap, EventMap } from "./gateway-rpc";

export type GatewayConnectionStatus = "connecting" | "connected" | "reconnecting" | "error";

export interface GatewayContextState {
  rpc: GatewayRpc | null;
  status: GatewayConnectionStatus;
  error: Error | null;
  isHalted: boolean;
}

export const GatewayContext = createContext<GatewayContextState | undefined>(undefined);

export function useGateway(): GatewayContextState {
  const ctx = useContext(GatewayContext);
  if (!ctx) {
    throw new Error("useGateway must be used within a GatewayProvider");
  }
  return ctx;
}

export function useRpcCall<M extends keyof MethodMap>(method: M) {
  const { rpc } = useGateway();

  return async (params: MethodMap[M]["params"]): Promise<MethodMap[M]["result"]> => {
    if (!rpc) {
      throw new Error("Gateway RPC is not available");
    }
    return rpc.call(method, params);
  };
}

export function useGatewayStream<E extends keyof EventMap>(event: E) {
  const { rpc } = useGateway();
  const [stream, setStream] = useState<
    Array<{ payload: EventMap[E]; meta: { seq?: number; stateVersion?: number } }>
  >([]);

  useEffect(() => {
    if (!rpc) {
      return undefined;
    }

    const unsubscribe = rpc.subscribe(event, (payload, meta) => {
      setStream((prev) => [...prev, { payload, meta }]);
    });

    return () => {
      unsubscribe();
    };
  }, [rpc, event]);

  return stream;
}
