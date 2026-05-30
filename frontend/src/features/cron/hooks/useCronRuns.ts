import { useCallback, useEffect, useState, useRef } from "react";
import { useOmnichannelStore } from "@/stores/useOmnichannelStore";

interface UseCronRunsOptions {
  interval?: number;
  enabled?: boolean;
}

export function useCronRuns(jobId: string, options: UseCronRunsOptions = {}) {
  const { interval = 5000, enabled = true } = options;
  const { cronRuns, fetchCronRuns } = useOmnichannelStore();
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const runs = cronRuns[jobId] || [];

  const refresh = useCallback(async () => {
    if (!jobId) return;
    setIsLoading(true);
    try {
      await fetchCronRuns(jobId);
    } finally {
      setIsLoading(false);
    }
  }, [jobId, fetchCronRuns]);

  useEffect(() => {
    if (!jobId || !enabled) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    refresh();

    timerRef.current = setInterval(refresh, interval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [jobId, enabled, interval, refresh]);

  return {
    runs,
    isLoading,
    refresh,
  };
}
