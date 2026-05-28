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
  ChannelsStatusParams,
  ChannelsStatusResult,
  ChannelsLogoutParams,
  WebLoginStartParams,
  WebLoginWaitParams,
  DevicePairListParams,
  DevicePairApproveParams,
  DevicePairRejectParams,
  DevicePairRemoveParams,
  DeviceTokenRotateParams,
  DeviceTokenRevokeParams,
  AgentsCreateParams,
  AgentsCreateResult,
  AgentsUpdateParams,
  AgentsUpdateResult,
  AgentsDeleteParams,
  AgentsDeleteResult,
  AgentsFilesListParams,
  AgentsFilesListResult,
  AgentsFilesGetParams,
  AgentsFilesGetResult,
  AgentsFilesSetParams,
  AgentsFilesSetResult,
  NodeListParams,
  NodeDescribeParams,
  NodeInvokeParams,
  NodeRenameParams,
  NodePairRequestParams,
  NodePairListParams,
  NodePairApproveParams,
  NodePairRejectParams,
  NodePairVerifyParams,
  NodePendingAckParams,
  NodePendingDrainParams,
  NodePendingEnqueueParams,
  ExecApprovalsGetParams,
  ExecApprovalsSetParams,
  ExecApprovalsNodeGetParams,
  ExecApprovalsNodeSetParams,
  ExecApprovalGetParams,
  ExecApprovalResolveParams,
} from "@openclaw/protocol/index";
// For schemas that don't have an explicit 'export type' in index.ts, we infer them:
import {
  ChatSendParamsSchema,
  ChatHistoryParamsSchema,
  SkillsStatusParamsSchema,
  SkillsUpdateParamsSchema,
  SkillsInstallParamsSchema,
  ToolsCatalogParamsSchema,
} from "@openclaw/protocol/index";
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
  "chat.abort": {
    params: { sessionKey: string; runId?: string };
    result: { ok: boolean; aborted: boolean; runIds: string[] };
  };
  "sessions.list": {
    params: SessionsListParams;
    result: {
      sessions: ReadonlyArray<unknown>;
      hasMore?: boolean;
    };
  };
  "sessions.get": {
    params: { key: string; limit?: number };
    result: {
      session: any;
      messages: ReadonlyArray<unknown>;
    };
  };
  "sessions.subscribe": {
    params: Record<string, never>;
    result: { subscribed: boolean };
  };
  "sessions.unsubscribe": {
    params: Record<string, never>;
    result: { subscribed: boolean };
  };
  "sessions.messages.subscribe": {
    params: { key: string };
    result: { subscribed: boolean; key: string };
  };
  "sessions.messages.unsubscribe": {
    params: { key: string };
    result: { subscribed: boolean; key: string };
  };
  "sessions.patch": {
    params: { key: string; label?: string; model?: string };
    result: { ok: boolean; key: string };
  };
  "sessions.abort": {
    params: { key: string; runId?: string };
    result: { ok: boolean; key: string; aborted: boolean };
  };
  "sessions.reset": {
    params: { key: string };
    result: { ok: boolean; key: string };
  };
  "sessions.compact": {
    params: { key: string };
    result: { ok: boolean; key: string; sessionId: string };
  };
  "sessions.delete": {
    params: { key: string; deleteTranscript?: boolean };
    result: { ok: boolean; key: string; deleted: boolean };
  };
  "sessions.usage": {
    params: { key: string };
    result: { sessions: Array<{ usage: any }> };
  };
  "sessions.compaction.list": {
    params: { key: string };
    result: { ok: boolean; checkpoints: any[] };
  };
  "sessions.compaction.branch": {
    params: { key: string; checkpointId: string; label?: string };
    result: { ok: boolean; key: string; sessionId: string };
  };
  "sessions.compaction.restore": {
    params: { key: string; checkpointId: string };
    result: { ok: boolean; key: string; sessionId: string };
  };
  "agents.list": {
    params: Record<string, never>;
    result: {
      agents: ReadonlyArray<AgentSummary>;
    };
  };
  "agents.create": {
    params: AgentsCreateParams;
    result: AgentsCreateResult;
  };
  "agents.update": {
    params: AgentsUpdateParams;
    result: AgentsUpdateResult;
  };
  "agents.delete": {
    params: AgentsDeleteParams;
    result: AgentsDeleteResult;
  };
  "agents.files.list": {
    params: AgentsFilesListParams;
    result: AgentsFilesListResult;
  };
  "agents.files.get": {
    params: AgentsFilesGetParams;
    result: AgentsFilesGetResult;
  };
  "agents.files.set": {
    params: AgentsFilesSetParams;
    result: AgentsFilesSetResult;
  };
  "models.list": {
    params: Record<string, never>;
    result: {
      models: ReadonlyArray<ModelCatalogEntry>;
    };
  };
  "channels.status": {
    params: ChannelsStatusParams;
    result: ChannelsStatusResult;
  };
  "channels.logout": {
    params: ChannelsLogoutParams;
    result: {
      channel: string;
      accountId: string;
      cleared: boolean;
      [key: string]: unknown;
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
  "skills.status": {
    params: z.infer<typeof SkillsStatusParamsSchema>;
    result: any; // We'll use any for now as the complex report type is not exported as a TS type in index.ts
  };
  "skills.update": {
    params: z.infer<typeof SkillsUpdateParamsSchema>;
    result: { ok: boolean; skillKey: string; config: any };
  };
  "skills.install": {
    params: z.infer<typeof SkillsInstallParamsSchema>;
    result: { ok: boolean; message: string };
  };
  "tools.catalog": {
    params: z.infer<typeof ToolsCatalogParamsSchema>;
    result: any;
  };
  "device.pair.list": {
    params: DevicePairListParams;
    result: {
      pending: any[];
      paired: any[];
    };
  };
  "device.pair.approve": {
    params: DevicePairApproveParams;
    result: { ok: boolean };
  };
  "device.pair.reject": {
    params: DevicePairRejectParams;
    result: { ok: boolean };
  };
  "device.pair.remove": {
    params: DevicePairRemoveParams;
    result: { ok: boolean };
  };
  "device.token.rotate": {
    params: DeviceTokenRotateParams;
    result: { ok: boolean; token?: string };
  };
  "device.token.revoke": {
    params: DeviceTokenRevokeParams;
    result: { ok: boolean };
  };
  "node.list": {
    params: NodeListParams;
    result: {
      ts: number;
      nodes: any[];
    };
  };
  "node.describe": {
    params: NodeDescribeParams;
    result: any;
  };
  "node.invoke": {
    params: NodeInvokeParams;
    result: {
      ok: boolean;
      nodeId: string;
      command: string;
      payload?: any;
      payloadJSON?: string | null;
    };
  };
  "node.rename": {
    params: NodeRenameParams;
    result: {
      nodeId: string;
      displayName: string;
    };
  };
  "node.pair.request": {
    params: NodePairRequestParams;
    result: any;
  };
  "node.pair.list": {
    params: NodePairListParams;
    result: {
      pending: any[];
      paired: any[];
    };
  };
  "node.pair.approve": {
    params: NodePairApproveParams;
    result: any;
  };
  "node.pair.reject": {
    params: NodePairRejectParams;
    result: any;
  };
  "node.pair.verify": {
    params: NodePairVerifyParams;
    result: any;
  };
  "node.pending.pull": {
    params: Record<string, never>;
    result: {
      nodeId: string;
      actions: any[];
    };
  };
  "node.pending.ack": {
    params: NodePendingAckParams;
    result: {
      nodeId: string;
      ackedIds: string[];
      remainingCount: number;
    };
  };
  "node.pending.drain": {
    params: NodePendingDrainParams;
    result: any;
  };
  "node.pending.enqueue": {
    params: NodePendingEnqueueParams;
    result: any;
  };
  "exec.approvals.get": {
    params: ExecApprovalsGetParams;
    result: any;
  };
  "exec.approvals.set": {
    params: ExecApprovalsSetParams;
    result: any;
  };
  "exec.approvals.node.get": {
    params: ExecApprovalsNodeGetParams;
    result: any;
  };
  "exec.approvals.node.set": {
    params: ExecApprovalsNodeSetParams;
    result: any;
  };
  "exec.approval.list": {
    params: Record<string, never>;
    result: Array<{
      id: string;
      request: any;
      createdAtMs: number;
      expiresAtMs: number;
    }>;
  };
  "exec.approval.get": {
    params: ExecApprovalGetParams;
    result: any;
  };
  "exec.approval.resolve": {
    params: ExecApprovalResolveParams;
    result: any;
  };
  "node.canvas.capability.refresh": {
    params: Record<string, never>;
    result: {
      canvasCapability: string;
      canvasCapabilityExpiresAtMs: number;
      canvasHostUrl: string;
    };
  };
  "doctor.memory.status": {
    params: Record<string, never>;
    result: any;
  };
  "doctor.memory.dreamDiary": {
    params: Record<string, never>;
    result: any;
  };
  "config.get": {
    params: Record<string, never>;
    result: { baseHash: string; config: any; exists: boolean };
  };
  "config.set": {
    params: { raw: string; baseHash?: string };
    result: { ok: boolean; config?: any; path?: string };
  };
  "config.patch": {
    params: { raw: string; baseHash?: string; note?: string };
    result: { ok: boolean; config?: any; path?: string };
  };
  "config.apply": {
    params: { raw: string; baseHash?: string; note?: string };
    result: { ok: boolean; config?: any; path?: string };
  };
  "config.schema": {
    params: Record<string, never>;
    result: { schema: any; uiHints: any; version: string; generatedAt: string };
  };
  "config.schema.lookup": {
    params: { path: string };
    result: any;
  };
}

export interface EventMap {
  "session.update": { sessionId: string };
  "sessions.changed": {
    sessionKey: string;
    reason?: string;
    phase?: string;
    ts: number;
    sessionId?: string;
    session?: any;
    [key: string]: any;
  };
  "session.message": { sessionKey: string; message: any; messageSeq?: number };
  chat: {
    runId: string;
    sessionKey: string;
    seq: number;
    state: "delta" | "final" | "aborted" | "error";
    message?: any;
    errorMessage?: string;
    usage?: any;
  };
  "node.pair.requested": any;
  "node.pair.resolved": any;
  "exec.approval.requested": any;
  "exec.approval.resolved": any;
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
