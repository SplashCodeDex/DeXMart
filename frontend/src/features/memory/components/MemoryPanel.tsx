"use client";

import { Brain, Trash2, Plus } from "lucide-react";
import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useMemoryPanel } from "../hooks/useMemoryPanel";
import { useMemoryStore } from "../stores/useMemoryStore";
import { MemorySearchBar } from "./MemorySearchBar";
import { MemoryStatusBadge } from "./MemoryStatusBadge";

interface MemoryPanelProps {
  className?: string;
}

/**
 * MemoryPanel
 *
 * The primary UI surface for the agent's on-device hybrid memory.
 * Surfaces:
 *   - MemoryStatusBadge: model loading state, ready/error indicator
 *   - MemorySearchBar: semantic search across the agent's active context
 *   - Recent memories: the last N memory items stored
 *   - Add memory: manual input for the user to inject context
 *   - Clear all: resets local DB (Firestore history is preserved)
 *
 * Layout: Card with header (status + controls) and scrollable content area.
 * Follows Hybrid FSD pattern: thin component, all logic in useMemoryPanel hook.
 */
export function MemoryPanel({ className }: MemoryPanelProps): React.JSX.Element {
  const { ready, loading, progress, error, search, remember, clear } = useMemoryPanel();

  const { recentMemories, searchResults, searchQuery, isSearching, clearSearch } = useMemoryStore();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addText, setAddText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleAddMemory = useCallback(async (): Promise<void> => {
    if (!addText.trim()) return;
    setIsAdding(true);
    try {
      await remember(addText.trim());
      setAddText("");
      setIsAddOpen(false);
    } finally {
      setIsAdding(false);
    }
  }, [addText, remember]);

  const handleClear = useCallback(async (): Promise<void> => {
    setIsClearing(true);
    try {
      await clear();
    } finally {
      setIsClearing(false);
    }
  }, [clear]);

  const showRecent = !searchQuery && recentMemories.length > 0;
  const showEmpty = !searchQuery && recentMemories.length === 0 && ready && !loading;

  return (
    <>
      <Card className={cn("flex flex-col", className)}>
        {/* Header */}
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="text-sm font-semibold">Agent Memory</span>
            </div>
            <MemoryStatusBadge ready={ready} loading={loading} progress={progress} error={error} />
          </div>

          {/* Search */}
          <div className="mt-3">
            <MemorySearchBar
              onSearch={search}
              onClear={clearSearch}
              results={searchResults}
              isSearching={isSearching}
              query={searchQuery}
              disabled={!ready}
            />
          </div>
        </CardHeader>

        <Separator />

        {/* Content */}
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-[320px]">
            <div className="flex flex-col gap-0 p-4">
              {/* Loading skeletons */}
              {loading && !ready ? (
                <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading memories">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-md" />
                  ))}
                </div>
              ) : null}

              {/* Recent memories (shown when not searching) */}
              {showRecent ? (
                <ul className="flex flex-col gap-2" aria-label="Recent agent memories">
                  {recentMemories.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <p className="text-foreground leading-snug">{item.text}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}

              {/* Empty state */}
              {showEmpty ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <Brain className="h-8 w-8 text-muted-foreground/40" aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">No memories yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Your agent will build context as it processes messages.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Error state */}
              {error && !loading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <p className="text-sm text-red-600">{error}</p>
                  <p className="text-xs text-muted-foreground">
                    Memory is unavailable. The agent will still work without persistent memory.
                  </p>
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </CardContent>

        <Separator />

        {/* Footer controls */}
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            disabled={!ready}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add memory
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={!ready || isClearing || recentMemories.length === 0}
            className="gap-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            {isClearing ? "Clearing…" : "Clear all"}
          </Button>
        </div>
      </Card>

      {/* Add memory dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to memory</DialogTitle>
            <DialogDescription>
              Add context your agent should remember. This is stored privately on your device and
              backed up as text in the cloud.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            placeholder="e.g. The user prefers concise responses and uses metric units."
            rows={4}
            className="resize-none"
            aria-label="Memory content"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground text-right">{addText.length}/500</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={isAdding}>
              Cancel
            </Button>
            <Button onClick={handleAddMemory} disabled={!addText.trim() || isAdding}>
              {isAdding ? "Adding…" : "Add memory"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
