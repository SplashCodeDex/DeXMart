/**
 * event-listener.ts
 *
 * Wires the agent event bus (src/infra/agent-events.ts) to MastermindStreamService.
 *
 * Agent runs emit events through emitAgentEvent(). This module subscribes to
 * those events and forwards them to MastermindStreamService, which delivers
 * them to the dashboard via Socket.IO in real time.
 *
 * The sessionKey on each event encodes the user and agent context:
 *   `${userId}:${agentId}:${channelId}`
 * This is set at the point where a message is routed to an agent (ingress-service.ts).
 * Events without a userId-shaped sessionKey (e.g. CLI runs) are silently ignored.
 *
 * Stream → MastermindEventType mapping:
 *   lifecycle / phase=start    → reasoning:start
 *   lifecycle / phase=complete → reasoning:complete
 *   lifecycle / phase=error    → reasoning:error
 *   assistant                  → reasoning:thought
 *   tool / phase=invoke|call   → tool:invoke
 *   tool / phase=result|complete → tool:result
 *   tool / phase=error         → reasoning:error
 *   error                      → reasoning:error
 */

import { onAgentEvent } from "@/infra/agent-events.js";
import type { AgentEventPayload } from "@/infra/agent-events.js";
import logger from "@/utils/logger.js";
import { mastermindStreamService } from "../services/MastermindStreamService.js";
import type {
  MastermindEventType,
  MastermindEventPayload,
} from "../services/MastermindStreamService.js";

// ── Session Key Parsing ───────────────────────────────────────────────────────

/**
 * Parses the sessionKey into its components.
 * Returns null if it doesn't follow the `userId:agentId:channelId` convention
 * (e.g., CLI runs that have no associated user).
 */
export function parseSessionKey(sessionKey: string | undefined): {
  userId: string;
  agentId: string;
  channelId: string;
} | null {
  if (!sessionKey) {
    return null;
  }
  const parts = sessionKey.split(":");
  if (parts.length < 2) {
    return null;
  }
  const [userId, agentId, channelId = "unknown"] = parts;
  if (!userId || !agentId) {
    return null;
  }
  return { userId, agentId, channelId };
}

// ── Event Mapping ─────────────────────────────────────────────────────────────

/**
 * Maps an AgentEventPayload to a MastermindEventType and payload.
 * Returns null for events that should not be forwarded (heartbeats, empty, unknown).
 */
export function mapAgentEvent(
  evt: AgentEventPayload,
  agentId: string,
): { type: MastermindEventType; payload: MastermindEventPayload } | null {
  const sessionId = evt.sessionKey;

  switch (evt.stream) {
    case "lifecycle": {
      const phase = evt.data["phase"] as string | undefined;
      switch (phase) {
        case "start":
          return {
            type: "reasoning:start",
            payload: {
              agentId,
              sessionId,
              stage: evt.data["stage"] as MastermindEventPayload["stage"] | undefined,
            },
          };
        case "complete":
          return {
            type: "reasoning:complete",
            payload: {
              agentId,
              sessionId,
              content: evt.data["summary"] as string | undefined,
            },
          };
        case "error":
          return {
            type: "reasoning:error",
            payload: {
              agentId,
              sessionId,
              error: evt.data["error"] as string | undefined,
            },
          };
        default:
          // Internal lifecycle phases (compaction, heartbeat) — not forwarded
          return null;
      }
    }

    case "assistant": {
      const text = evt.data["text"] as string | undefined;
      if (!text) {
        return null;
      }
      return {
        type: "reasoning:thought",
        payload: {
          agentId,
          sessionId,
          content: text,
          stage: evt.data["stage"] as MastermindEventPayload["stage"] | undefined,
        },
      };
    }

    case "tool": {
      const phase = evt.data["phase"] as string | undefined;
      const toolName =
        (evt.data["toolName"] as string | undefined) ??
        (evt.data["name"] as string | undefined) ??
        "unknown";

      switch (phase) {
        case "invoke":
        case "call":
          return {
            type: "tool:invoke",
            payload: {
              agentId,
              sessionId,
              toolName,
              params: evt.data["params"] ?? evt.data["input"],
            },
          };
        case "result":
        case "complete":
          return {
            type: "tool:result",
            payload: {
              agentId,
              sessionId,
              toolName,
              result: evt.data["result"] ?? evt.data["output"],
            },
          };
        case "error":
          return {
            type: "reasoning:error",
            payload: {
              agentId,
              sessionId,
              toolName,
              error: `Tool ${toolName} failed: ${typeof evt.data["error"] === "string" ? evt.data["error"] : JSON.stringify(evt.data["error"] ?? "unknown error")}`,
            },
          };
        default:
          return null;
      }
    }

    case "error": {
      return {
        type: "reasoning:error",
        payload: {
          agentId,
          sessionId,
          error:
            (evt.data["error"] as string | undefined) ??
            (evt.data["message"] as string | undefined) ??
            "Unknown agent error",
        },
      };
    }

    default:
      return null;
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

let unsubscribe: (() => void) | null = null;

/**
 * Starts the agent event listener.
 *
 * Subscribes to the agent event bus and forwards relevant events to
 * MastermindStreamService for real-time delivery to the dashboard.
 *
 * Call once at startup after socketService is initialized.
 * Returns an unsubscribe function for graceful shutdown.
 */
export function startAgentEventListener(): () => void {
  if (unsubscribe) {
    logger.warn("[EventListener] Already running — skipping duplicate registration");
    return unsubscribe;
  }

  logger.info("[EventListener] Starting agent event listener");

  unsubscribe = onAgentEvent((rawEvt: unknown) => {
    try {
      const evt = rawEvt as AgentEventPayload;
      const parsed = parseSessionKey(evt.sessionKey);
      if (!parsed) {
        return;
      } // No userId — not a user-initiated run (e.g. CLI)

      const { userId, agentId } = parsed;
      const mapped = mapAgentEvent(evt, agentId);
      if (!mapped) {
        return;
      }

      mastermindStreamService.emit(userId, mapped.type, mapped.payload);
    } catch (err) {
      // Errors here must never crash an agent run
      logger.error("[EventListener] Error processing agent event:", err);
    }
  });

  return () => stopAgentEventListener();
}

/**
 * Stops the agent event listener. Idempotent.
 */
export function stopAgentEventListener(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
    logger.info("[EventListener] Stopped");
  }
}

/**
 * Returns true if the listener is currently active.
 */
export function isAgentEventListenerRunning(): boolean {
  return unsubscribe !== null;
}
