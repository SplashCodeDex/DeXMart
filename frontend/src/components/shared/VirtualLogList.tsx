import { useVirtualizer } from "@tanstack/react-virtual";
import React, { useRef } from "react";
import { cn } from "@/lib/utils";

interface VirtualLogListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  height?: number | string;
  estimateSize?: number;
  className?: string;
}

export function VirtualLogList<T>({
  items,
  renderItem,
  height = 400,
  estimateSize = 30,
  className,
}: VirtualLogListProps<T>): React.ReactElement {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 5,
  });

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-sm text-muted-foreground italic border border-dashed border-border/50 rounded-lg bg-secondary/5",
          className,
        )}
        style={{ height }}
      >
        No entries found
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn("overflow-auto border border-border/50 rounded-lg bg-secondary/5", className)}
      style={{ height }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
