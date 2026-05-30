"use client";

import { RefreshCw, Save } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { SchemaFormRenderer } from "@/components/schema-form/SchemaFormRenderer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRpcCall } from "@/lib/gateway/gateway-hooks";

export function GatewayConfigForm() {
  const [schema, setSchema] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [baseHash, setBaseHash] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [submitMode, setSubmitMode] = useState<"set" | "apply">("set");

  const getConfig = useRpcCall("config.get");
  const getSchema = useRpcCall("config.schema");
  const setConfigRpc = useRpcCall("config.set");
  const applyConfigRpc = useRpcCall("config.apply");

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [schemaRes, configRes] = await Promise.all([getSchema({}), getConfig({})]);
        setSchema(schemaRes.schema);
        setConfig(configRes.config);
        setBaseHash(configRes.baseHash);
      } catch (err) {
        console.error("Failed to load gateway config:", err);
        toast.error("Failed to load gateway configuration");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [getConfig, getSchema]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    setIsSaving(true);
    try {
      const rpc = submitMode === "set" ? setConfigRpc : applyConfigRpc;
      const res = await rpc({
        raw: JSON.stringify(data, null, 2),
        baseHash,
        ...(submitMode === "apply" ? { note: "Applied from DeXMart Dashboard" } : {}),
      });

      if (res.ok) {
        toast.success(
          submitMode === "set"
            ? "Configuration saved successfully"
            : "Configuration applied successfully",
          {
            description:
              submitMode === "apply" ? "Gateway is restarting with new settings." : undefined,
          },
        );
        // Optionally refresh config to get new hash
        const newConfig = await getConfig({});
        setConfig(newConfig.config);
        setBaseHash(newConfig.baseHash);
      } else {
        toast.error(`Failed to ${submitMode} configuration`);
      }
    } catch (err) {
      console.error(`Failed to ${submitMode} gateway config:`, err);
      toast.error(`Error ${submitMode === "set" ? "saving" : "applying"} gateway configuration`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  if (!schema) {
    return <div>Failed to load schema.</div>;
  }

  const triggerSubmit = (mode: "set" | "apply") => {
    setSubmitMode(mode);
    // Use setTimeout to ensure state update is processed before click
    setTimeout(() => {
      (document.querySelector('button[type="submit"]') as HTMLButtonElement)?.click();
    }, 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 mb-4">
        <Button variant="outline" onClick={() => triggerSubmit("apply")} disabled={isSaving}>
          {isSaving && submitMode === "apply" ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {isSaving && submitMode === "apply" ? "Applying..." : "Apply & Restart"}
        </Button>
        <Button onClick={() => triggerSubmit("set")} disabled={isSaving}>
          {isSaving && submitMode === "set" ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isSaving && submitMode === "set" ? "Saving..." : "Save Config"}
        </Button>
      </div>
      <SchemaFormRenderer schema={schema} defaultValues={config} onSubmit={handleSubmit} />
    </div>
  );
}
