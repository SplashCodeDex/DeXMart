"use client";

import type { NodeListNode } from "@openclaw/protocol";
import { Monitor, RefreshCw, Cpu, Smartphone } from "lucide-react";
import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DevicePairingTable } from "@/features/devices/components/DevicePairingTable";
import { NodeDetailSheet } from "@/features/nodes/components/NodeDetailSheet";
import { NodePendingPanel } from "@/features/nodes/components/NodePendingPanel";
import { useNodesList } from "@/features/nodes/hooks/useNodesList";
import { cn } from "@/lib/utils";

export default function NodesPage(): React.JSX.Element {
  const { nodes, isLoading, refresh } = useNodesList();
  const [selectedNode, setSelectedNode] = useState<NodeListNode | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const handleNodeClick = (node: NodeListNode) => {
    setSelectedNode(node);
    setIsDetailOpen(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Infrastructure Nodes
          </h2>
          <p className="text-muted-foreground">
            Manage paired mobile devices, edge nodes, and execution capabilities.
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={(e) => {
              refresh();
            }}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <NodePendingPanel />

      <Tabs defaultValue="compute" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="compute" className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Compute
          </TabsTrigger>
          <TabsTrigger value="devices" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Devices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compute" className="mt-6">
          <div className="grid gap-6">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-xl overflow-hidden relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="relative z-10">
                <CardTitle className="flex items-center text-lg font-bold">
                  <Cpu className="mr-2 h-5 w-5 text-primary" />
                  Compute Swarm
                </CardTitle>
                <CardDescription>Remote execution units contributing to the swarm.</CardDescription>
              </CardHeader>
              <CardContent className="relative z-10">
                {nodes.length === 0 && !isLoading ? (
                  <div className="py-20 text-center text-muted-foreground italic text-sm border border-dashed rounded-2xl bg-muted/20">
                    No active compute units detected.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {nodes.map((node) => (
                      <div
                        key={node.nodeId}
                        onClick={() => handleNodeClick(node)}
                        className="group/node relative rounded-xl border border-border/50 bg-muted/30 p-4 transition-all hover:bg-muted/50 hover:border-primary/30 cursor-pointer active:scale-[0.98]"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div
                              className={cn(
                                "rounded-lg p-2.5 transition-all duration-300",
                                node.connected
                                  ? "bg-success/10 text-success shadow-[0_0_15px_rgba(var(--color-success),0.2)]"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              <Monitor className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold tracking-tight truncate">
                                {node.displayName || "Anonymous Node"}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter truncate">
                                {node.platform} · v{node.version || "?.?"}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={node.connected ? "success" : "secondary"}
                            className={cn(
                              "text-[8px] uppercase tracking-widest px-1.5 h-4 rounded-full",
                            )}
                          >
                            {node.connected ? "ONLINE" : "OFFLINE"}
                          </Badge>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-1.5 h-4 overflow-hidden">
                          {node.caps?.slice(0, 3).map((cap: string) => (
                            <Badge
                              key={cap}
                              variant="outline"
                              className="text-[9px] py-0 h-4 border-primary/10 text-primary/60 bg-primary/5"
                            >
                              {cap}
                            </Badge>
                          ))}
                          {(node.caps?.length ?? 0) > 3 && (
                            <span className="text-[9px] text-muted-foreground">
                              +{node.caps!.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="devices" className="mt-6">
          <DevicePairingTable />
        </TabsContent>
      </Tabs>

      <NodeDetailSheet
        node={selectedNode}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onUpdate={refresh}
      />
    </div>
  );
}
