import { XCircle, Loader2 } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";

interface AbortButtonProps {
  onAbort: () => void;
  isAborting?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function AbortButton({
  onAbort,
  isAborting = false,
  disabled = false,
  label = "Abort",
  className,
}: AbortButtonProps): React.ReactElement {
  const displayLabel = isAborting ? "Aborting..." : label;

  return (
    <button
      onClick={onAbort}
      disabled={disabled || isAborting}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
        "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    >
      {isAborting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
      <span>{displayLabel}</span>
    </button>
  );
}
