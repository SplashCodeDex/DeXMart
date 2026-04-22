import { GitBranch, History, RefreshCcw, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';

import { useCompaction } from '../hooks/useCompaction';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CompactionPanelProps {
  sessionId: string;
}

export function CompactionPanel({ sessionId }: CompactionPanelProps): React.JSX.Element {
  const { checkpoints, isLoading, restore, branch } = useCompaction(sessionId);
  
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string | null>(null);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
  const [branchLabel, setBranchLabel] = useState('');

  const handleRestore = async () => {
    if (!selectedCheckpoint) return;
    try {
      await restore(selectedCheckpoint);
      toast.success('Session restored to checkpoint');
      setIsRestoreDialogOpen(false);
    } catch (err) {
      toast.error('Failed to restore checkpoint');
    }
  };

  const handleBranch = async () => {
    if (!selectedCheckpoint) return;
    try {
      const newSessionId = await branch(selectedCheckpoint, branchLabel);
      if (newSessionId) {
        toast.success(`Branched to new session: ${newSessionId.slice(0, 8)}...`);
        setIsBranchDialogOpen(false);
        setBranchLabel('');
      }
    } catch (err) {
      toast.error('Failed to branch from checkpoint');
    }
  };

  if (isLoading && checkpoints.length === 0) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 w-full bg-card border border-border rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (checkpoints.length === 0) {
    return (
      <Card className="border-dashed border-border/50 bg-secondary/5">
        <CardContent className="h-32 flex flex-col items-center justify-center text-muted-foreground italic gap-2">
          <History className="w-8 h-8 opacity-20" />
          <p className="text-sm">No checkpoints available for this session.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative pl-8 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border/50">
        {checkpoints.map((cp, index) => (
          <div key={cp.id} className="relative">
            <div className={`absolute -left-[30px] top-1 w-5 h-5 rounded-full border-4 border-background z-10 ${index === 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
            
            <Card className={`overflow-hidden border-border/50 hover:border-primary/30 transition-colors group ${selectedCheckpoint === cp.id ? 'ring-2 ring-primary/20 border-primary/30' : ''}`} onClick={() => setSelectedCheckpoint(cp.id)}>
              <CardHeader className="py-4 px-5 bg-muted/20 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black uppercase tracking-widest">{cp.label || `Checkpoint ${cp.id.slice(0, 6)}`}</span>
                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter px-1 py-0">
                      {cp.reason}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-bold font-mono">
                    {new Date(cp.updatedAt).toLocaleString()}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground">Tokens</div>
                    <div className="text-sm font-bold">{cp.tokenCount?.toLocaleString() || '0'}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground">Messages</div>
                    <div className="text-sm font-bold">{cp.messageCount?.toLocaleString() || '0'}</div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 rounded-xl font-bold uppercase tracking-wider text-[10px] h-8"
                    onClick={(e) => { e.stopPropagation(); setSelectedCheckpoint(cp.id); setIsRestoreDialogOpen(true); }}
                  >
                    <RefreshCcw className="w-3 h-3 mr-2" /> Restore
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 rounded-xl font-bold uppercase tracking-wider text-[10px] h-8"
                    onClick={(e) => { e.stopPropagation(); setSelectedCheckpoint(cp.id); setIsBranchDialogOpen(true); }}
                  >
                    <GitBranch className="w-3 h-3 mr-2" /> Branch
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Restore Confirmation Dialog */}
      <Dialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="uppercase font-black tracking-tight">Restore Session</DialogTitle>
            <DialogDescription>
              This will overwrite the current session state with the selected checkpoint. 
              Active runs will be interrupted. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsRestoreDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRestore}>Confirm Restore</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Branch Dialog */}
      <Dialog open={isBranchDialogOpen} onOpenChange={setIsBranchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="uppercase font-black tracking-tight">Branch Session</DialogTitle>
            <DialogDescription>
              Create a new session starting from this checkpoint. 
              The current session will remain unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="branch-label">New Session Label</Label>
              <Input
                id="branch-label"
                value={branchLabel}
                onChange={(e) => setBranchLabel(e.target.value)}
                placeholder="e.target.value"
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsBranchDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBranch}>Create Branch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
