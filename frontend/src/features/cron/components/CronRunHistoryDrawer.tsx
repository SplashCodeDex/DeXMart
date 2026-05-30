"use client";

import { History } from "lucide-react";
import { CheckCircle2, AlertCircle, Timer, RefreshCw } from "lucide-react";
import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCronRuns } from "../hooks/useCronRuns";

interface CronRunHistoryDrawerProps {
  jobId: string;
  jobName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CronRunHistoryDrawer({
  jobId,
  jobName,
  open,
  onOpenChange,
}: CronRunHistoryDrawerProps) {
  const { runs, isLoading } = useCronRuns(jobId, { enabled: open });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Run History: {jobName}</SheetTitle>
          <SheetDescription>Detailed logs of previous executions.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pt-4">
          {isLoading && runs.length === 0 ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <History className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">No run history found for this job.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {runs.map((run, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div className="flex items-center space-x-3">
                    {run.status === "ok" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : run.status === "error" ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Timer className="h-4 w-4 text-orange-500" />
                    )}
                    <div>
                      <p className="font-medium">{new Date(run.ts).toLocaleString()}</p>
                      {run.error ? (
                        <p className="text-xs text-destructive line-clamp-1">{run.error}</p>
                      ) : null}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {run.durationMs ? `${run.durationMs}ms` : "N/A"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
