"use client";

import { useQuery } from "@tanstack/react-query";
import { Bot, Save, RefreshCw, Shield, Globe, Cpu } from "lucide-react";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { ModelSelector } from "@/components/shared/ModelSelector";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOmnichannelStore } from "@/stores/useOmnichannelStore";
import { useAgentIdentity } from "../hooks/useAgentIdentity";

interface AgentIdentityFeatureProps {
  agentId: string;
}

export function AgentIdentityFeature({ agentId }: AgentIdentityFeatureProps) {
  const { identity, isLoading, updateIdentity, refresh } = useAgentIdentity(agentId);
  const { channels, fetchAllChannels, moveChannel } = useOmnichannelStore();

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (identity) {
      setName(identity.name || "");
      setAvatarUrl(identity.avatarUrl || "");
      setSelectedModel(identity.model || "");
    }
  }, [identity]);

  useEffect(() => {
    fetchAllChannels();
  }, [fetchAllChannels]);

  const handleSave = async () => {
    setIsUpdating(true);
    const success = await updateIdentity({
      name,
      avatarUrl,
      model: selectedModel,
    });

    if (success) {
      toast.success("Agent identity updated successfully");
    } else {
      toast.error("Failed to update agent identity");
    }
    setIsUpdating(false);
  };

  const handleChannelToggle = async (channelId: string, assigned: boolean) => {
    if (assigned) {
      // If already assigned to this agent, we might want to move it to default?
      // The store moveChannel expects (channelId, currentAgentId, targetAgentId)
      // If we uncheck, maybe we move to system_default
      await moveChannel(channelId, agentId, "system_default");
    } else {
      // If not assigned to this agent, move it here
      const channel = channels.find((c) => c.id === channelId);
      const currentAgentId = channel?.assignedAgentId || "system_default";
      await moveChannel(channelId, currentAgentId, agentId);
    }
    fetchAllChannels();
    refresh();
  };

  if (isLoading && !identity) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center">
            <Shield className="mr-2 h-4 w-4 text-primary" />
            Core Identity
          </CardTitle>
          <CardDescription className="text-[10px]">
            Define the neural footprint and visual representation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4 mb-6">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="bg-primary/5 text-primary">
                <Bot size={32} />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <Label htmlFor="agent-id" className="text-[10px] uppercase font-black opacity-50">
                System ID
              </Label>
              <div className="flex items-center space-x-2">
                <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{agentId}</code>
                <Badge variant="outline" className="text-[8px] uppercase font-bold h-4">
                  Neural Node
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-bold uppercase tracking-tight">
              Display Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter agent name..."
              className="bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatar" className="text-xs font-bold uppercase tracking-tight">
              Avatar URL
            </Label>
            <Input
              id="avatar"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="bg-background/50 font-mono text-xs"
            />
          </div>

          <Button
            className="w-full mt-4 font-bold uppercase text-[10px]"
            onClick={handleSave}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-2 h-3 w-3" />
            )}
            Save Identity
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center">
              <Cpu className="mr-2 h-4 w-4 text-primary" />
              Cognitive Model
            </CardTitle>
            <CardDescription className="text-[10px]">
              Select the LLM substrate for this agent's logic.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-background/50 p-2 max-h-[200px] overflow-auto">
              <ModelSelector value={selectedModel} onSelect={(m) => setSelectedModel(m.id)} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 italic">
              Current:{" "}
              <span className="font-bold text-foreground">{selectedModel || "system_default"}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center">
              <Globe className="mr-2 h-4 w-4 text-primary" />
              Omnichannel Matrix
            </CardTitle>
            <CardDescription className="text-[10px]">
              Assign communication channels to this agent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {channels.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic text-center py-4">
                  No channels available.
                </p>
              ) : (
                channels.map((chan) => {
                  const isAssigned = chan.assignedAgentId === agentId;
                  return (
                    <div
                      key={chan.id}
                      className="flex items-center justify-between p-2 rounded-lg border bg-background/50 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id={`chan-${chan.id}`}
                          checked={isAssigned}
                          onCheckedChange={() => handleChannelToggle(chan.id, isAssigned)}
                        />
                        <div className="flex flex-col">
                          <Label
                            htmlFor={`chan-${chan.id}`}
                            className="text-xs font-bold cursor-pointer"
                          >
                            {chan.name}
                          </Label>
                          <span className="text-[9px] text-muted-foreground uppercase">
                            {chan.type}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={isAssigned ? "default" : "outline"}
                        className="text-[8px] h-4"
                      >
                        {isAssigned ? "Assigned" : "Available"}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
