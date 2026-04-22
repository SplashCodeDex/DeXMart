'use client';

import React from 'react';

import { useSessionsList } from './hooks/useSessionsList';

export function SessionsListFeature(): React.JSX.Element {
  const { filteredSessions, isLoading, error, searchQuery, setSearchQuery, refresh } = useSessionsList();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tighter uppercase">Sessions</h1>
        <button 
          onClick={() => refresh()}
          disabled={isLoading}
          className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Refreshing...' : 'Refresh List'}
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

      {error ? <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
          {error}
        </div> : null}

      <div className="grid gap-4">
        {isLoading && filteredSessions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse font-medium">
            Loading sessions...
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
            No sessions found.
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div 
              key={session.sessionId}
              className="p-4 bg-card border border-border rounded-2xl hover:border-primary/50 transition-colors group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">
                    {session.label || session.displayName || session.sessionId}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase font-black tracking-widest">
                    <span>{session.channel || 'No Channel'}</span>
                    <span>•</span>
                    <span>{session.model || 'No Model'}</span>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Updated {new Date(session.updatedAt).toLocaleTimeString()}
                  </div>
                  {session.status ? <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
                      session.status === 'running' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                    }`}>
                      {session.status}
                    </span> : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
