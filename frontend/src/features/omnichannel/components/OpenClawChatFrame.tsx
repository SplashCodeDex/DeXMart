"use client";

import { Loader2, ExternalLink } from "lucide-react";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OpenClawChatFrameProps {
  className?: string;
  runId?: string; // Optional: Deep link to a specific run ID if supported
}

export function OpenClawChatFrame({
  className,
  runId: _runId,
}: OpenClawChatFrameProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // The backend proxies /api/openclaw-ui -> http://localhost:18789
  // The OpenClaw TUI often serves a web UI at the root.
  // Note: We might need to adjust the path if OpenClaw serves assets relative to root
  const proxyUrl = "/api/openclaw-ui";

  return (
    <div
      className={cn(
        "relative w-full h-full min-h-[500px] border border-border rounded-xl overflow-hidden bg-card",
        className,
      )}
    >
      {/* Loading Overlay */}
      {isLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">Connecting to Agent Reasoning Engine...</p>
        </div>
      ) : null}

      {/* Error State */}
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-20 p-6 text-center">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <ExternalLink className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Connection Failed</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            Could not connect to the local OpenClaw instance. Ensure the gateway is running with the
            UI enabled.
          </p>
          <Button variant="outline" onClick={() => window.open(proxyUrl, "_blank")}>
            Try Direct Link
          </Button>
        </div>
      ) : null}

      <iframe
        src={proxyUrl}
        className="w-full h-full border-0"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        title="OpenClaw Chat Interface"
      />
    </div>
  );
}
