import React from "react";
import { cn } from "@/lib/utils";

export type StatusBadgeStatus = "online" | "offline" | "error" | "connecting" | "warning";

interface StatusBadgeProps {
  status: StatusBadgeStatus;
  label?: string;
  size?: "default" | "sm";
  className?: string;
}

const statusConfig: Record<StatusBadgeStatus, { color: string; label: string; animate?: boolean }> =
  {
    online: { color: "bg-success", label: "Online" },
    offline: { color: "bg-muted-foreground", label: "Offline" },
    error: { color: "bg-error", label: "Error" },
    connecting: { color: "bg-info", label: "Connecting", animate: true },
    warning: { color: "bg-warning", label: "Warning" },
  };

export function StatusBadge({
  status,
  label,
  size = "default",
  className,
}: StatusBadgeProps): React.ReactElement {
  const config = statusConfig[status];
  const displayLabel = label || config.label;

  return (
    <div
      role="status"
      aria-label={`${status} status`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        size === "sm" && "gap-1.5 px-2 py-0 text-[10px]",
        "bg-secondary/50 text-foreground border border-border/50 backdrop-blur-sm",
        className,
      )}
    >
      <span className="relative flex h-2 w-2 items-center justify-center">
        {config.animate ? (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              config.color,
            )}
          />
        ) : null}
        <span
          data-status={status}
          className={cn("relative inline-flex h-2 w-2 rounded-full", config.color)}
        />
      </span>
      <span>{displayLabel}</span>
    </div>
  );
}
