"use client";

import {
  Clock,
  Plus,
  RefreshCw,
  Trash2,
  Play,
  Power,
  History,
  AlertCircle,
  CheckCircle2,
  Timer,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateCronJobDialog } from "@/features/cron/components/CreateCronJobDialog";
import { CronRunHistoryDrawer } from "@/features/cron/components/CronRunHistoryDrawer";
import { useCronRuns } from "@/features/cron/hooks/useCronRuns";
import { cn } from "@/lib/utils";
import { useOmnichannelStore } from "@/stores/useOmnichannelStore";
import type { CronSchedule } from "@/types";

function formatSchedule(schedule: CronSchedule): string {
  if (schedule.kind === "every") return `Every ${schedule.everyMs / 1000}s`;
  if (schedule.kind === "at") return `At ${new Date(schedule.at).toLocaleString()}`;
  if (schedule.kind === "cron") return `Cron: ${schedule.expr}`;
  return "Unknown";
}

export default function CronJobsPage(): React.JSX.Element {
  const {
    cronJobs,
    cronStatus,
    fetchCronJobs,
    fetchCronStatus,
    toggleCronJob,
    runCronJob,
    removeCronJob,
  } = useOmnichannelStore();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedHistoryJob, setSelectedHistoryJob] = useState<{ id: string; name: string } | null>(
    null,
  );

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    await Promise.all([fetchCronJobs(), fetchCronStatus()]);
    setIsRefreshing(false);
  };

  useEffect(() => {
    void Promise.all([fetchCronJobs(), fetchCronStatus()]);
  }, [fetchCronJobs, fetchCronStatus]);

  const handleToggle = async (id: string, currentStatus: boolean): Promise<void> => {
    const success = await toggleCronJob(id, !currentStatus);
    if (success) {
      toast.success(`Job ${!currentStatus ? "enabled" : "disabled"} successfully`);
    }
  };

  const handleRunNow = async (id: string): Promise<void> => {
    const success = await runCronJob(id);
    if (success) {
      toast.success("Job execution triggered");
    } else {
      toast.error("Failed to trigger job");
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (confirm("Are you sure you want to delete this job?")) {
      const success = await removeCronJob(id);
      if (success) {
        toast.success("Job deleted");
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground font-foreground">
            Automation Scheduler
          </h2>
          <p className="text-muted-foreground">
            Manage recurring agent tasks, system wakeups, and scheduled messages.
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Job
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Scheduler Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">
                {cronStatus?.enabled ? "Active" : "Disabled"}
              </span>
              <Badge variant={cronStatus?.enabled ? "default" : "secondary"}>
                {cronStatus?.enabled ? "ONLINE" : "OFFLINE"}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{cronJobs.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Next Wakeup</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Clock className="mr-2 h-4 w-4 text-primary" />
              <span className="text-lg font-semibold italic">
                {cronStatus?.nextWakeAtMs
                  ? new Date(cronStatus.nextWakeAtMs).toLocaleTimeString()
                  : "No pending jobs"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle>Scheduled Jobs</CardTitle>
          <CardDescription>
            All active and inactive cron jobs for your workspace agents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cronJobs.length === 0 ? (
            <div className="flex h-[200px] flex-col items-center justify-center text-center">
              <Clock className="h-10 w-10 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground">No cron jobs configured yet.</p>
              <Button variant="link" onClick={() => setIsCreateDialogOpen(true)}>
                Create your first job
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Name</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Payload</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cronJobs.map((job) => (
                  <TableRow key={job.id} className="group">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{job.name}</span>
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {job.description}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {formatSchedule(job.schedule)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-xs">
                        <span className="capitalize text-primary mr-2 font-semibold">
                          {job.payload.kind === "systemEvent" ? "System" : "Agent"}
                        </span>
                        <span className="text-muted-foreground truncate max-w-[100px]">
                          {job.payload.kind === "systemEvent"
                            ? job.payload.text
                            : job.payload.message}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={job.enabled ? "default" : "secondary"}>
                        {job.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground italic">
                        {job.state?.lastRunAtMs
                          ? new Date(job.state.lastRunAtMs).toLocaleString()
                          : "Never"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRunNow(job.id)}
                          title="Run Now"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-8 w-8",
                            job.enabled ? "text-orange-500" : "text-green-500",
                          )}
                          onClick={() => handleToggle(job.id, job.enabled)}
                          title={job.enabled ? "Disable" : "Enable"}
                        >
                          <Power className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setSelectedHistoryJob({ id: job.id, name: job.name })}
                          title="View History"
                        >
                          <History className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDelete(job.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateCronJobDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />

      <CronRunHistoryDrawer
        jobId={selectedHistoryJob?.id || ""}
        jobName={selectedHistoryJob?.name || ""}
        open={!!selectedHistoryJob}
        onOpenChange={(open) => !open && setSelectedHistoryJob(null)}
      />
    </div>
  );
}
