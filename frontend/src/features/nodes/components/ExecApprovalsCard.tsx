"use client";

import type { ExecApprovalsFile } from "@openclaw/protocol";
import { Check, Edit2, Loader2, Save, Shield, ShieldCheck, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useExecApprovals } from "../hooks/useExecApprovals";

export function ExecApprovalsCard() {
  const { getSnapshot, setApprovals } = useExecApprovals();
  const [snapshot, setSnapshot] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<ExecApprovalsFile | null>(null);

  const fetchSnapshot = async () => {
    try {
      const res = await getSnapshot();
      setSnapshot(res);
      setFormData(res.file);
    } catch (err) {
      console.error("Failed to fetch execution approvals:", err);
    }
  };

  useEffect(() => {
    fetchSnapshot();
  }, []);

  const handleSave = async () => {
    if (!formData) return;
    setIsSaving(true);
    try {
      await setApprovals({
        file: formData,
        baseHash: snapshot?.hash,
      });
      toast.success("Security policy updated");
      setIsEditing(false);
      fetchSnapshot();
    } catch (err) {
      toast.error("Failed to update security policy");
    } finally {
      setIsSaving(false);
    }
  };

  if (!snapshot) return null;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-xl overflow-hidden relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-accent" />
            <CardTitle className="text-xl font-bold">Execution Approvals</CardTitle>
          </div>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Policy
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Policy
              </Button>
            </div>
          )}
        </div>
        <CardDescription>
          Configure how the gateway handles remote command execution requests from agents.
        </CardDescription>
      </CardHeader>
      <CardContent className="relative z-10 space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Security Level</Label>
              {isEditing ? (
                <Input
                  value={formData?.defaults?.security || ""}
                  onChange={(e) =>
                    setFormData((prev: ExecApprovalsFile | null) =>
                      prev
                        ? { ...prev, defaults: { ...prev.defaults, security: e.target.value } }
                        : null,
                    )
                  }
                  className="h-8 w-32 bg-background/50"
                />
              ) : (
                <Badge variant="outline" className="bg-accent/5 text-accent border-accent/20">
                  {formData?.defaults?.security || "default"}
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Auto-allow Skills</Label>
              <Switch
                checked={formData?.defaults?.autoAllowSkills ?? false}
                onCheckedChange={(checked) =>
                  setFormData((prev: ExecApprovalsFile | null) =>
                    prev
                      ? { ...prev, defaults: { ...prev.defaults, autoAllowSkills: checked } }
                      : null,
                  )
                }
                disabled={!isEditing}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Ask Policy</Label>
              {isEditing ? (
                <Input
                  value={formData?.defaults?.ask || ""}
                  onChange={(e) =>
                    setFormData((prev: ExecApprovalsFile | null) =>
                      prev
                        ? { ...prev, defaults: { ...prev.defaults, ask: e.target.value } }
                        : null,
                    )
                  }
                  className="h-8 w-32 bg-background/50"
                />
              ) : (
                <span className="text-sm font-medium">{formData?.defaults?.ask || "default"}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Config Source</Label>
              <span className="text-xs font-mono text-muted-foreground truncate max-w-[150px]">
                {snapshot.path}
              </span>
            </div>
          </div>
        </div>

        {formData?.agents && Object.keys(formData.agents).length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
              Agent Specific Overrides
            </h3>
            <div className="grid gap-4">
              {Object.entries(formData.agents).map(([agentId, policy]) => {
                const p = policy as any;
                return (
                  <div
                    key={agentId}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-accent/10 flex items-center justify-center text-accent">
                        <Shield className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold">{agentId}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary" className="text-[10px]">
                        {p.security || "inherit"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {p.allowlist?.length || 0} Allowlist Rules
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
