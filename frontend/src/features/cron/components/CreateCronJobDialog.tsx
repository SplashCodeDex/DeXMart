"use client";

import { Loader2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { ModelSelector } from "@/components/shared/ModelSelector";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useOmnichannelStore } from "@/stores/useOmnichannelStore";
import type { CronSchedule, CronPayload } from "@/types";

interface CreateCronJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCronJobDialog({
  open,
  onOpenChange,
}: CreateCronJobDialogProps): React.JSX.Element {
  const { createCronJob } = useOmnichannelStore();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scheduleKind, setScheduleKind] = useState<"every" | "at" | "cron">("every");
  const [scheduleValue, setScheduleValue] = useState("60000"); // Default 1 minute in ms
  const [staggerMs, setStaggerMs] = useState("0");
  const [oneShot, setOneShot] = useState(false);

  const [payloadKind, setPayloadKind] = useState<"systemEvent" | "agentTurn">("systemEvent");
  const [payloadText, setPayloadText] = useState("");
  const [agentId, setAgentId] = useState("default");
  const [enabled, setEnabled] = useState(true);

  // Advanced & Overrides
  const [deliveryMode, setDeliveryMode] = useState<"none" | "announce" | "webhook">("announce");
  const [model, setModel] = useState<string | null>(null);
  const [thinking, setThinking] = useState<string>("none");

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);

    try {
      let schedule: CronSchedule;
      if (scheduleKind === "every") {
        schedule = { kind: "every", everyMs: parseInt(scheduleValue) };
      } else if (scheduleKind === "at") {
        schedule = { kind: "at", at: scheduleValue };
      } else {
        schedule = { kind: "cron", expr: scheduleValue, staggerMs: parseInt(staggerMs) };
      }

      const payload: CronPayload =
        payloadKind === "systemEvent"
          ? { kind: "systemEvent", text: payloadText }
          : {
              kind: "agentTurn",
              message: payloadText,
              model: model || undefined,
              thinking: thinking === "none" ? undefined : thinking,
            };

      const success = await createCronJob({
        name,
        description,
        agentId,
        enabled,
        schedule,
        payload,
        wakeMode: "now",
        sessionTarget: "main",
        delivery: {
          mode: deliveryMode,
        },
        oneShot: oneShot || undefined,
      } as any);

      if (success) {
        toast.success("Cron job created successfully");
        onOpenChange(false);
        resetForm();
      } else {
        toast.error("Failed to create cron job");
      }
    } catch {
      toast.error("Invalid schedule or payload data");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = (): void => {
    setName("");
    setDescription("");
    setScheduleKind("every");
    setScheduleValue("60000");
    setStaggerMs("0");
    setOneShot(false);
    setPayloadKind("systemEvent");
    setPayloadText("");
    setAgentId("default");
    setEnabled(true);
    setDeliveryMode("announce");
    setModel(null);
    setThinking("none");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Cron Job</DialogTitle>
          <DialogDescription>
            Schedule a recurring task or a one-time wakeup for your bots.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Job Name</Label>
              <Input
                id="name"
                placeholder="Morning Health Check"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agentId">Agent ID</Label>
              <Input
                id="agentId"
                placeholder="default"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              placeholder="Runs every morning to verify connectivity"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <div className="space-y-2">
              <Label>Schedule Type</Label>
              <Select
                value={scheduleKind}
                onValueChange={(v: "every" | "at" | "cron") => setScheduleKind(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="every">Interval (ms)</SelectItem>
                  <SelectItem value="at">Specific Time</SelectItem>
                  <SelectItem value="cron">Cron Expression</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduleValue">
                {scheduleKind === "every"
                  ? "Milliseconds"
                  : scheduleKind === "at"
                    ? "ISO Timestamp"
                    : "Expression"}
              </Label>
              <Input
                id="scheduleValue"
                placeholder={scheduleKind === "cron" ? "*/5 * * * *" : "60000"}
                value={scheduleValue}
                onChange={(e) => setScheduleValue(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label>Payload Type</Label>
            <Select
              value={payloadKind}
              onValueChange={(v: "systemEvent" | "agentTurn") => setPayloadKind(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="systemEvent">System Event</SelectItem>
                <SelectItem value="agentTurn">Agent Turn (Message)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payloadText">
              {payloadKind === "systemEvent" ? "Event Text" : "Message Content"}
            </Label>
            <Input
              id="payloadText"
              placeholder={
                payloadKind === "systemEvent" ? "ping" : "Hello agent, start your daily tasks."
              }
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              required
            />
          </div>

          <Accordion type="single" collapsible className="w-full border-t pt-2">
            <AccordionItem value="advanced" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-semibold hover:no-underline">
                Advanced Options & Overrides
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2 pb-1 px-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Delivery Mode</Label>
                    <Select value={deliveryMode} onValueChange={(v: any) => setDeliveryMode(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="announce">Announce</SelectItem>
                        <SelectItem value="webhook">Webhook</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stagger">Stagger (ms)</Label>
                    <Input
                      id="stagger"
                      type="number"
                      value={staggerMs}
                      onChange={(e) => setStaggerMs(e.target.value)}
                      disabled={scheduleKind !== "cron"}
                    />
                  </div>
                </div>

                {payloadKind === "agentTurn" && (
                  <>
                    <div className="space-y-2">
                      <Label>Model Override</Label>
                      <ModelSelector value={model} onSelect={setModel} />
                    </div>
                    <div className="space-y-2">
                      <Label>Thinking Level</Label>
                      <Select value={thinking} onValueChange={setThinking}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Default</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="xhigh">X-High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <Label>One-Shot Job</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Delete job automatically after successful run.
                    </p>
                  </div>
                  <Switch checked={oneShot} onCheckedChange={setOneShot} />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex items-center justify-between border-t pt-4">
            <div className="space-y-0.5">
              <Label>Enable Immediately</Label>
              <p className="text-xs text-muted-foreground">
                Job will start as soon as it's created.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Job
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
