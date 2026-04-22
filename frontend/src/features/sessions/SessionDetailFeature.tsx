import { ChevronLeft, Info, MoreVertical, RefreshCcw, Save, Settings2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { toast } from 'sonner';

import { useCompaction } from './hooks/useCompaction';
import { useSessionDetail } from './hooks/useSessionDetail';

import { ModelSelector } from '@/components/shared/ModelSelector';
import { VirtualLogList } from '@/components/shared/VirtualLogList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useGateway } from '@/lib/gateway/gateway-hooks';

interface SessionDetailFeatureProps {
  sessionId: string;
}

export function SessionDetailFeature({ sessionId }: SessionDetailFeatureProps): React.JSX.Element {
  const router = useRouter();
  const { rpc } = useGateway();
  const { session, isLoading: isSessionLoading, error: sessionError, refresh: refreshSession } = useSessionDetail(sessionId);
  const { checkpoints, isLoading: isCompactionLoading, error: compactionError, refresh: refreshCompaction } = useCompaction(sessionId);

  const [isPatching, setIsPatching] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);

  const isLoading = isSessionLoading || isCompactionLoading;
  const error = sessionError || compactionError;

  const handlePatch = async (patch: any) => {
    setIsPatching(true);
    try {
      await rpc.call('sessions.patch', { key: sessionId, ...patch });
      toast.success('Session updated');
      refreshSession();
    } catch (err) {
      toast.error('Failed to update session');
    } finally {
      setIsPatching(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    try {
      await rpc.call('sessions.delete', { key: sessionId });
      toast.success('Session deleted');
      router.push('/dashboard/sessions');
    } catch (err) {
      toast.error('Failed to delete session');
    }
  };

  const renderMessage = (message: any, index: number) => {
    const isUser = message.role === 'user';
    return (
      <div key={index} className={`p-4 ${isUser ? 'bg-muted/30' : 'bg-background'} border-b border-border/50`}>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={isUser ? 'outline' : 'default'} className="uppercase text-[9px] font-black tracking-tighter px-1.5 py-0">
            {message.role}
          </Badge>
          <span className="text-[10px] text-muted-foreground font-mono">
            {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''}
          </span>
        </div>
        <div className="text-sm prose prose-invert max-w-none break-words">
          {typeof message.content === 'string' ? message.content : JSON.stringify(message.content, null, 2)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/sessions')} className="rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="space-y-0.5">
            <h1 className="text-2xl font-black tracking-tighter uppercase truncate max-w-xl">
              {session?.label || session?.displayName || sessionId.slice(0, 12)}
            </h1>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-black tracking-widest">
              <span>{session?.channel || 'No Channel'}</span>
              <span>•</span>
              <button 
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="hover:text-primary transition-colors flex items-center gap-1"
              >
                {session?.model || 'No Model'}
                <Settings2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { refreshSession(); refreshCompaction(); }} className="rounded-xl font-bold uppercase tracking-wider text-[10px]">
            <RefreshCcw className="w-3 h-3 mr-2" /> Refresh
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card border-border/50 backdrop-blur-xl">
              <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive cursor-pointer font-bold uppercase tracking-wider text-xs">
                <Trash2 className="w-4 h-4 mr-2" /> Delete Session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {showModelSelector && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest">Override Model</CardTitle>
            <CardDescription className="text-xs">Changes apply to future messages in this session.</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <ModelSelector 
              value={session?.model}
              onSelect={(model) => {
                handlePatch({ model });
                setShowModelSelector(false);
              }}
            />
          </CardContent>
        </Card>
      )}

      {error ? (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-bold">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <Card className="overflow-hidden border-border/50 rounded-3xl">
            <CardHeader className="bg-muted/30 border-b border-border/50 py-4 px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  Transcript
                  {session?.messages && (
                    <Badge variant="secondary" className="rounded-full text-[9px] px-1.5 py-0">
                      {session.messages.length}
                    </Badge>
                  )}
                </CardTitle>
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                  {isLoading ? 'Syncing...' : 'Live'}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <VirtualLogList 
                items={session?.messages || []}
                renderItem={renderMessage}
                height={600}
                estimateSize={80}
                className="border-0 rounded-none bg-transparent"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/50 rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50 py-4 px-6">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Info className="w-4 h-4" /> Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Tokens Used</div>
                  <div className="text-2xl font-bold tracking-tighter">{session?.totalTokens?.toLocaleString() || '0'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Est. Cost</div>
                  <div className="text-2xl font-bold tracking-tighter text-primary">${session?.estimatedCostUsd?.toFixed(4) || '0.0000'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Status</div>
                  <Badge variant={session?.status === 'running' ? 'default' : 'secondary'} className="rounded-full text-[9px] px-2 py-0 uppercase font-black tracking-tighter">
                    {session?.status || 'unknown'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50 py-4 px-6">
              <CardTitle className="text-sm font-black uppercase tracking-widest">Checkpoints</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {isCompactionLoading && checkpoints.length === 0 ? (
                <div className="text-xs text-muted-foreground animate-pulse font-medium">Loading checkpoints...</div>
              ) : checkpoints.length === 0 ? (
                <div className="text-xs text-muted-foreground italic font-medium">No checkpoints found.</div>
              ) : (
                <div className="space-y-3">
                  {checkpoints.map((cp) => (
                    <div key={cp.id} className="p-3 bg-background border border-border rounded-xl space-y-2 hover:border-primary/30 transition-colors cursor-pointer group">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{cp.label || cp.id.slice(0, 8)}</span>
                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter px-1 py-0 border-border/50">
                          {cp.reason}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground font-medium">
                        <span>{new Date(cp.updatedAt).toLocaleDateString()}</span>
                        <span>{cp.tokenCount.toLocaleString()} tkn</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
