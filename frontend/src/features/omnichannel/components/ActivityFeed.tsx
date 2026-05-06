"use client";

import {
  Activity,
  MessageSquare,
  Send,
  Settings,
  Brain,
  Zap,
  Terminal,
  CheckCircle2,
  GitBranch,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useOmnichannelStore } from "@/stores/useOmnichannelStore";

const TYPE_ICON_MAP = {
  inbound: MessageSquare,
  outbound: Send,
  skill: Zap,
  agent_thinking: Brain,
  tool_start: Terminal,
  tool_end: CheckCircle2,
  system: Settings,
};

export function ActivityFeed(): React.JSX.Element {
  const { activity } = useOmnichannelStore();
  const [filter, setFilter] = useState("all");
  const router = useRouter();

  const filteredActivity =
    filter === "all"
      ? activity
      : activity.filter((event) => event.channel.toLowerCase() === filter);

  return (
    <div className="rounded-xl border border-border/50 bg-card p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold">Channel Activity</h3>
          <p className="text-sm text-muted-foreground">
            Combined real-time stream from all connected platforms.
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <Tabs value={filter} onValueChange={setFilter} className="w-auto">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="all" className="text-xs px-2 py-1">
                All
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="text-xs px-2 py-1">
                WA
              </TabsTrigger>
              <TabsTrigger value="telegram" className="text-xs px-2 py-1">
                TG
              </TabsTrigger>
              <TabsTrigger value="discord" className="text-xs px-2 py-1">
                DC
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Badge variant="outline" className="font-mono shrink-0">
            <Activity className="mr-1 h-3 w-3 text-green-500 animate-pulse" />
            LIVE
          </Badge>
        </div>
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar min-h-[200px]">
        {filteredActivity.length === 0 ? (
          <div className="flex h-[200px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
            <Activity className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-sm text-muted-foreground">
              {filter === "all"
                ? "Activity logs will appear here as messages flow through the gateway."
                : `No recent activity for ${filter}.`}
            </p>
          </div>
        ) : (
          filteredActivity.map((event) => {
            const TypeIcon =
              (TYPE_ICON_MAP as Record<string, React.ComponentType<{ className?: string }>>)[
                event.type
              ] || Activity;

            return (
              <div
                key={event.id}
                className="flex items-start space-x-3 rounded-lg border border-border/50 bg-muted/20 p-3 text-sm transition-all hover:bg-muted/30"
              >
                <div
                  className={cn(
                    "mt-0.5 rounded-full p-1.5",
                    event.type === "inbound"
                      ? "bg-blue-500/10 text-blue-500"
                      : event.type === "outbound"
                        ? "bg-green-500/10 text-green-500"
                        : event.type === "skill" || event.type === "tool_start"
                          ? "bg-purple-500/10 text-purple-500"
                          : event.type === "agent_thinking"
                            ? "bg-blue-600/10 text-blue-600 animate-pulse"
                            : event.type === "tool_end"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-orange-500/10 text-orange-500",
                  )}
                >
                  <TypeIcon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-medium capitalize text-foreground">{event.channel}</p>
                      <Badge
                        variant="outline"
                        className="text-[8px] h-3.5 px-1 uppercase opacity-70"
                      >
                        {event.type.replace("_", " ")}
                      </Badge>
                    </div>
                    <time className="text-[10px] text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </time>
                  </div>
                  <p
                    className={cn(
                      "text-muted-foreground line-clamp-2",
                      event.type === "agent_thinking" && "italic",
                    )}
                  >
                    {event.message}
                  </p>

                  {/* MASTERMIND: View Trace Button (Phase 4) */}
                  {event.type === "agent_thinking" && (
                    <div className="pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 text-[10px] px-2 text-primary hover:text-primary/80"
                        onClick={() => router.push("/omnichannel/reasoning")}
                      >
                        <GitBranch className="h-3 w-3 mr-1" />
                        View Trace
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
