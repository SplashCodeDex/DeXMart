"use client";

import { useEffect, useState } from "react";
import { useRpcCall } from "@/lib/gateway/gateway-hooks";
import type { ModelCatalogEntry } from "@/lib/gateway/models-types";

interface ModelSelectorProps {
  onSelect: (model: ModelCatalogEntry) => void;
  value?: string;
  placeholder?: string;
}

export function ModelSelector({
  onSelect,
  value,
  placeholder = "Search models…",
}: ModelSelectorProps) {
  const callModels = useRpcCall("models.list");
  const [models, setModels] = useState<ReadonlyArray<ModelCatalogEntry>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    callModels({})
      .then((res) => {
        if (!cancelled) {
          setModels(res.models);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = filter
    ? models.filter(
        (m) =>
          m.name.toLowerCase().includes(filter.toLowerCase()) ||
          m.provider.toLowerCase().includes(filter.toLowerCase()),
      )
    : models;

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading models"
        className="flex items-center justify-center p-4 text-muted-foreground text-sm"
      >
        Loading models…
      </div>
    );
  }

  if (error !== null) {
    return (
      <div
        role="alert"
        className="p-4 text-destructive text-sm bg-destructive/10 rounded-md border border-destructive/20"
      >
        Failed to load models: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        role="searchbox"
        type="search"
        value={filter}
        onChange={(e) => {
          setFilter(e.target.value);
        }}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {filtered.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No models available</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {filtered.map((model) => {
            const selected = model.id === value;
            return (
              <li key={model.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    onSelect(model);
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${selected ? "bg-accent text-accent-foreground font-medium" : ""}`}
                >
                  <span className="font-medium">{model.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{model.provider}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
