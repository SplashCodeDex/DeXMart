"use client";

import { Brain, Loader2 } from "lucide-react";
import React from "react";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MemoryInitProgress } from "../types";

interface MemoryStatusBadgeProps {
  ready: boolean;
  loading: boolean;
  progress: MemoryInitProgress | null;
  error: string | null;
  className?: string;
}

const STAGE_LABELS: Record<MemoryInitProgress["stage"], string> = {
  loading_model: "Loading AI model",
  rehydrating: "Restoring memories",
};

/**
 * MemoryStatusBadge
 *
 * Shows the current state of the on-device memory worker:
 *   - Loading: spinner + progress bar with stage label
 *   - Ready: green brain icon + "Memory ready" tooltip
 *   - Error: red brain icon + error message tooltip
 *
 * No emojis. Uses lucide-react Brain icon.
 * Follows the project's Tailwind spacing tokens and focus-visible rules.
 */
function MemoryStatusBadge({
  ready,
  loading,
  progress,
  error,
  className,
}: MemoryStatusBadgeProps): React.JSX.Element {
  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        {loading ? (
          <div className="flex flex-col gap-1 min-w-[140px]">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {progress ? STAGE_LABELS[progress.stage] : "Starting memory"}
              </span>
            </div>
            {progress ? (
              <Progress
                value={progress.pct}
                className="h-1"
                aria-label={`${STAGE_LABELS[progress.stage]}: ${progress.pct}%`}
              />
            ) : null}
          </div>
        ) : null}

        {!loading && ready ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 transition-colors"
                aria-label="Memory is active and ready"
              >
                <Brain className="h-3.5 w-3.5" aria-hidden />
                Memory active
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">
                On-device AI memory is active. Your agent&apos;s context is stored privately on your
                device.
              </p>
            </TooltipContent>
          </Tooltip>
        ) : null}

        {!loading && error ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors"
                aria-label="Memory failed to load"
              >
                <Brain className="h-3.5 w-3.5" aria-hidden />
                Memory unavailable
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs text-red-600">{error}</p>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
