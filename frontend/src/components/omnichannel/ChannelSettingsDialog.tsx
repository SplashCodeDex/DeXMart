"use client";

import {
  Settings2,
  Power,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  UserCircle2,
} from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { LiquidGlassWrapper } from "@/components/effects/LiquidGlassWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { QRLoginModal } from "@/features/omnichannel/components/QRLoginModal";
import { useChannelStatus } from "@/features/omnichannel/hooks/useChannelStatus";
import { api } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { useOmnichannelStore } from "@/stores/useOmnichannelStore";
import type { Channel } from "@/types/omnichannel";

interface ChannelSettingsDialogProps {
  channel: Channel;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChannelSettingsDialog({
  channel,
  isOpen,
  onOpenChange,
}: ChannelSettingsDialogProps): React.JSX.Element {
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [shouldArchive, setShouldArchive] = useState(true);
  const { disconnectChannel, deleteChannel, moveChannel, agentsResult, fetchAgents } =
    useOmnichannelStore();
  const { logout: rpcLogout, refresh: refreshStatus } = useChannelStatus({ enabled: false });

  const agentId = channel.assignedAgentId || "system_default";
  const [selectedTargetAgent, setSelectedTargetAgent] = useState(agentId);

  useEffect(() => {
    if (isOpen) fetchAgents();
  }, [isOpen, fetchAgents]);

  useEffect(() => {
    setSelectedTargetAgent(agentId);
  }, [agentId, isOpen]);

  const agents = agentsResult?.agents || [];

  const handleDisconnect = async (): Promise<void> => {
    setIsActionLoading(true);
    try {
      // Prefer RPC logout if we have an account ID
      if (channel.account) {
        await rpcLogout(channel.type, channel.account);
        toast.success(`Successfully logged out ${channel.name}`);
      } else {
        const success = await disconnectChannel(agentId, channel.id);
        if (success) {
          toast.success(`Successfully disconnected ${channel.name}`);
        } else {
          toast.error("Failed to disconnect channel");
        }
      }
      onOpenChange(false);
    } catch (err) {
      console.error("Logout failed:", err);
      toast.error("Failed to disconnect channel");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    setIsActionLoading(true);
    try {
      const success = await deleteChannel(agentId, channel.id, shouldArchive);
      if (success) {
        toast.success(`Successfully ${shouldArchive ? "archived" : "deleted"} ${channel.name}`);
        onOpenChange(false);
      } else {
        toast.error(`Failed to ${shouldArchive ? "archive" : "delete"} channel`);
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReconnect = async (): Promise<void> => {
    // If it's a channel that likely needs QR login, show the modal
    if (channel.type === "whatsapp" || channel.type === "signal" || channel.type === "telegram") {
      setShowQrModal(true);
      return;
    }

    setIsActionLoading(true);
    try {
      const response = await api.post(
        API_ENDPOINTS.OMNICHANNEL.AGENTS.CHANNELS.CONNECT(agentId, channel.id),
        {},
      );
      if (response.success) {
        toast.success(`Reconnecting ${channel.name}...`);
        onOpenChange(false);
      } else {
        toast.error("Failed to initiate reconnection");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleQrConnected = useCallback(() => {
    setShowQrModal(false);
    toast.success(`${channel.name} connected successfully!`);
    refreshStatus();
    onOpenChange(false);
  }, [channel.name, onOpenChange, refreshStatus]);

  const handleMove = async (): Promise<void> => {
    if (selectedTargetAgent === agentId) return;
    setIsActionLoading(true);
    try {
      const success = await moveChannel(channel.id, agentId, selectedTargetAgent);
      if (success) {
        toast.success(`Channel reassigned successfully`);
        onOpenChange(false);
      } else {
        toast.error("Failed to move channel");
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const effectiveAgents = agents.filter((a) => a.id !== "system_default");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] border-border/50 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <div className="flex items-center space-x-2 mb-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Settings2 className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl">{channel.name}</DialogTitle>
          </div>
          <DialogDescription>
            Manage connection settings and lifecycle for this channel.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Agent Assignment */}
          <div className="space-y-4 p-4 rounded-xl bg-card border border-border/50 shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
            <div className="relative">
              <Label className="text-xs uppercase tracking-wider text-foreground font-bold flex items-center gap-2 mb-3">
                <div className="p-1 rounded bg-primary/10 text-primary">
                  <UserCircle2 className="h-4 w-4" />
                </div>
                Assigned Agent
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={selectedTargetAgent} onValueChange={setSelectedTargetAgent}>
                  <LiquidGlassWrapper className="flex-1 rounded-xl">
                    <SelectTrigger className="bg-background/80 backdrop-blur-md border-border/50 w-full h-10 transition-colors hover:border-primary/30 focus:ring-primary/20 rounded-xl">
                      <SelectValue placeholder="Select Agent" />
                    </SelectTrigger>
                  </LiquidGlassWrapper>
                  <SelectContent className="rounded-xl border-border/50 bg-card/95 backdrop-blur-xl">
                    <SelectItem
                      value="system_default"
                      className="font-medium text-primary focus:bg-primary/10 rounded-lg"
                    >
                      System Default Agent
                    </SelectItem>
                    {effectiveAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id} className="rounded-lg">
                        {agent.name ?? agent.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="default"
                  className="h-10 px-6 font-semibold shadow-sm transition-all sm:w-auto w-full"
                  disabled={isActionLoading || selectedTargetAgent === agentId}
                  onClick={handleMove}
                >
                  {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reassign"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Reassigning this channel routes all future incoming messages to the selected agent's
                logic.
              </p>
            </div>
          </div>

          {/* Status Overview */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Current Status</p>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    channel.status === "connected"
                      ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                      : channel.status === "banned"
                        ? "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                        : channel.status === "reconnect_exhausted"
                          ? "bg-orange-500"
                          : channel.status === "error"
                            ? "bg-destructive"
                            : channel.status === "logged_out"
                              ? "bg-yellow-500"
                              : "bg-muted-foreground",
                  )}
                />
                <span className="font-bold capitalize">
                  {channel.status === "reconnect_exhausted"
                    ? "Retry Failed"
                    : channel.status === "logged_out"
                      ? "Logged Out"
                      : channel.status === "qr_pending"
                        ? "Scan QR"
                        : channel.status}
                </span>
              </div>
            </div>
            <Badge variant="outline" className="bg-background/50">
              {channel.type.toUpperCase()}
            </Badge>
          </div>

          {!showDeleteConfirm ? (
            <div className="space-y-3">
              {/* Reconnect — shown only when the channel has no live session */}
              {(channel.status === "disconnected" ||
                channel.status === "logged_out" ||
                channel.status === "error" ||
                channel.status === "reconnect_exhausted") && (
                <div className="group">
                  <Button
                    variant="outline"
                    className="w-full justify-between h-12 border-primary/20 hover:bg-primary/10 hover:text-primary hover:border-primary/50 group-hover:shadow-md transition-all"
                    onClick={handleReconnect}
                    disabled={isActionLoading}
                  >
                    <div className="flex items-center gap-3">
                      <RotateCcw className="h-4 w-4" />
                      <div className="text-left">
                        <p className="font-bold text-sm">Reconnect</p>
                        <p className="text-[10px] text-muted-foreground">
                          Start a new session and get a fresh QR code
                        </p>
                      </div>
                    </div>
                    {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  </Button>
                </div>
              )}

              <div className="group">
                <Button
                  variant="outline"
                  className="w-full justify-between h-12 border-orange-500/20 hover:bg-orange-500/10 hover:text-orange-600 hover:border-orange-500/50 group-hover:shadow-md transition-all"
                  onClick={handleDisconnect}
                  disabled={
                    isActionLoading ||
                    [
                      "disconnected",
                      "logged_out",
                      "banned",
                      "reconnect_exhausted",
                      "archived",
                    ].includes(channel.status)
                  }
                >
                  <div className="flex items-center gap-3">
                    <Power className="h-4 w-4" />
                    <div className="text-left">
                      <p className="font-bold text-sm">Disconnect Bot</p>
                      <p className="text-[10px] text-muted-foreground">
                        Shut down the live connection
                      </p>
                    </div>
                  </div>
                  {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                </Button>
              </div>

              <div className="group">
                <Button
                  variant="outline"
                  className="w-full justify-between h-12 border-destructive/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 group-hover:shadow-md transition-all"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isActionLoading}
                >
                  <div className="flex items-center gap-3">
                    <Trash2 className="h-4 w-4" />
                    <div className="text-left">
                      <p className="font-bold text-sm text-destructive">Delete / Archive</p>
                      <p className="text-[10px] text-muted-foreground">
                        Remove slot or preserve history
                      </p>
                    </div>
                  </div>
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-destructive/10 text-destructive mt-1">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-destructive">Are you absolutely sure?</p>
                  <p className="text-xs text-muted-foreground">
                    {shouldArchive
                      ? "The channel will be archived. Its history is preserved but it can no longer receive messages."
                      : "This permanently deletes the channel slot, all credentials, and message history. This cannot be undone."}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold">Archive History</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Preserve message logs and metadata
                  </p>
                </div>
                <Switch
                  checked={shouldArchive}
                  onCheckedChange={setShouldArchive}
                  disabled={isActionLoading}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isActionLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1 font-bold"
                  onClick={handleDelete}
                  disabled={isActionLoading}
                >
                  {isActionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Confirm {shouldArchive ? "Archive" : "Delete"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-start">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Changes take effect immediately on the live gateway.
          </p>
        </DialogFooter>
      </DialogContent>

      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-[400px] border-border/50 bg-card/95 backdrop-blur-xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Connect {channel.name}</DialogTitle>
            <DialogDescription>
              Scan the QR code with your mobile app to link the device.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-white/5 p-4">
            <QRLoginModal
              open={showQrModal}
              onClose={() => setShowQrModal(false)}
              onConnected={handleQrConnected}
              accountId={channel.account ?? undefined}
            />
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
