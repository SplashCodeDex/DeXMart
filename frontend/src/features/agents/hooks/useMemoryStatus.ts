"use client";

import { useState, useEffect, useCallback } from "react";
import { useGateway, useRpcCall } from "@/lib/gateway/gateway-hooks";

export function useMemoryStatus() {
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useRpcCall("doctor.memory.status");
  const fetchDiary = useRpcCall("doctor.memory.dreamDiary");
  const patchConfig = useRpcCall("config.patch");
  const lookupSchema = useRpcCall("config.schema.lookup");

  const [diary, setDiary] = useState<any>(null);
  const [schema, setSchema] = useState<any>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statusRes, diaryRes, schemaRes] = await Promise.all([
        fetchStatus({}),
        fetchDiary({}),
        lookupSchema({ path: "plugins.entries.memory-core.config.dreaming" }),
      ]);
      setStatus(statusRes);
      setDiary(diaryRes);
      setSchema(schemaRes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [fetchStatus, fetchDiary, lookupSchema]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateConfig = async (patch: any) => {
    try {
      await patchConfig({
        raw: JSON.stringify({
          plugins: {
            entries: {
              "memory-core": {
                config: {
                  dreaming: patch,
                },
              },
            },
          },
        }),
      });
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const toggleDreaming = async (enabled: boolean) => {
    return updateConfig({ enabled });
  };

  return {
    status,
    diary,
    schema,
    isDreaming: !!status?.dreaming?.enabled,
    isLoading,
    error,
    refresh,
    toggleDreaming,
    updateConfig,
  };
}
