'use client';

import React from 'react';

import { useCompaction } from './hooks/useCompaction';
import { useSessionDetail } from './hooks/useSessionDetail';

interface SessionDetailFeatureProps {
  sessionId: string;
}

export function SessionDetailFeature({ sessionId }: SessionDetailFeatureProps): React.JSX.Element {
  const { session, isLoading: isSessionLoading, error: sessionError, refresh: refreshSession } = useSessionDetail(sessionId);
  const { checkpoints, isLoading: isCompactionLoading, error: compactionError, refresh: refreshCompaction } = useCompaction(sessionId);

  const isLoading = isSessionLoading || isCompactionLoading;
  const error = sessionError || compactionError;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tighter uppercase truncate max-w-xl">
            {session?.label || session?.displayName || sessionId}
          </h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase font-black tracking-widest">
            <span>{session?.channel || 'No Channel'}</span>
            <span>•</span>
            <span>{session?.model || 'No Model'}</span>
            {session?.status ? <>
                <span>•</span>
                <span className={session.status === 'running' ? 'text-green-500' : ''}>{session.status}</span>
              </> : null}
          </div>
        </div>
        <button 
          onClick={() => { refreshSession(); refreshCompaction(); }}
          className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
        >
          Refresh
        </button>
      </div>

      {error ? <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
          {error}
        </div> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-8 bg-card border border-border rounded-3xl min-h-[400px] flex items-center justify-center text-muted-foreground italic font-medium">
            {isLoading ? 'Loading transcript...' : 'Transcript will be rendered here in Task 4.1.B.4'}
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-6 bg-card border border-border rounded-3xl space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Session Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Tokens</div>
                <div className="text-xl font-bold">{session?.totalTokens?.toLocaleString() || '0'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Est. Cost</div>
                <div className="text-xl font-bold">${session?.estimatedCostUsd?.toFixed(4) || '0.00'}</div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-3xl space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Checkpoints</h2>
            {isCompactionLoading && checkpoints.length === 0 ? (
              <div className="text-xs text-muted-foreground animate-pulse font-medium">Loading checkpoints...</div>
            ) : checkpoints.length === 0 ? (
              <div className="text-xs text-muted-foreground italic font-medium">No checkpoints found.</div>
            ) : (
              <div className="space-y-3">
                {checkpoints.map((cp) => (
                  <div key={cp.id} className="p-3 bg-background border border-border rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{cp.label || cp.id.slice(0, 8)}</span>
                      <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">{cp.reason}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(cp.updatedAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
