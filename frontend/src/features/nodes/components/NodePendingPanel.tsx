"use client";

import type { PendingRequest } from "@openclaw/protocol";
import { Check, ShieldAlert, Smartphone, User, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNodePairing } from "../hooks/useNodePairing";

export function NodePendingPanel() {
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { list, approve, reject } = useNodePairing();

  const fetchPending = async () => {
    try {
      const res = await list();
      setPending(res.pending || []);
    } catch (err) {
      console.error("Failed to fetch pending pairings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
    // In a real app, we might subscribe to node.pair.requested event
  }, []);

  const handleApprove = async (requestId: string) => {
    try {
      await approve(requestId);
      toast.success("Node approved");
      fetchPending();
    } catch (err) {
      toast.error("Failed to approve node");
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await reject(requestId);
      toast.success("Node pairing rejected");
      fetchPending();
    } catch (err) {
      toast.error("Failed to reject node");
    }
  };

  if (isLoading) return null;
  if (pending.length === 0) return null;

  return (
    <Card className="border-warning/20 bg-warning/5 shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-warning" />
            <CardTitle className="text-lg font-bold">Pending Approvals</CardTitle>
          </div>
          <Badge variant="warning" className="rounded-full px-2">
            {pending.length} Action{pending.length > 1 ? "s" : ""} Required
          </Badge>
        </div>
        <CardDescription>
          New nodes are requesting access to your infrastructure. Review carefully before approving.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pending.map((req) => (
          <div
            key={req.requestId}
            className="flex items-center justify-between p-4 rounded-xl border border-warning/10 bg-background/50 backdrop-blur-sm group hover:border-warning/30 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center text-warning shrink-0">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold flex items-center gap-2 truncate">
                  {req.displayName || "Anonymous Node"}
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded uppercase shrink-0">
                    {req.platform}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  ID: {req.nodeId}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] h-4 py-0 border-muted">
                    v{req.version || "?.?"}
                  </Badge>
                  {req.remoteIp && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {req.remoteIp}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0 hover:bg-error/10 hover:text-error"
                onClick={() => handleReject(req.requestId)}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                className="bg-warning hover:bg-warning/90 text-warning-foreground font-bold"
                onClick={() => handleApprove(req.requestId)}
              >
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
