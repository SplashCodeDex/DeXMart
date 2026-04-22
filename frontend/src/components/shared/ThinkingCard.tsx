import { ChevronDown, BrainCircuit, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface ThinkingCardProps {
  content: string;
  isStreaming?: boolean;
  defaultOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
  className?: string;
}

export function ThinkingCard({
  content,
  isStreaming = false,
  defaultOpen = false,
  onToggle,
  className,
}: ThinkingCardProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen);

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
        aria-label="Thinking"
        className="flex w-full items-center justify-between p-3 hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <BrainCircuit className="h-4 w-4" />
          <span>Thinking</span>
          {isStreaming ? (
            <Loader2 data-streaming="true" className="h-3 w-3 animate-spin text-primary" />
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen ? (
        <div className="p-3 pt-0 text-sm text-muted-foreground border-t border-border/20 bg-secondary/10">
          <pre className="whitespace-pre-wrap font-sans leading-relaxed italic">{content}</pre>
        </div>
      ) : null}
    </div>
  );
}
