"use client";

import React from "react";
import { SessionsTable } from "./components/SessionsTable";
import { useSessionsList } from "./hooks/useSessionsList";

export function SessionsListFeature(): React.JSX.Element {
  const { isLoading, error, searchQuery, setSearchQuery, refresh } = useSessionsList();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tighter uppercase">Sessions</h1>
        <button
          onClick={() => refresh()}
          disabled={isLoading}
          className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
        >
          {isLoading ? "Refreshing..." : "Refresh List"}
        </button>
      </div>

      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search sessions..."
          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>

      {error ? (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
          {error}
        </div>
      ) : null}

      <SessionsTable />
    </div>
  );
}
