"use client";

import {
  Brain,
  CheckCircle2,
  Download,
  ExternalLink,
  Key,
  Laptop,
  Lock,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  ShoppingCart,
  Zap,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useOmnichannelStore } from "@/stores/useOmnichannelStore";
import { useSkillsStatus } from "../hooks/useSkillsStatus";
import { PluginApprovalTab } from "./PluginApprovalTab";
import { SkillInstallDrawer } from "./SkillInstallDrawer";

const apiKeySchema = z.string().min(1, "API Key is required").max(256, "API Key too long");

interface SkillItem {
  id?: string;
  name?: string;
  description?: string;
  category?: string;
  source?: string;
  enabled?: boolean;
  isEligible?: boolean;
  requiredTier?: string;
  primaryEnv?: string;
  installId?: string;
  homepage?: string;
}

/**
 * SkillsDashboard Component
 * Encapsulates the logic and UI for the Intelligence Store.
 * Adheres to DeXMart 2026 Rule 8.1 (Thin Page) and Rule 181 (Emoji-Free).
 */
export function SkillsDashboard(): React.JSX.Element {
  const {
    skillReport,
    toolsCatalog,
    pluginApprovals,
    isLoading: isHookLoading,
    refresh: refreshRpc,
    toggleSkill: rpcToggle,
    saveSkillKey: rpcSaveKey,
    installSkill: rpcInstall,
  } = useSkillsStatus({ interval: 60000 });

  // We still keep store reference for any other data, but prioritize RPC hook
  const { isLoading: storeLoading } = useOmnichannelStore();
  const isLoading = isHookLoading || storeLoading;
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [selectedSkillKey, setSelectedSkillKey] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");

  const [installDrawerOpen, setInstallDrawerOpen] = useState(false);
  const [selectedInstallSkill, setSelectedInstallSkill] = useState<any>(null);

  const [activeTab, setActiveTab] = useState("all");

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    await refreshRpc();
    setIsRefreshing(false);
  };

  useEffect(() => {
    refreshRpc();
  }, [refreshRpc]);

  const skills = skillReport?.skills || [];

  const filteredSkills = (skills as SkillItem[]).filter((skill) => {
    const matchesSearch =
      (skill.name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (skill.description ?? "").toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeTab === "all") return true;

    // Category mapping
    const category = skill.category?.toLowerCase() || "";
    const id = skill.id?.toLowerCase() || "";

    if (activeTab === "intelligence") {
      return (
        category.includes("intelligence") ||
        ["web-search", "brave-search", "perplexity", "firecrawl", "dalle"].includes(id)
      );
    }
    if (activeTab === "social") {
      return (
        id.includes("youtube") ||
        id.includes("instagram") ||
        id.includes("tiktok") ||
        id.includes("facebook")
      );
    }
    if (activeTab === "engineering") {
      return (
        id.includes("coding") || id.includes("hooks") || id.includes("git") || id.includes("npm")
      );
    }
    if (activeTab === "commerce") {
      return (
        category.includes("commerce") ||
        id.includes("shop") ||
        id.includes("market") ||
        id.includes("pay")
      );
    }
    if (activeTab === "utilities") {
      return (
        category.includes("utility") ||
        category.includes("system") ||
        (!id.includes("search") && !id.includes("dl"))
      );
    }

    return true;
  });

  const handleToggle = async (key: string, currentDisabled: boolean): Promise<void> => {
    const success = await rpcToggle(key, currentDisabled);
    if (success) {
      toast.success(`Skill ${currentDisabled ? "enabled" : "disabled"} successfully`);
    }
  };

  const handleInstallClick = (skillStatus: any) => {
    setSelectedInstallSkill(skillStatus);
    setInstallDrawerOpen(true);
  };

  const handleSaveKey = async (): Promise<void> => {
    if (!selectedSkillKey) return;

    const validation = apiKeySchema.safeParse(apiKey);
    if (!validation.success) {
      toast.error(validation.error.issues[0]?.message || "Invalid API key");
      return;
    }

    const success = await rpcSaveKey(selectedSkillKey, apiKey);
    if (success) {
      toast.success("API key saved successfully");
      setKeyDialogOpen(false);
      setApiKey("");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground font-foreground flex items-center">
            <Zap className="mr-3 h-8 w-8 text-primary" />
            Intelligence Store
          </h2>
          <p className="text-muted-foreground">
            Enhance your bots with powerful skills, from web search to specialized analysis.
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="all" className="flex items-center">
              All
            </TabsTrigger>
            <TabsTrigger value="intelligence" className="flex items-center">
              <Brain className="mr-2 h-3.5 w-3.5" />
              AI & Reasoning
            </TabsTrigger>
            <TabsTrigger value="social" className="flex items-center">
              <Share2 className="mr-2 h-3.5 w-3.5" />
              Social Downloaders
            </TabsTrigger>
            <TabsTrigger value="engineering" className="flex items-center">
              <Laptop className="mr-2 h-3.5 w-3.5" />
              Advanced Engineering
            </TabsTrigger>
            <TabsTrigger value="commerce" className="flex items-center">
              <ShoppingCart className="mr-2 h-3.5 w-3.5" />
              Marketplace
            </TabsTrigger>
            <TabsTrigger value="approvals" className="flex items-center relative">
              <ShieldAlert className="mr-2 h-3.5 w-3.5" />
              Approvals
              {pluginApprovals.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground animate-pulse">
                  {pluginApprovals.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search skills..."
              className="pl-10 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-0">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredSkills.length === 0 && !isLoading ? (
              <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl">
                <Zap className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-muted-foreground">No skills found matching your search.</p>
              </div>
            ) : (
              filteredSkills.map((skill) => {
                const skillKey = skill.id || skill.name;
                const accessible = skill.isEligible;
                const requiredTier = skill.requiredTier || "starter";
                const statusInfo = skillReport?.skills.find(
                  (s: any) => s.skillKey === skillKey || s.name === skill.name,
                );

                const isInstalled = statusInfo ? statusInfo.missing.bins.length === 0 : true;
                const isDisabled = !skill.enabled;
                const needsKey = Boolean(statusInfo?.primaryEnv || skill.primaryEnv);
                const hasKey = Boolean(
                  statusInfo?.configChecks?.some(
                    (c: any) => c.key === statusInfo.primaryEnv && c.status === "ok",
                  ),
                );
                const category =
                  skill.category || (skill.source === "openclaw" ? "Intelligence" : "System");

                return (
                  <Card
                    key={skillKey}
                    className={cn(
                      "flex flex-col border-border/50 bg-card transition-all hover:shadow-md",
                      !accessible && "opacity-75 bg-muted/20",
                    )}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="rounded-lg bg-primary/10 p-2 text-primary">
                            {getIcon(skillKey)}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <CardTitle className="text-lg">{skill.name}</CardTitle>
                              {hasKey && (
                                <Badge
                                  variant="secondary"
                                  className="h-4 px-1 text-[8px] bg-green-500/10 text-green-500 border-green-500/20"
                                >
                                  Configured
                                </Badge>
                              )}
                            </div>
                            <CardDescription className="text-xs uppercase tracking-wider font-semibold opacity-70">
                              {category}
                            </CardDescription>
                          </div>
                        </div>
                        {!accessible && (
                          <Badge
                            variant="outline"
                            className="bg-orange-500/10 text-orange-500 border-orange-500/20 capitalize"
                          >
                            <Lock className="mr-1 h-3 w-3" />
                            {requiredTier}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                        {skill.description}
                      </p>

                      <div className="space-y-2">
                        {statusInfo?.missing.bins.map((bin: string) => (
                          <div key={bin} className="flex items-center text-[10px] text-destructive">
                            <ShieldAlert className="mr-1 h-3 w-3" />
                            Missing dependency: {bin}
                          </div>
                        ))}
                        {isInstalled ? (
                          <div className="flex items-center text-[10px] text-green-500">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            All dependencies satisfied
                          </div>
                        ) : null}
                      </div>
                    </CardContent>
                    <CardFooter className="border-t bg-muted/30 pt-4 flex flex-col space-y-2">
                      <div className="flex w-full space-x-2">
                        {accessible ? (
                          <>
                            {isInstalled ? (
                              <Button
                                variant={isDisabled ? "default" : "outline"}
                                className="flex-1"
                                onClick={() => skillKey && handleToggle(skillKey, isDisabled)}
                              >
                                {isDisabled ? "Enable Skill" : "Disable Skill"}
                              </Button>
                            ) : (
                              <Button
                                variant="default"
                                className="flex-1"
                                onClick={() => handleInstallClick(statusInfo)}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Install Details
                              </Button>
                            )}
                            {needsKey ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedSkillKey(skillKey ?? null);
                                  setKeyDialogOpen(true);
                                }}
                                title="Configure API Key"
                              >
                                <Key className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </>
                        ) : (
                          <Button variant="secondary" className="flex-1 w-full" asChild>
                            <a href="/dashboard/billing">Upgrade to Unlock</a>
                          </Button>
                        )}
                      </div>
                      {skill.homepage || statusInfo?.homepage ? (
                        <a
                          href={skill.homepage || statusInfo?.homepage}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-muted-foreground hover:text-primary flex items-center self-center"
                        >
                          Documentation <ExternalLink className="ml-1 h-2 w-2" />
                        </a>
                      ) : null}
                    </CardFooter>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
        <TabsContent value="commerce" className="mt-0">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredSkills.length === 0 && !isLoading ? (
              <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl">
                <Zap className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-muted-foreground">No marketplace skills found.</p>
              </div>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="approvals" className="mt-0">
          <PluginApprovalTab />
        </TabsContent>
      </Tabs>

      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Configure API Key</DialogTitle>
            <DialogDescription>
              Enter the API key required for this skill. This will be stored securely in your
              environment config.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setKeyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveKey}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SkillInstallDrawer
        skill={selectedInstallSkill}
        open={installDrawerOpen}
        onOpenChange={setInstallDrawerOpen}
      />
    </div>
  );
}
