"use client";

import {
  Brain,
  Moon,
  Sun,
  Clock,
  Database,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
  FileText,
  Settings,
} from "lucide-react";
import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useMemoryStatus } from "@/features/agents/hooks/useMemoryStatus";
import { cn } from "@/lib/utils";

interface MemoryPanelProps {
  className?: string;
}

export function MemoryPanel({ className }: MemoryPanelProps): React.JSX.Element {
  const { status, diary, isDreaming, isLoading, error, refresh, toggleDreaming, updateConfig } =
    useMemoryStatus();
  const [expandedEntries, setExpandedEntries] = useState<Record<number, boolean>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const diaryEntries = useMemo(() => {
    if (!diary?.content) return [];
    // Basic parser: split by markdown headers
    return diary.content
      .split(/(?=### )/)
      .filter(Boolean)
      .map((e: string) => e.trim())
      .reverse(); // Newest first
  }, [diary]);

  const totalPages = Math.ceil(diaryEntries.length / pageSize);
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return diaryEntries.slice(start, start + pageSize);
  }, [diaryEntries, currentPage, pageSize]);

  const toggleEntry = (index: number) => {
    const actualIndex = (currentPage - 1) * pageSize + index;
    setExpandedEntries((prev) => ({ ...prev, [actualIndex]: !prev[actualIndex] }));
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  if (isLoading && !status) {
    return (
      <Card className={cn("border-border/50 bg-card/50", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center">
              <Brain className="mr-2 h-4 w-4" />
              Cognitive Memory
            </CardTitle>
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-20 w-full animate-pulse rounded-lg bg-muted/50" />
          <div className="h-40 w-full animate-pulse rounded-lg bg-muted/50" />
        </CardContent>
      </Card>
    );
  }

  const dreaming = status?.dreaming;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Dreaming Control Card */}
      <Card className="border-border/50 bg-card/50 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "h-8 w-8 transition-colors",
              showSettings && "text-primary bg-primary/10",
            )}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            disabled={isLoading}
            className="h-8 w-8"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
        <CardHeader>
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center">
            {isDreaming ? (
              <Moon className="mr-2 h-4 w-4 text-primary" />
            ) : (
              <Sun className="mr-2 h-4 w-4 text-amber-500" />
            )}
            Dreaming State
          </CardTitle>
          <CardDescription>
            Autonomous long-term memory consolidation and reflection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showSettings ? (
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-bold">Verbose Logging</div>
                  <p className="text-[10px] text-muted-foreground">
                    Detailed debug logs during dreaming phases.
                  </p>
                </div>
                <Switch
                  checked={dreaming?.verboseLogging}
                  onCheckedChange={(checked) => updateConfig({ verboseLogging: checked })}
                  disabled={isLoading}
                />
              </div>
              <Separator className="bg-border/10" />
              <div className="flex items-center justify-between opacity-50 cursor-not-allowed">
                <div className="space-y-0.5">
                  <div className="text-sm font-bold">Dreaming Frequency</div>
                  <p className="text-[10px] text-muted-foreground">
                    How often the agent should dream. (Coming Soon)
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {dreaming?.frequency || "daily"}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-[10px] uppercase font-bold mt-2"
                onClick={() => setShowSettings(false)}
              >
                Back to Status
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/40">
                <div className="space-y-1">
                  <div className="text-sm font-bold">Dreaming Engine</div>
                  <p className="text-xs text-muted-foreground">
                    Consolidates short-term signals into long-term knowledge while the agent is
                    idle.
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge
                    variant={isDreaming ? "default" : "outline"}
                    className={cn(
                      "text-[10px] uppercase font-bold px-2 py-0.5",
                      isDreaming && "bg-primary text-primary-foreground",
                    )}
                  >
                    {isDreaming ? "Active" : "Paused"}
                  </Badge>
                  <Switch
                    checked={isDreaming}
                    onCheckedChange={toggleDreaming}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {error && (
                <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs border border-destructive/20">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {dreaming && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Short-Term
                    </span>
                    <div className="text-xl font-black tabular-nums">
                      {dreaming.shortTermCount || 0}
                    </div>
                    <div className="text-[9px] text-muted-foreground italic">Pending signals</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Consolidated
                    </span>
                    <div className="text-xl font-black tabular-nums">
                      {dreaming.totalSignalCount || 0}
                    </div>
                    <div className="text-[9px] text-muted-foreground italic">Long-term vectors</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Last Dream
                    </span>
                    <div className="text-sm font-bold flex items-center">
                      <Clock className="mr-1 h-3 w-3" />
                      {dreaming.lastDreamAtMs
                        ? new Date(dreaming.lastDreamAtMs).toLocaleTimeString()
                        : "Never"}
                    </div>
                    <div className="text-[9px] text-muted-foreground italic">
                      {dreaming.lastDreamAtMs
                        ? new Date(dreaming.lastDreamAtMs).toLocaleDateString()
                        : "-"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Provider
                    </span>
                    <div className="text-sm font-bold flex items-center">
                      <Database className="mr-1 h-3 w-3" />
                      {status?.provider || "Local Vector"}
                    </div>
                    <div className="text-[9px] text-muted-foreground italic">
                      Memory tier: Premium
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {dreaming?.phases && (
            <div className="mt-6 space-y-4">
              <Separator className="bg-border/10" />
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Dreaming Phases
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Light Sleep */}
                <div className="p-3 rounded-xl bg-muted/10 border border-border/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center">
                      <Sun className="mr-1 h-3 w-3 text-amber-500" />
                      Light
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-border/50">
                      {dreaming.phases.light.enabled ? "Active" : "Off"}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] text-muted-foreground flex justify-between">
                      <span>Lookback</span>
                      <span className="font-bold">{dreaming.phases.light.lookbackDays}d</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex justify-between">
                      <span>Limit</span>
                      <span className="font-bold">{dreaming.phases.light.limit}</span>
                    </div>
                  </div>
                </div>
                {/* REM Sleep */}
                <div className="p-3 rounded-xl bg-muted/10 border border-border/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center">
                      <Moon className="mr-1 h-3 w-3 text-primary" />
                      REM
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-border/50">
                      {dreaming.phases.rem.enabled ? "Active" : "Off"}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] text-muted-foreground flex justify-between">
                      <span>Pattern Strength</span>
                      <span className="font-bold">{dreaming.phases.rem.minPatternStrength}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex justify-between">
                      <span>Lookback</span>
                      <span className="font-bold">{dreaming.phases.rem.lookbackDays}d</span>
                    </div>
                  </div>
                </div>
                {/* Deep Sleep */}
                <div className="p-3 rounded-xl bg-muted/10 border border-border/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center">
                      <Brain className="mr-1 h-3 w-3 text-purple-500" />
                      Deep
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-border/50">
                      {dreaming.phases.deep.enabled ? "Active" : "Off"}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] text-muted-foreground flex justify-between">
                      <span>Min Score</span>
                      <span className="font-bold">{dreaming.phases.deep.minScore}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex justify-between">
                      <span>Recall Count</span>
                      <span className="font-bold">{dreaming.phases.deep.minRecallCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dream Diary Section */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3 border-b border-border/10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center">
              <FileText className="mr-2 h-4 w-4" />
              Dream Diary
            </CardTitle>
            {diary?.updatedAtMs && (
              <span className="text-[10px] text-muted-foreground font-mono italic">
                Updated {new Date(diary.updatedAtMs).toLocaleString()}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            {paginatedEntries.length > 0 ? (
              <div className="divide-y divide-border/30">
                {paginatedEntries.map((entry: string, idx: number) => {
                  const isExpanded = expandedEntries[(currentPage - 1) * pageSize + idx];
                  const title = entry.split("\n")[0]?.replace("### ", "") || "Reflection Entry";
                  const body = entry.split("\n").slice(1).join("\n").trim();

                  return (
                    <div key={idx} className="p-4 hover:bg-muted/10 transition-colors">
                      <button
                        onClick={() => toggleEntry(idx)}
                        className="flex items-start justify-between w-full text-left group"
                      >
                        <div className="space-y-1">
                          <div className="text-sm font-bold group-hover:text-primary transition-colors">
                            {title}
                          </div>
                          {!isExpanded && (
                            <p className="text-xs text-muted-foreground line-clamp-1 italic">
                              {body}
                            </p>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="mt-3 text-xs text-foreground leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200 whitespace-pre-wrap font-serif bg-muted/20 p-4 rounded-xl border border-border/50">
                          {body}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                <Moon className="h-10 w-10 mb-4" />
                <p className="text-sm font-medium">No diary entries yet.</p>
                <p className="text-xs mt-1">
                  The agent will record its reflections after each dream cycle.
                </p>
              </div>
            )}
          </ScrollArea>
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border/10 bg-muted/5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] uppercase font-bold"
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] uppercase font-bold"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
