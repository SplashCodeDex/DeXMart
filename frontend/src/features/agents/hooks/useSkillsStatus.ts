"use client";

import { useCallback, useEffect, useState } from "react";
import { useOmnichannelStore } from "@/stores/useOmnichannelStore";

interface UseSkillsStatusOptions {
  interval?: number;
  enabled?: boolean;
}

export function useSkillsStatus(options: UseSkillsStatusOptions = {}) {
  const { interval = 60000, enabled = true } = options;
  const [isLoading, setIsLoading] = useState(false);

  const {
    skillReport,
    skills,
    pluginApprovals,
    fetchSkillReport,
    fetchSkills,
    fetchPluginApprovals,
    toggleSkill,
    saveSkillKey,
    installSkill,
    resolvePluginApproval,
  } = useOmnichannelStore();

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchSkillReport(), fetchSkills(), fetchPluginApprovals()]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchSkillReport, fetchSkills, fetchPluginApprovals]);

  useEffect(() => {
    if (enabled) {
      refresh();
      if (interval > 0) {
        const timer = setInterval(refresh, interval);
        return () => clearInterval(timer);
      }
    }
    return undefined;
  }, [enabled, interval, refresh]);

  return {
    skillReport,
    toolsCatalog: skills,
    pluginApprovals,
    isLoading,
    refresh,
    toggleSkill,
    saveSkillKey,
    installSkill,
    resolvePluginApproval,
  };
}
