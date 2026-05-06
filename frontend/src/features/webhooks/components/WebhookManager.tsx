"use client";

import { Zap, Plus, Trash2, Shield, Copy, RefreshCw } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api, API_ENDPOINTS } from "@/lib/api";
import { Webhook, WEBHOOK_EVENTS, WebhookEvent } from "../types";

export function WebhookManager(): React.JSX.Element {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchWebhooks = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await api.get<Webhook[]>(API_ENDPOINTS.WEBHOOKS.LIST);
      if (response.success) {
        setWebhooks(response.data);
      }
    } catch {
      toast.error("Failed to load webhooks");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleCreate = async (): Promise<void> => {
    if (!url || selectedEvents.length === 0) {
      toast.error("Please provide a URL and select at least one event");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post<Webhook>(API_ENDPOINTS.WEBHOOKS.CREATE, {
        name: name || "External Hook",
        url,
        events: selectedEvents,
      });

      if (response.success) {
        toast.success("Webhook created successfully");
        setIsCreateOpen(false);
        fetchWebhooks();
        // Reset form
        setName("");
        setUrl("");
        setSelectedEvents([]);
      }
    } catch {
      toast.error("Failed to create webhook");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    try {
      const response = await api.delete(API_ENDPOINTS.WEBHOOKS.DELETE(id));
      if (response.success) {
        toast.success("Webhook deleted");
        setWebhooks(webhooks.filter((w) => w.id !== id));
      }
    } catch {
      toast.error("Failed to delete webhook");
    }
  };

  const copyToClipboard = async (text: string, label: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error(`Failed to copy ${label} — check browser clipboard permissions`);
    }
  };

  const toggleEvent = (event: WebhookEvent): void => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">External Webhooks</h2>
          <p className="text-muted-foreground">
            Receive real-time notifications for system events on your own server.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl">
              <Plus className="mr-2 h-4 w-4" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] border-border bg-card">
            <DialogHeader>
              <DialogTitle>Create New Webhook</DialogTitle>
              <DialogDescription>Securely deliver events to your external API.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Friendy Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. My CRM Sync"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="url">Payload URL</Label>
                <Input
                  id="url"
                  placeholder="https://api.yourdomain.com/webhooks"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="grid gap-2">
                <Label>Events to Deliver</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {WEBHOOK_EVENTS.map((event) => (
                    <div key={event} className="flex items-center space-x-2">
                      <Checkbox
                        id={event}
                        checked={selectedEvents.includes(event as WebhookEvent)}
                        onCheckedChange={() => toggleEvent(event as WebhookEvent)}
                      />
                      <Label htmlFor={event} className="text-xs cursor-pointer truncate">
                        {event}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isSubmitting}
                className="rounded-lg bg-primary text-primary-foreground"
              >
                {isSubmitting ? (
                  <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-3 w-3" />
                )}
                Create Hook
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <Card key={i} className="border-border/50 bg-card/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-60" />
                  </div>
                  <Skeleton className="h-10 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : webhooks.length === 0 ? (
        <Card className="border-dashed border-border/50 bg-muted/5 p-12 text-center">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">No webhooks configured</h3>
              <p className="text-muted-foreground max-w-sm">
                Bridge DeXMart logic with your internal systems by creating your first webhook.
              </p>
            </div>
            <Button onClick={() => setIsCreateOpen(true)} variant="outline" className="rounded-xl">
              <Plus className="mr-2 h-4 w-4" />
              Create your first hook
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {webhooks.map((webhook) => (
            <Card
              key={webhook.id}
              className="border-border/50 bg-card overflow-hidden group transition-all hover:border-primary/50 hover:shadow-md"
            >
              <CardHeader className="p-6 pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center text-lg">
                      {webhook.name}
                      <Badge
                        variant={webhook.isActive ? "default" : "secondary"}
                        className="ml-3 text-[10px] uppercase font-bold px-2"
                      >
                        {webhook.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="flex items-center mt-1">
                      <code className="text-xs bg-muted/50 px-2 py-0.5 rounded text-primary font-mono truncate max-w-[300px]">
                        {webhook.url}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 ml-1 opacity-0 group-hover:opacity-100"
                        onClick={() => copyToClipboard(webhook.url, "URL")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </CardDescription>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                      onClick={() => handleDelete(webhook.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {webhook.events.map((event) => (
                      <Badge
                        key={event}
                        variant="outline"
                        className="text-[10px] bg-primary/5 border-primary/20 text-primary-foreground/70"
                      >
                        {event}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                    <div className="flex items-center space-x-3">
                      <Shield className="h-4 w-4 text-accent-500" />
                      <div className="text-xs">
                        <p className="font-semibold text-muted-foreground uppercase">
                          Signing Secret
                        </p>
                        <p className="font-mono mt-1 opacity-50">
                          ••••••••••••••••••••••••••••••••
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] h-8 px-3 rounded-lg hover:bg-white/5"
                      onClick={() => copyToClipboard(webhook.secret, "Secret")}
                    >
                      Reveal & Copy
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
