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

  const getConfig = useRpcCall("config.get");
  const getSchema = useRpcCall("config.schema");
  const setConfigRpc = useRpcCall("config.set");

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
      const res = await setConfigRpc({
        raw: JSON.stringify(data, null, 2),
        baseHash,
      });
      if (res.ok) {
        toast.success("Configuration saved successfully");
        // Optionally refresh config to get new hash
        const newConfig = await getConfig({});
        setConfig(newConfig.config);
        setBaseHash(newConfig.baseHash);
      } else {
        toast.error("Failed to save configuration");
      }
    } catch (err) {
      console.error("Failed to save gateway config:", err);
      toast.error("Error saving gateway configuration");
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-4">
        <Button
          onClick={() =>
            (document.querySelector('button[type="submit"]') as HTMLButtonElement)?.click()
          }
          disabled={isSaving}
        >
          {isSaving ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isSaving ? "Saving..." : "Save Config"}
        </Button>
      </div>
      <SchemaFormRenderer schema={schema} defaultValues={config} onSubmit={handleSubmit} />
    </div>
  );
}
