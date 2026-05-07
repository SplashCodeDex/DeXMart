"use client";

import { useCallback, useState } from "react";
import { useGateway } from "@/lib/gateway/gateway-hooks";
import { type ActionResult } from "@/types/api";

export interface CreateAgentInput {
  name: string;
  iconName?: string;
  systemPrompt?: string;
  model?: string;
}

export interface UpdateAgentInput {
  name?: string;
  iconName?: string;
  systemPrompt?: string;
  model?: string;
  avatarUrl?: string;
}

export function useAgentsCrud() {
  const { rpc, status } = useGateway();
  const [isLoading, setIsLoading] = useState(false);

  const createAgent = useCallback(
    async (input: CreateAgentInput): Promise<ActionResult<{ id: string; runId?: string }>> => {
      if (status !== "connected" || !rpc) {
        return {
          success: false,
          error: { code: "NOT_CONNECTED", message: "Not connected to gateway" },
        };
      }

      setIsLoading(true);
      try {
        const result = await (rpc as any).call("agents.create", input);
        if (result.ok) {
          return {
            success: true,
            data: {
              id: result.agent?.id || result.agentId,
              runId: result.runId,
            },
            message: "Agent created successfully",
          };
        }
        return {
          success: false,
          error: {
            code: result.error?.code || "CREATE_FAILED",
            message: result.error?.message || "Failed to create agent",
          },
        };
      } catch (err) {
        return {
          success: false,
          error: {
            code: "RPC_ERROR",
            message: err instanceof Error ? err.message : "Unknown error",
          },
        };
      } finally {
        setIsLoading(false);
      }
    },
    [rpc, status],
  );

  const updateAgent = useCallback(
    async (id: string, updates: UpdateAgentInput): Promise<boolean> => {
      if (status !== "connected" || !rpc) return false;

      try {
        const result = await (rpc as any).call("agents.update", { id, ...updates });
        return result.ok;
      } catch (err) {
        console.error("Failed to update agent:", err);
        return false;
      }
    },
    [rpc, status],
  );

  const deleteAgent = useCallback(
    async (id: string, deleteFiles: boolean = true): Promise<boolean> => {
      if (status !== "connected" || !rpc) return false;

      try {
        const result = await (rpc as any).call("agents.delete", { id, deleteFiles });
        return result.ok;
      } catch (err) {
        console.error("Failed to delete agent:", err);
        return false;
      }
    },
    [rpc, status],
  );

  const waitAndRefresh = useCallback(
    async (runId: string, timeoutMs: number = 60_000): Promise<boolean> => {
      if (status !== "connected" || !rpc) return false;

      try {
        const result = await (rpc as any).call("agent.wait", { runId, timeoutMs });
        return result.status === "ok";
      } catch (err) {
        console.error("agent.wait failed:", err);
        return false;
      }
    },
    [rpc, status],
  );

  return {
    createAgent,
    updateAgent,
    deleteAgent,
    waitAndRefresh,
    isLoading,
  };
}
