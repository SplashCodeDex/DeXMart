"use client";

import { Download, Info, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSkillsStatus } from "../hooks/useSkillsStatus";

interface SkillInstallDrawerProps {
  skill: any; // SkillStatusEntry
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SkillInstallDrawer({ skill, open, onOpenChange }: SkillInstallDrawerProps) {
  const { installSkill } = useSkillsStatus({ enabled: false });
  const [isInstalling, setIsInstalling] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isInstalling) {
      setProgress(5);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return 95;
          // Slowly increase progress to simulate activity
          const increment = Math.random() * 15;
          return Math.min(prev + increment, 95);
        });
      }, 800);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [isInstalling]);

  if (!skill) return null;

  const handleInstall = async (installId: string) => {
    setIsInstalling(true);
    try {
      const success = await installSkill(skill.skillKey || skill.name, installId);
      if (success) {
        setProgress(100);
        toast.success(`Installation of ${skill.name} successful`);
        // Small delay to show 100% progress
        setTimeout(() => {
          onOpenChange(false);
        }, 500);
      } else {
        toast.error(`Failed to initiate installation for ${skill.name}`);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  const missingBins = skill.missing?.bins || [];
  const requirements = skill.requirements || { bins: [], env: [], config: [], os: [] };
  const hasMissing = missingBins.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center">
            <Info className="mr-2 h-5 w-5 text-primary" />
            Skill Details: {skill.name}
          </SheetTitle>
          <SheetDescription>
            {skill.description || "Review dependencies and installation options."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center">
              <ShieldAlert className="mr-2 h-4 w-4 text-orange-500" />
              Requirements
            </h4>
            <div className="grid gap-2">
              {requirements.bins.map((bin: string) => {
                const isMissing = missingBins.includes(bin);
                return (
                  <div
                    key={bin}
                    className="flex items-center justify-between rounded-md border p-2 text-xs"
                  >
                    <span className="font-mono">{bin}</span>
                    {isMissing ? (
                      <Badge variant="destructive" className="text-[10px] h-5">
                        Missing
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-5 text-green-500 border-green-500/20 bg-green-500/5"
                      >
                        Installed
                      </Badge>
                    )}
                  </div>
                );
              })}
              {requirements.bins.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No binary dependencies.</p>
              )}
            </div>
          </div>

          {requirements.env.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Environment Variables</h4>
              <div className="flex flex-wrap gap-2">
                {requirements.env.map((env: string) => (
                  <Badge key={env} variant="secondary" className="font-mono text-[10px]">
                    {env}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-4 text-xs space-y-2">
            <p className="font-semibold text-muted-foreground uppercase tracking-wider">
              Installation Strategy
            </p>
            {skill.install && skill.install.length > 0 ? (
              <p>
                This skill will be installed via <strong>{skill.install[0].label}</strong> (
                {skill.install[0].method}).
              </p>
            ) : (
              <p>Manual installation required for this skill's dependencies.</p>
            )}
          </div>

          <div className="pt-4 space-y-4">
            {isInstalling && (
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold">
                  <span>Installing Dependencies...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            )}

            {skill.install &&
              skill.install.map((option: any) => (
                <Button
                  key={option.id}
                  className="w-full"
                  disabled={isInstalling}
                  onClick={() => handleInstall(option.id)}
                >
                  {isInstalling ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Install via {option.label}
                </Button>
              ))}

            {!hasMissing && (
              <div className="flex items-center justify-center text-xs text-green-500 font-medium py-2">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                All requirements met
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
