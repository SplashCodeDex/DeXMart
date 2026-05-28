"use client";

import { Save, Shield, Cpu, Globe, RefreshCw, Terminal } from "lucide-react";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApprovalInbox } from "@/features/nodes/components/ApprovalInbox";
import { ExecApprovalsCard } from "@/features/nodes/components/ExecApprovalsCard";
import { api, API_ENDPOINTS } from "@/lib/api";
import { TenantSettings } from "../types";
import { GatewayConfigForm } from "./GatewayConfigForm";

export function ConfigManager(): React.JSX.Element | null {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const response = await api.get<TenantSettings>(API_ENDPOINTS.SETTINGS.GET_TENANT);
        if (response.success) {
          setSettings(response.data);
        }
      } catch {
        toast.error("Failed to load settings");
      } finally {
        setIsLoading(false);
      }
    };
    void fetchSettings();
  }, []);

  const handleSave = async (): Promise<void> => {
    if (!settings) return;

    setIsSaving(true);
    try {
      // Backend expects PATCH for update
      const response = await api.patch(API_ENDPOINTS.SETTINGS.UPDATE_TENANT, settings);
      if (response.success) {
        toast.success("Config Live — Changes synced instantly", {
          description: "No restart required. Your settings are active across all channels.",
          duration: 3000,
        });
      }
    } catch {
      toast.error("Failed to update configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const updateNestedSetting = (path: string, value: unknown): void => {
    if (!settings) return;

    const newSettings = { ...settings };
    const keys = path.split(".");
    let current: Record<string, unknown> = newSettings as unknown as Record<string, unknown>;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (key) {
        // Ensure the nested object exists
        if (!current[key]) current[key] = {};
        current = current[key] as Record<string, unknown>;
      }
    }

    const lastKey = keys[keys.length - 1];
    if (lastKey) current[lastKey] = value;

    setSettings(newSettings);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Platform Configuration</h2>
          <p className="text-muted-foreground text-sm">
            Manage your organization profile, default bot behavior, notifications, and system
            policies.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-xl shadow-lg ring-1 ring-primary/20"
        >
          {isSaving ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isSaving ? "Syncing..." : "Save & Sync"}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="bg-muted/30 p-1 rounded-xl border border-border/50">
          <TabsTrigger
            value="general"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Globe className="h-4 w-4 mr-2" />
            Organization
          </TabsTrigger>
          <TabsTrigger
            value="gateway"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Cpu className="h-4 w-4 mr-2" />
            Gateway
          </TabsTrigger>
          <TabsTrigger
            value="features"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Cpu className="h-4 w-4 mr-2" />
            Feature Gating
          </TabsTrigger>
          <TabsTrigger
            value="defaults"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Terminal className="h-4 w-4 mr-2" />
            Channel Defaults
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Shield className="h-4 w-4 mr-2" />
            System Policy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Identity
              </CardTitle>
              <CardDescription>Official tenant profile details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="organization">Organization Name</Label>
                <Input
                  id="organization"
                  value={settings.organization || ""}
                  onChange={(e) => setSettings({ ...settings, organization: e.target.value })}
                  className="bg-background/50"
                  placeholder="Acme Corp"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="owner">Owner Name</Label>
                  <Input
                    id="owner"
                    value={settings.ownerName || ""}
                    onChange={(e) => setSettings({ ...settings, ownerName: e.target.value })}
                    className="bg-background/50"
                    placeholder="John Doe"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="number">Primary Number</Label>
                  <Input
                    id="number"
                    value={settings.ownerNumber || ""}
                    onChange={(e) => setSettings({ ...settings, ownerNumber: e.target.value })}
                    className="bg-muted font-mono"
                    disabled
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Notifications
              </CardTitle>
              <CardDescription>Outbound alert destinations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="webhook">Global Webhook URL</Label>
                <Input
                  id="webhook"
                  type="url"
                  value={settings.notifications.webhookUrl || ""}
                  onChange={(e) => updateNestedSetting("notifications.webhookUrl", e.target.value)}
                  className="bg-background/50"
                  placeholder="https://hooks.yourdomain.com/dexmart"
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background/30">
                <div className="space-y-0.5">
                  <Label>Email Alerts</Label>
                  <p className="text-xs text-muted-foreground">
                    Receive critical system updates via email.
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.email}
                  onCheckedChange={(val) => updateNestedSetting("notifications.email", val)}
                />
              </div>
              <Separator className="bg-border/50" />
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background/30">
                <div className="space-y-0.5">
                  <Label>Disconnect Warnings</Label>
                  <p className="text-xs text-muted-foreground">
                    Notify when a channel or node goes offline.
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.notifyOnChannelDisconnect}
                  onCheckedChange={(val) =>
                    updateNestedSetting("notifications.notifyOnChannelDisconnect", val)
                  }
                />
              </div>
              <Separator className="bg-border/50" />
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background/30">
                <div className="space-y-0.5">
                  <Label>Error Logs</Label>
                  <p className="text-xs text-muted-foreground">
                    Notify on critical processing errors.
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.notifyOnErrors}
                  onCheckedChange={(val) =>
                    updateNestedSetting("notifications.notifyOnErrors", val)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gateway" className="space-y-4">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Engine Configuration
              </CardTitle>
              <CardDescription>
                Core OpenClaw gateway settings. These changes are saved to your configuration file.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GatewayConfigForm />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Premium Capabilities
              </CardTitle>
              <CardDescription>Gated features based on your current tier.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">AI Engine (Gemini)</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable Large Language Model processing for all channels.
                  </p>
                </div>
                <Switch
                  checked={settings.features.aiEnabled}
                  onCheckedChange={(val) => updateNestedSetting("features.aiEnabled", val)}
                />
              </div>
              <Separator className="bg-border/50" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Mass Campaigns</Label>
                  <p className="text-sm text-muted-foreground">
                    Unlock scheduling and bulk message distribution tools.
                  </p>
                </div>
                <Switch
                  checked={settings.features.campaignsEnabled}
                  onCheckedChange={(val) => updateNestedSetting("features.campaignsEnabled", val)}
                />
              </div>
              <Separator className="bg-border/50" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Analytics Engine</Label>
                  <p className="text-sm text-muted-foreground">
                    Real-time cost and performance metrics for the swarm.
                  </p>
                </div>
                <Switch
                  checked={settings.features.analyticsEnabled}
                  onCheckedChange={(val) => updateNestedSetting("features.analyticsEnabled", val)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="defaults" className="space-y-4">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Inherited Behavior
              </CardTitle>
              <CardDescription>Default settings for newly provisioned channels.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Default Operation Mode</Label>
                  <select
                    className="w-full rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-sm"
                    value={settings.channelDefaults.mode}
                    onChange={(e) => updateNestedSetting("channelDefaults.mode", e.target.value)}
                  >
                    <option value="public">Public (Everyone)</option>
                    <option value="private">Private (Owner Only)</option>
                    <option value="group-only">Groups Only</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Command Prefixes</Label>
                  <Input
                    value={settings.channelDefaults.prefix.join(", ")}
                    onChange={(e) =>
                      updateNestedSetting(
                        "channelDefaults.prefix",
                        e.target.value.split(",").map((s) => s.trim()),
                      )
                    }
                    className="bg-background/50"
                    placeholder="., !, /"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background/30">
                <div className="space-y-0.5">
                  <Label>Auto Reconnect</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically restore dropped WebSocket sessions.
                  </p>
                </div>
                <Switch
                  checked={settings.channelDefaults.autoReconnect}
                  onCheckedChange={(val) =>
                    updateNestedSetting("channelDefaults.autoReconnect", val)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <ApprovalInbox />
          <ExecApprovalsCard />

          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Safety Controls
              </CardTitle>
              <CardDescription>Tenant-wide protection and logging policies.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Disconnect Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when any node or channel goes offline.
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.notifyOnChannelDisconnect}
                  onCheckedChange={(val) =>
                    updateNestedSetting("notifications.notifyOnChannelDisconnect", val)
                  }
                />
              </div>
              <Separator className="bg-border/50" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Error Reporting</Label>
                  <p className="text-sm text-muted-foreground">
                    Broadcast critical processing errors to all admins.
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.notifyOnErrors}
                  onCheckedChange={(val) =>
                    updateNestedSetting("notifications.notifyOnErrors", val)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
