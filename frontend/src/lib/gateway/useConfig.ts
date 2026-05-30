"use client";

import { useState, useCallback, useEffect } from "react";
import { useGateway } from "./gateway-hooks";

export function useConfig() {
  const { rpc, status } = useGateway();
  const [baseHash, setBaseHash] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  const fetchConfig = useCallback(async () => {
    if (!rpc || status !== "connected") return;
    setIsLoading(true);
    try {
      const res = await rpc.call("config.get", {});
      if (res.baseHash) {
        setBaseHash(res.baseHash);
      }
    } catch (err) {
      console.error("Failed to fetch config for baseHash:", err);
    } finally {
      setIsLoading(false);
    }
  }, [rpc, status]);

  useEffect(() => {
    if (status === "connected") {
      fetchConfig();
    }
  }, [status, fetchConfig]);

  return {
    baseHash,
    isLoading,
    refresh: fetchConfig,
  };
}
