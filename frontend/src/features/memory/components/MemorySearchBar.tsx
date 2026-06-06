"use client";

import { Search, X } from "lucide-react";
import React, { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MemorySearchResult } from "../types";

interface MemorySearchBarProps {
  onSearch: (query: string) => Promise<void>;
  onClear: () => void;
  results: MemorySearchResult[];
  isSearching: boolean;
  query: string;
  disabled?: boolean;
  className?: string;
}

/**
 * MemorySearchBar
 *
 * Semantic search input for the agent's on-device memory.
 * Debounced: waits 350ms after the user stops typing before calling onSearch.
 * Results are shown inline below the input.
 *
 * Accessibility: role="search", aria-label, keyboard navigable results.
 */
function MemorySearchBar({
  onSearch,
  onClear,
  results,
  isSearching,
  query,
  disabled = false,
  className,
}: MemorySearchBarProps): React.JSX.Element {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!value.trim()) {
        onClear();
        return;
      }
      debounceRef.current = setTimeout(() => {
        void onSearch(value);
      }, 350);
    },
    [onSearch, onClear],
  );

  const handleClear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onClear();
  }, [onClear]);

  const hasResults = results.length > 0;
  const hasQuery = query.trim().length > 0;

  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      role="search"
      aria-label="Search agent memory"
    >
      <div className="relative flex items-center">
        <Search
          className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Search memory…"
          onChange={handleChange}
          disabled={disabled || isSearching}
          className="pl-9 pr-9"
          aria-label="Search memory query"
          aria-busy={isSearching}
        />
        {hasQuery ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 h-7 w-7"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>

      {isSearching ? (
        <p className="text-xs text-muted-foreground px-1" aria-live="polite">
          Searching…
        </p>
      ) : null}

      {!isSearching && hasQuery && !hasResults ? (
        <p className="text-xs text-muted-foreground px-1" aria-live="polite">
          No memories matched &ldquo;{query}&rdquo;
        </p>
      ) : null}

      {!isSearching && hasResults ? (
        <ul
          className="flex flex-col gap-1"
          role="list"
          aria-label={`${results.length} memory result${results.length !== 1 ? "s" : ""}`}
        >
          {results.map((result, i) => (
            <li key={i} className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <p className="text-foreground leading-snug">{result.text}</p>
              {result.score !== undefined && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Relevance: {Math.round(result.score * 100)}%
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
