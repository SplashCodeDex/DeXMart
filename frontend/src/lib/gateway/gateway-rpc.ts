/**
 * gateway-rpc.ts
 *
 * Type-safe RPC wrapper around the untyped GatewayClient.
 * This file hand-maintains a MethodMap mapping string literal methods to their
 * request/response type pairs to ensure parity with upstream schemas.
 */

import type {
  SessionsListParams,
  SessionsPreviewParams,
  AgentSummary,
  WebLoginStartParams,
  WebLoginWaitParams,
} from "@openclaw/protocol/index";
// For schemas that don't have an explicit 'export type' in index.ts, we infer them:
import { ChatSendParamsSchema, ChatHistoryParamsSchema } from "@openclaw/protocol/index";
import { z } from "zod";
import { GatewayClient } from "./gateway-client";
import type { ModelCatalogEntry } from "./models-types";

export type ChatSendParams = z.infer<typeof ChatSendParamsSchema>;
export type ChatHistoryParams = z.infer<typeof ChatHistoryParamsSchema>;

export interface MethodMap {
  "chat.send": {
    params: ChatSendParams;
    result: void;
  };
  "chat.history": {
    params: ChatHistoryParams;
    result: {
      messages: ReadonlyArray<unknown>;
      hasMore?: boolean;
    };
  };
  "sessions.list": {
    params: SessionsListParams;
    result: {
      sessions: ReadonlyArray<unknown>;
      hasMore?: boolean;
    };
  };
  "sessions.preview": {
    params: SessionsPreviewParams;
    result: {
      preview: unknown;
    };
  };
  "agents.list": {
    params: Record<string, never>;
    result: {
      agents: ReadonlyArray<AgentSummary>;
    };
  };
  "models.list": {
    params: Record<string, never>;
    result: {
      models: ReadonlyArray<ModelCatalogEntry>;
    };
  };
  "web.login.start": {
    params: WebLoginStartParams;
    result: {
      qrDataUrl?: string;
      message: string;
    };
  };
  "web.login.wait": {
    params: WebLoginWaitParams;
    result: {
      connected: boolean;
      message: string;
    };
  };
}

export interface EventMap {
  "session.update": { sessionId: string };
  "chat.delta": { runId: string; delta: unknown };
}

export class GatewayRpc {
  constructor(private client: GatewayClient) {}

  public async call<M extends keyof MethodMap>(
    method: M,
    params: MethodMap[M]["params"],
  ): Promise<MethodMap[M]["result"]> {
    // Forward to the untyped client with an idempotency key where applicable
    // Note: The client will generate a default message ID inside if needed,
    // but we let it handle that logic.
    return this.client.call(method, params) as Promise<MethodMap[M]["result"]>;
  }

  public subscribe<E extends keyof EventMap>(
    event: E,
    handler: (payload: EventMap[E], meta: { seq?: number; stateVersion?: number }) => void,
  ): () => void {
    const internalHandler = (payload: unknown, meta: { seq?: number; stateVersion?: unknown }) => {
      handler(payload as EventMap[E], meta as { seq?: number; stateVersion?: number });
    };
    return this.client.subscribe(event, internalHandler);
  }
}
