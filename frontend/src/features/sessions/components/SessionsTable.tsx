'use client';

import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState, useMemo } from 'react';

import { useSessionsList } from '../hooks/useSessionsList';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type SortField = 'sessionId' | 'label' | 'channel' | 'model' | 'startedAt' | 'updatedAt' | 'status';
type SortOrder = 'asc' | 'desc';

function SortIcon({ 
  field, 
  sortField, 
  sortOrder 
}: { 
  field: SortField; 
  sortField: SortField; 
  sortOrder: SortOrder;
}): React.JSX.Element | null {
  if (sortField !== field) return null;
  return sortOrder === 'asc' ? <ChevronUp className="ml-1 w-3 h-3 inline" /> : <ChevronDown className="ml-1 w-3 h-3 inline" />;
}

export function SessionsTable(): React.JSX.Element {
  const router = useRouter();
  const { filteredSessions, isLoading, error } = useSessionsList();
  
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => {
      const fieldA = (a as any)[sortField] || 0;
      const fieldB = (b as any)[sortField] || 0;
      
      if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1;
      if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredSessions, sortField, sortOrder]);

  const toggleSort = (field: SortField): void => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  if (isLoading && filteredSessions.length === 0) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 w-full bg-card/50 border border-border/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center rounded-2xl border border-border bg-destructive/5 text-destructive font-bold">
        {error}
      </div>
    );
  }

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-border/50">
            <TableHead 
              className="cursor-pointer font-black uppercase tracking-widest text-[10px] py-4"
              onClick={() => toggleSort('sessionId')}
            >
              Key <SortIcon field="sessionId" sortField={sortField} sortOrder={sortOrder} />
            </TableHead>
            <TableHead 
              className="cursor-pointer font-black uppercase tracking-widest text-[10px] py-4"
              onClick={() => toggleSort('label')}
            >
              Agent <SortIcon field="label" sortField={sortField} sortOrder={sortOrder} />
            </TableHead>
            <TableHead 
              className="cursor-pointer font-black uppercase tracking-widest text-[10px] py-4"
              onClick={() => toggleSort('channel')}
            >
              Channel <SortIcon field="channel" sortField={sortField} sortOrder={sortOrder} />
            </TableHead>
            <TableHead 
              className="cursor-pointer font-black uppercase tracking-widest text-[10px] py-4"
              onClick={() => toggleSort('model')}
            >
              Model <SortIcon field="model" sortField={sortField} sortOrder={sortOrder} />
            </TableHead>
            <TableHead 
              className="cursor-pointer font-black uppercase tracking-widest text-[10px] py-4"
              onClick={() => toggleSort('startedAt')}
            >
              Created <SortIcon field="startedAt" sortField={sortField} sortOrder={sortOrder} />
            </TableHead>
            <TableHead 
              className="cursor-pointer font-black uppercase tracking-widest text-[10px] py-4"
              onClick={() => toggleSort('updatedAt')}
            >
              Updated <SortIcon field="updatedAt" sortField={sortField} sortOrder={sortOrder} />
            </TableHead>
            <TableHead 
              className="cursor-pointer font-black uppercase tracking-widest text-[10px] py-4"
              onClick={() => toggleSort('status')}
            >
              Status <SortIcon field="status" sortField={sortField} sortOrder={sortOrder} />
            </TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedSessions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-32 text-center text-muted-foreground italic font-medium">
                No sessions found.
              </TableCell>
            </TableRow>
          ) : (
            sortedSessions.map((session) => (
              <TableRow 
                key={session.sessionId}
                className="cursor-pointer hover:bg-muted/30 transition-colors group"
                onClick={() => router.push(`/dashboard/sessions/${session.sessionId}`)}
              >
                <TableCell className="font-mono text-[11px] font-bold opacity-70 group-hover:text-primary transition-colors">
                  {session.sessionId.slice(0, 12)}...
                </TableCell>
                <TableCell className="font-bold">
                  {session.label || session.displayName || 'Untitled Session'}
                </TableCell>
                <TableCell className="text-xs font-medium text-muted-foreground uppercase tracking-tight">
                  {session.channel || '—'}
                </TableCell>
                <TableCell className="text-xs font-medium text-muted-foreground opacity-80">
                  {session.model || '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {session.startedAt ? new Date(session.startedAt).toLocaleString() : '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(session.updatedAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  {session.status && (
                    <Badge variant={session.status === 'running' ? 'default' : 'secondary'} className="rounded-full text-[9px] px-2 py-0 uppercase font-black tracking-tighter">
                      {session.status}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
