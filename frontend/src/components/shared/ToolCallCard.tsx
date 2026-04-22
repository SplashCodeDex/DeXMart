import { ChevronDown, Terminal, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import React, { useState } from "react";
import { cn } from "@/lib/utils";

export type ToolCallStatus = "pending" | "running" | "success" | "error";

interface ToolCallCardProps {
  toolName: string;
  params?: Record<string, unknown>;
  result?: unknown;
  status?: ToolCallStatus;
  defaultOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
  className?: string;
}

const statusConfig: Record<
  ToolCallStatus,
  { icon: React.ReactNode; color: string; animate?: boolean }
> = {
  pending: {
    icon: <Clock className="h-3 w-3" />,
    color: "text-muted-foreground",
  },
  running: {
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    color: "text-primary",
    animate: true,
  },
  success: {
    icon: <CheckCircle2 className="h-3 w-3" />,
    color: "text-success",
  },
  error: {
    icon: <XCircle className="h-3 w-3" />,
    color: "text-error",
  },
};

export function ToolCallCard({
  toolName,
  params,
  result,
  status = "success",
  defaultOpen = false,
  onToggle,
  className,
}: ToolCallCardProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const config = statusConfig[status];

  const toggle = (): void => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    onToggle?.(nextState);
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden",
        className,
      )}
    >
      <button
        onClick={toggle}
        aria-label={toolName}
        className="flex w-full items-center justify-between p-3 hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-mono font-medium">{toolName}</span>
          <div
            data-status={status}
            className={cn(
              "flex items-center gap-1 text-[10px] font-medium uppercase",
              config.color,
            )}
          >
            {config.icon}
            <span>{status}</span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen ? (
        <div className="p-3 pt-0 space-y-3 border-t border-border/20 bg-secondary/5">
          {params ? (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Arguments
              </div>
              <pre className="rounded-md bg-secondary/30 p-2 text-xs font-mono overflow-x-auto">
                {JSON.stringify(params, null, 2)}
              </pre>
            </div>
          ) : null}
          {result ? (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Result
              </div>
              <pre className="rounded-md bg-secondary/30 p-2 text-xs font-mono overflow-x-auto">
                {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
