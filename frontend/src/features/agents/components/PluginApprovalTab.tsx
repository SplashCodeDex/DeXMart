"use client";

import { ShieldCheck, XCircle, CheckCircle2, Clock, Info } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSkillsStatus } from "../hooks/useSkillsStatus";

export function PluginApprovalTab(): React.JSX.Element {
  const { pluginApprovals, resolvePluginApproval, isLoading } = useSkillsStatus();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleResolve = async (id: string, decision: "allow-once" | "allow-always" | "deny") => {
    setResolvingId(id);
    try {
      const success = await resolvePluginApproval(id, decision);
      if (success) {
        toast.success(`Request ${decision === "deny" ? "denied" : "approved"} successfully`);
      } else {
        toast.error("Failed to resolve approval request");
      }
    } finally {
      setResolvingId(null);
    }
  };

  if (pluginApprovals.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl bg-muted/20">
        <ShieldCheck className="h-12 w-12 text-muted-foreground/20 mb-4" />
        <h3 className="text-lg font-medium">No Pending Approvals</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Your agents haven't requested any restricted plugin operations recently.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {pluginApprovals.map((approval) => (
        <Card key={approval.id} className="border-border/50 bg-card overflow-hidden flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center">
                  {approval.request.title}
                  {approval.request.severity === "high" && (
                    <Badge variant="destructive" className="ml-2 text-[10px] h-4 px-1">
                      High Risk
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs font-mono">
                  ID: {approval.id.split(":").pop()?.substring(0, 8)}...
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="bg-orange-500/10 text-orange-500 border-orange-500/20"
              >
                Pending
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pb-4 flex-1">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground italic border-l-2 border-primary/20 pl-3">
                "{approval.request.description}"
              </p>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="flex items-center text-muted-foreground">
                  <Clock className="mr-1 h-3 w-3" />
                  Requested: {new Date(approval.createdAtMs).toLocaleTimeString()}
                </div>
                {approval.request.pluginId && (
                  <div className="flex items-center text-muted-foreground">
                    <Info className="mr-1 h-3 w-3" />
                    Plugin: {approval.request.pluginId}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 border-t pt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
              disabled={resolvingId === approval.id}
              onClick={() => handleResolve(approval.id, "deny")}
            >
              <XCircle className="mr-2 h-3.5 w-3.5" />
              Deny
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={resolvingId === approval.id}
              onClick={() => handleResolve(approval.id, "allow-once")}
            >
              <Clock className="mr-2 h-3.5 w-3.5" />
              Once
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              disabled={resolvingId === approval.id}
              onClick={() => handleResolve(approval.id, "allow-always")}
            >
              <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
              Always
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
