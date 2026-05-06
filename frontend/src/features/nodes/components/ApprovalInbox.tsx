"use client";

import { AlertTriangle, Check, Clock, ShieldAlert, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useExecApprovalDetail } from "../hooks/useExecApprovalDetail";
import { useExecApprovals } from "../hooks/useExecApprovals";

export function ApprovalInbox() {
  const [pending, setPending] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { listPending } = useExecApprovals();

  const fetchPending = async () => {
    try {
      const res = await listPending();
      setPending(res || []);
    } catch (err) {
      console.error("Failed to fetch pending approvals:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 5000); // Poll every 5s for responsiveness
    return () => clearInterval(interval);
  }, []);

  if (isLoading && pending.length === 0) return null;
  if (pending.length === 0) return null;

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-warning" />
        <h3 className="text-lg font-bold">Execution Inbox</h3>
        <Badge variant="warning" className="rounded-full px-2">
          {pending.length}
        </Badge>
      </div>
      <div className="grid gap-4">
        {pending.map((item) => (
          <ApprovalItem key={item.id} item={item} onResolved={fetchPending} />
        ))}
      </div>
    </div>
  );
}

function ApprovalItem({ item, onResolved }: { item: any; onResolved: () => void }) {
  const { resolve } = useExecApprovalDetail(item.id);
  const [isResolving, setIsResolving] = useState(false);
  const [timeLeft, setTimeLeft] = useState(
    Math.max(0, Math.round((item.expiresAtMs - Date.now()) / 1000)),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const newTime = Math.max(0, Math.round((item.expiresAtMs - Date.now()) / 1000));
      setTimeLeft(newTime);
      if (newTime === 0) onResolved();
    }, 1000);
    return () => clearInterval(timer);
  }, [item.expiresAtMs, onResolved]);

  const handleResolve = async (decision: string) => {
    setIsResolving(true);
    try {
      await resolve({ decision });
      toast.success(`Request ${decision}ed`);
      onResolved();
    } catch (err) {
      toast.error("Failed to resolve request");
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <Card className="border-warning/20 bg-warning/5 backdrop-blur-md overflow-hidden animate-in fade-in slide-in-from-right-4 shadow-lg border-l-4 border-l-warning">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono h-4 py-0 bg-background/50">
                {item.request.nodeId
                  ? `NODE: ${item.request.nodeId.substring(0, 8)}...`
                  : item.request.host?.toUpperCase() || "GATEWAY"}
              </Badge>
              <span
                className={`text-[10px] flex items-center gap-1 font-bold ${timeLeft < 30 ? "text-error animate-pulse" : "text-muted-foreground"}`}
              >
                <Clock className="h-3 w-3" />
                {timeLeft}s
              </span>
            </div>
            <div className="font-mono text-xs bg-black/40 p-3 rounded-lg border border-white/5 break-all text-warning-foreground/90 selection:bg-warning/30">
              <span className="text-warning/50 mr-2">$</span>
              {item.request.command}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
              <span className="font-bold text-muted-foreground">
                {item.request.agentId || "System"}
              </span>
              <span>•</span>
              <span>{new Date(item.createdAtMs).toLocaleTimeString()}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0 justify-center">
            <Button
              size="sm"
              className="bg-success hover:bg-success/90 text-success-foreground h-9 px-4 font-bold shadow-sm"
              onClick={() => handleResolve("allow")}
              disabled={isResolving}
            >
              <Check className="h-4 w-4 mr-1" />
              Allow
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-4 border-error/20 hover:bg-error/10 hover:text-error font-semibold"
              onClick={() => handleResolve("deny")}
              disabled={isResolving}
            >
              <X className="h-4 w-4 mr-1" />
              Deny
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
