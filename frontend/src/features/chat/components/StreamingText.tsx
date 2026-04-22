import React from "react";
import { StaggeredEnter, StaggeredItem } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

export function StreamingText({ content, className }: { content: string; className?: string }) {
  const chars = Array.from(content);

  return (
    <div data-testid="streaming-text">
      <StaggeredEnter className={cn("inline-block", className)} staggerDelay={0.01}>
        {chars.map((char, i) => (
          <StaggeredItem key={i} className="inline">
            <span className="inline">{char}</span>
          </StaggeredItem>
        ))}
      </StaggeredEnter>
    </div>
  );
}
