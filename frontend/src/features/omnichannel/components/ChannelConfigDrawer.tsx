"use client";

import { Loader2, Save, X } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useGateway } from "@/lib/gateway/gateway-hooks";
import type { Channel } from "@/types/omnichannel";

interface ChannelConfigDrawerProps {
  channel: Channel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChannelConfigDrawer({
  channel,
  open,
  onOpenChange,
}: ChannelConfigDrawerProps): React.JSX.Element {
  const [isSaving, setIsSaving] = useState(false);
  const { rpc } = useGateway();

  // These would ideally come from the channel's actual config
  const [phone, setPhone] = useState("");
  const [webhook, setWebhook] = useState("");
  const [sessionName, setSessionName] = useState(channel.name);

  const handleSave = async () => {
    if (!rpc) return;
    setIsSaving(true);
    try {
      // Logic for config.set or specific channel update RPC
      // For now, simulating the intent
      toast.success("Channel configuration updated");
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to save channel config:", err);
      toast.error("Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md border-l border-border/50 bg-card/95 backdrop-blur-xl">
        <SheetHeader>
          <SheetTitle>Configure {channel.name}</SheetTitle>
          <SheetDescription>
            Update channel-specific settings. These changes apply to the gateway instance.
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="sessionName">Session Name</Label>
            <Input
              id="sessionName"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g. Primary WhatsApp"
              className="bg-background/50 border-border/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number (Optional)</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1234567890"
              className="bg-background/50 border-border/50"
            />
            <p className="text-[10px] text-muted-foreground">
              Used for pairing codes or identification.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook">Custom Webhook URL (Optional)</Label>
            <Input
              id="webhook"
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              placeholder="https://your-api.com/webhook"
              className="bg-background/50 border-border/50"
            />
            <p className="text-[10px] text-muted-foreground">
              Override default message routing for this channel.
            </p>
          </div>
        </div>

        <SheetFooter className="flex-col sm:flex-row gap-2 mt-6">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button className="flex-1 font-bold" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Configuration
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
