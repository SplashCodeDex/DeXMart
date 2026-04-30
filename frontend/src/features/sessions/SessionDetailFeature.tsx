import {
  ChevronLeft,
  Info,
  MoreVertical,
  RefreshCcw,
  Save,
  Send,
  Settings2,
  Trash2,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { toast } from "sonner";
import { ModelSelector } from "@/components/shared/ModelSelector";
import { VirtualLogList } from "@/components/shared/VirtualLogList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useGateway } from "@/lib/gateway/gateway-hooks";
import { CompactionPanel } from "./components/CompactionPanel";
import { UsageBreakdownCard } from "./components/UsageBreakdownCard";
import { useCompaction } from "./hooks/useCompaction";
import { useSessionDetail } from "./hooks/useSessionDetail";
import { useSessionUsage } from "./hooks/useSessionUsage";

interface SessionDetailFeatureProps {
  sessionId: string;
}

export function SessionDetailFeature({ sessionId }: SessionDetailFeatureProps): React.JSX.Element {
  const router = useRouter();
  const { rpc } = useGateway();
  const {
    session,
    isLoading: isSessionLoading,
    error: sessionError,
    refresh: refreshSession,
  } = useSessionDetail(sessionId);
  const {
    checkpoints,
    isLoading: isCompactionLoading,
    error: compactionError,
    refresh: refreshCompaction,
  } = useCompaction(sessionId);
  const { usage, isLoading: isUsageLoading, refresh: refreshUsage } = useSessionUsage(sessionId);

  const [isPatching, setIsPatching] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [command, setCommand] = useState("");
  const [isSending, setIsSending] = useState(false);

  const isLoading = isSessionLoading || isCompactionLoading || isUsageLoading;
  const error = sessionError || compactionError;

  const handleSend = async (steer = false) => {
    if (!command.trim() || isSending || !rpc) return;

    setIsSending(true);
    try {
      await rpc.call(steer ? ("sessions.steer" as any) : "sessions.send", {
        key: sessionId,
        message: command,
      } as any);
      setCommand("");
      toast.success(steer ? "Steer command sent" : "Message sent");
      refreshSession();
      refreshUsage();
    } catch (err) {
      toast.error("Failed to send command");
    } finally {
      setIsSending(false);
    }
  };

  const handlePatch = async (patch: any) => {
    if (!rpc) return;
    setIsPatching(true);
    try {
      await rpc.call("sessions.patch", { key: sessionId, ...patch });
      toast.success("Session updated");
      refreshSession();
      refreshUsage();
    } catch (err) {
      toast.error("Failed to update session");
    } finally {
      setIsPatching(false);
    }
  };

  const handleAbort = async () => {
    if (!rpc) return;
    try {
      await (rpc as any).call("sessions.abort", { key: sessionId });
      toast.success("Session aborted");
      refreshSession();
    } catch (err) {
      toast.error("Failed to abort session");
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset this session? This will clear the transcript."))
      return;
    if (!rpc) return;
    try {
      await (rpc as any).call("sessions.reset", { key: sessionId });
      toast.success("Session reset");
      refreshSession();
    } catch (err) {
      toast.error("Failed to reset session");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this session?")) return;
    if (!rpc) return;
    try {
      await rpc.call("sessions.delete", { key: sessionId });
      toast.success("Session deleted");
      router.push("/dashboard/sessions");
    } catch (err) {
      toast.error("Failed to delete session");
    }
  };

  const renderMessage = (message: any, index: number) => {
    const isUser = message.role === "user";
    return (
      <div
        key={index}
        className={`p-4 ${isUser ? "bg-muted/30" : "bg-background"} border-b border-border/50`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Badge
            variant={isUser ? "outline" : "default"}
            className="uppercase text-[9px] font-black tracking-tighter px-1.5 py-0"
          >
            {message.role}
          </Badge>
          <span className="text-[10px] text-muted-foreground font-mono">
            {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ""}
          </span>
        </div>
        <div className="text-sm prose prose-invert max-w-none break-words">
          {typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content, null, 2)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/sessions")}
            className="rounded-xl"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="space-y-0.5">
            <h1 className="text-2xl font-black tracking-tighter uppercase truncate max-w-xl">
              {session?.label || session?.displayName || sessionId.slice(0, 12)}
            </h1>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-black tracking-widest">
              <span>{session?.channel || "No Channel"}</span>
              <span>•</span>
              <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="hover:text-primary transition-colors flex items-center gap-1"
              >
                {session?.model || "No Model"}
                <Settings2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {session?.status === "running" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleAbort}
              className="rounded-xl font-bold uppercase tracking-wider text-[10px]"
            >
              <RefreshCcw className="w-3 h-3 mr-2 animate-spin" /> Abort
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refreshSession();
              refreshCompaction();
              refreshUsage();
            }}
            className="rounded-xl font-bold uppercase tracking-wider text-[10px]"
          >
            <RefreshCcw className="w-3 h-3 mr-2" /> Refresh
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 bg-card border-border/50 backdrop-blur-xl"
            >
              <DropdownMenuItem
                onClick={handleReset}
                className="focus:text-primary cursor-pointer font-bold uppercase tracking-wider text-xs"
              >
                <RefreshCcw className="w-4 h-4 mr-2" /> Reset Session
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive cursor-pointer font-bold uppercase tracking-wider text-xs"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {showModelSelector && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest">
              Override Model
            </CardTitle>
            <CardDescription className="text-xs">
              Changes apply to future messages in this session.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <ModelSelector
              value={session?.model}
              onSelect={(model) => {
                handlePatch({ model });
                setShowModelSelector(false);
              }}
            />
          </CardContent>
        </Card>
      )}

      {error ? (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-bold">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <Card className="overflow-hidden border-border/50 rounded-3xl">
            <CardHeader className="bg-muted/30 border-b border-border/50 py-4 px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  Transcript
                  {session?.messages && (
                    <Badge variant="secondary" className="rounded-full text-[9px] px-1.5 py-0">
                      {session.messages.length}
                    </Badge>
                  )}
                </CardTitle>
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                  {isLoading ? "Syncing..." : "Live"}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <VirtualLogList
                items={session?.messages || []}
                renderItem={renderMessage}
                height={600}
                estimateSize={80}
                className="border-0 rounded-none bg-transparent"
              />

              <div className="p-4 bg-muted/20 border-t border-border/50 flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Type a command or message..."
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    className="pr-10 rounded-xl bg-background/50 border-border/50 focus:border-primary/50"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/50">
                    ⏎
                  </div>
                </div>

                <Button
                  size="icon"
                  onClick={() => handleSend(false)}
                  disabled={!command.trim() || isSending}
                  className="rounded-xl"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </Button>

                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => handleSend(true)}
                  disabled={!command.trim() || isSending}
                  className="rounded-xl text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 border-amber-500/20"
                  title="Steer (Interrupt and send)"
                >
                  <Zap className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/50 rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50 py-4 px-6">
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Info className="w-4 h-4" /> Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">
                    Tokens Used
                  </div>
                  <div className="text-2xl font-bold tracking-tighter">
                    {session?.totalTokens?.toLocaleString() || "0"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">
                    Est. Cost
                  </div>
                  <div className="text-2xl font-bold tracking-tighter text-primary">
                    ${session?.estimatedCostUsd?.toFixed(4) || "0.0000"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">
                    Status
                  </div>
                  <Badge
                    variant={session?.status === "running" ? "default" : "secondary"}
                    className="rounded-full text-[9px] px-2 py-0 uppercase font-black tracking-tighter"
                  >
                    {session?.status || "unknown"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <UsageBreakdownCard usage={usage} isLoading={isUsageLoading} />

          <Card className="border-border/50 rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50 py-4 px-6">
              <CardTitle className="text-sm font-black uppercase tracking-widest">
                Checkpoints
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <CompactionPanel sessionId={sessionId} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
