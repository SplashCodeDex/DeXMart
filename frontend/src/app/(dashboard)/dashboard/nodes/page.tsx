"use client";

import { Monitor, RefreshCw, Plus, Cpu, Smartphone } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DevicePairingTable } from "@/features/devices/components/DevicePairingTable";
import { cn } from "@/lib/utils";
import { useOmnichannelStore } from "@/stores/useOmnichannelStore";

export default function NodesPage(): React.JSX.Element {
  const { nodes, fetchNodes, fetchDevices } = useOmnichannelStore();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    await Promise.all([fetchNodes(), fetchDevices()]);
    setIsRefreshing(false);
  };

  useEffect(() => {
    void Promise.all([fetchNodes(), fetchDevices()]);
  }, [fetchNodes, fetchDevices]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground font-foreground">
            Infrastructure Nodes
          </h2>
          <p className="text-muted-foreground">
            Manage paired mobile devices, edge nodes, and execution capabilities.
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="devices" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="compute" className="flex items-center">
            <Cpu className="mr-2 h-4 w-4" />
            Compute
          </TabsTrigger>
          <TabsTrigger value="devices" className="flex items-center">
            <Smartphone className="mr-2 h-4 w-4" />
            Devices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compute" className="mt-6">
          <div className="grid gap-6">
            <Card className="border-border/50 bg-card/50 shadow-xl overflow-hidden relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader className="relative z-10">
                <CardTitle className="flex items-center text-lg font-bold">
                  <Cpu className="mr-2 h-5 w-5 text-primary animate-pulse" />
                  Compute Nodes
                </CardTitle>
                <CardDescription>Remote execution units contributing to the swarm.</CardDescription>
              </CardHeader>
              <CardContent className="relative z-10">
                {nodes.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground italic text-sm border border-dashed rounded-xl">
                    No active compute units detected.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {nodes.map((node) => (
                      <div
                        key={node.nodeId}
                        className="group/node relative rounded-xl border border-white/5 bg-muted/30 p-4 transition-all hover:bg-muted/50 hover:border-primary/20"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div
                              className={cn(
                                "rounded-lg p-2.5 transition-colors",
                                node.connected
                                  ? "bg-green-500/10 text-green-500 shadow-[0_0_10px_rgba(34,197,94,0.2)]"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              <Monitor className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold tracking-tight">
                                {node.name || "Anonymous Node"}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter">
                                {node.platform} · v{node.version}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={node.connected ? "default" : "secondary"}
                            className={cn(
                              "text-[8px] uppercase tracking-widest px-1.5 h-4",
                              node.connected &&
                                "bg-green-500/20 text-green-500 border-green-500/30 hover:bg-green-500/20",
                            )}
                          >
                            {node.connected ? "STABLE" : "OFFLINE"}
                          </Badge>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {node.capabilities.map((cap) => (
                            <Badge
                              key={cap}
                              variant="outline"
                              className="text-[9px] py-0 h-4 border-primary/10 text-primary/60 bg-primary/5"
                            >
                              {cap}
                            </Badge>
                          ))}
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
    </div>
  );
}
