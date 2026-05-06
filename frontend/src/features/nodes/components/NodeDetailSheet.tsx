"use client";

import type { NodeListNode } from "@openclaw/protocol";
import { Check, Edit2, Loader2, Play, RefreshCw, Terminal, X, Zap } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNodeDetail } from "../hooks/useNodeDetail";
import { useNodePending } from "../hooks/useNodePending";

interface NodeDetailSheetProps {
  node: NodeListNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export function NodeDetailSheet({ node, open, onOpenChange, onUpdate }: NodeDetailSheetProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isWaking, setIsWaking] = useState(false);
  const [activeTab, setActiveTab] = useState("info");

  const { rename, invoke } = useNodeDetail(node?.nodeId ?? "");
  const { enqueue } = useNodePending(node?.nodeId ?? "");

  useEffect(() => {
    if (node) {
      setNewName(node.displayName || node.nodeId);
    }
  }, [node]);

  if (!node) return null;

  const handleRename = async () => {
    if (!newName.trim() || newName === (node.displayName || node.nodeId)) {
      setIsRenaming(false);
      return;
    }

    setIsSaving(true);
    try {
      await rename(newName.trim());
      toast.success("Node renamed successfully");
      setIsRenaming(false);
      onUpdate?.();
    } catch (err) {
      toast.error("Failed to rename node");
    } finally {
      setIsSaving(false);
    }
  };

  const handleWake = async () => {
    setIsWaking(true);
    try {
      await enqueue({ type: "status.request", wake: true });
      toast.success("Wake signal enqueued");
      onUpdate?.();
    } catch (err) {
      toast.error("Failed to enqueue wake signal");
    } finally {
      setIsWaking(false);
    }
  };

  const handleInvoke = async (command: string) => {
    const toastId = toast.loading(`Invoking ${command}...`);
    try {
      const res = await invoke(command, {});
      if (res.ok) {
        toast.success(`Command ${command} executed`, { id: toastId });
      } else {
        toast.error(`Command failed: ${res.error?.message || "Unknown error"}`, { id: toastId });
      }
    } catch (err) {
      toast.error(`Invocation error: ${err instanceof Error ? err.message : String(err)}`, {
        id: toastId,
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg border-l border-border/50 bg-card/95 backdrop-blur-xl flex flex-col p-0">
        <div className="p-6 pb-0">
          <SheetHeader className="pr-6">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={node.connected ? "success" : "secondary"} className="rounded-full">
                {node.connected ? "Online" : "Offline"}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">{node.nodeId}</span>
            </div>
            <div className="flex items-center justify-between group h-9">
              {isRenaming ? (
                <div className="flex items-center gap-2 flex-1 mr-4">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-8 bg-background/50"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleRename()}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={handleRename}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setIsRenaming(false)}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <SheetTitle className="text-2xl font-bold truncate">
                    {node.displayName || "Unnamed Node"}
                  </SheetTitle>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setIsRenaming(true)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            <SheetDescription className="flex items-center gap-2">
              {node.platform} • {node.version || "Unknown version"}
            </SheetDescription>
          </SheetHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="mt-6 flex-1 flex flex-col"
          >
            <TabsList className="grid grid-cols-2 bg-muted/50 p-1">
              <TabsTrigger value="info">Information</TabsTrigger>
              <TabsTrigger value="commands">Commands</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} className="h-full">
            <TabsContent value="info" className="h-full m-0 p-6 pt-4">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-6">
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Device Identity
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Family</Label>
                        <div className="text-sm font-medium">{node.deviceFamily || "-"}</div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Model</Label>
                        <div className="text-sm font-medium">{node.modelIdentifier || "-"}</div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Remote IP</Label>
                        <div className="text-sm font-medium font-mono">
                          {node.remoteIp || "Unknown"}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Last Seen</Label>
                        <div className="text-sm font-medium">
                          {node.connectedAtMs
                            ? new Date(node.connectedAtMs).toLocaleString()
                            : "Never"}
                        </div>
                      </div>
                    </div>
                  </section>

                  <Separator className="bg-border/50" />

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Capabilities
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {node.caps?.length ? (
                        node.caps.map((cap) => (
                          <Badge
                            key={cap}
                            variant="outline"
                            className="bg-primary/5 border-primary/20 text-primary"
                          >
                            {cap}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground italic">
                          No reported capabilities
                        </span>
                      )}
                    </div>
                  </section>

                  <Separator className="bg-border/50" />

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-primary/20 hover:bg-primary/5 group"
                        onClick={handleWake}
                        disabled={isWaking || node.connected}
                      >
                        {isWaking ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Zap className="mr-2 h-4 w-4 text-yellow-500 group-hover:scale-110 transition-transform" />
                        )}
                        Wake Node
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => onUpdate?.()}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                    </div>
                  </section>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="commands" className="h-full m-0 p-6 pt-4">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-3">
                  {node.commands?.length ? (
                    node.commands.map((cmd) => (
                      <div
                        key={cmd}
                        className="group flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50 hover:bg-muted/50 transition-all hover:border-border"
                      >
                        <div className="flex items-center gap-3">
                          <Terminal className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          <span className="text-sm font-mono">{cmd}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleInvoke(cmd)}
                          disabled={!node.connected}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Run
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                        <Terminal className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        No commands available for this node
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
