/**
 * Omnichannel Frontend Types
 */
export type { AgentIdentityResponse as AgentIdentityResult } from "@DeXMart/shared";

export type ChannelType = string;

export interface PlatformField {
  id: string;
  label: string;
  placeholder: string;
  type?: "text" | "password" | "number";
}

export interface PlatformMetadata {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  fields: PlatformField[];
}

export type ChannelStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "error"
  | "qr_pending"
  | "initializing"
  | "archived"
  | "banned"
  | "logged_out"
  | "reconnect_exhausted";

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  status: ChannelStatus;
  account: string | null;
  lastActiveAt?: string | Date;
  assignedAgentId?: string | null;
  lastProgress?: {
    step: string;
    status: BotProgressUpdate["status"];
  };
}

export interface ActivityEvent {
  id: string;
  botId: string;
  channel: string;
  type: "inbound" | "outbound" | "system" | "skill" | "agent_thinking" | "tool_start" | "tool_end";
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface BotProgressUpdate {
  botId: string;
  step: string;
  status: "pending" | "in_progress" | "complete" | "error";
  timestamp: string;
}

// --- Cron Types (Ported from OpenClaw) ---

export type CronSchedule =
  | { kind: "at"; at: string }
  | { kind: "every"; everyMs: number; anchorMs?: number }
  | { kind: "cron"; expr: string; tz?: string; staggerMs?: number };

export type CronSessionTarget = "main" | "isolated";
export type CronWakeMode = "next-heartbeat" | "now";

export type CronPayload =
  | { kind: "systemEvent"; text: string }
  | {
      kind: "agentTurn";
      message: string;
      thinking?: string;
      timeoutSeconds?: number;
      model?: string;
    };

export type CronDelivery = {
  mode: "none" | "announce";
  channel?: string;
  to?: string;
  bestEffort?: boolean;
};

export type CronJobState = {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error" | "skipped";
  lastError?: string;
  lastDurationMs?: number;
};

export interface CronJob {
  id: string;
  agentId?: string;
  name: string;
  description?: string;
  enabled: boolean;
  notify?: boolean;
  deleteAfterRun?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  sessionTarget: CronSessionTarget;
  wakeMode: CronWakeMode;
  payload: CronPayload;
  delivery?: CronDelivery;
  state?: CronJobState;
}

export interface CronStatus {
  enabled: boolean;
  jobs: number;
  nextWakeAtMs?: number | null;
}

export interface CronRunLogEntry {
  ts: number;
  jobId: string;
  status: "ok" | "error" | "skipped";
  durationMs?: number;
  error?: string;
  summary?: string;
  sessionId?: string;
  sessionKey?: string;
}

// --- Skill Types (Ported from OpenClaw) ---

export type SkillsStatusConfigCheck = {
  path: string;
  satisfied: boolean;
};

export type SkillInstallOption = {
  id: string;
  kind: "brew" | "node" | "go" | "uv";
  label: string;
  bins: string[];
};

export interface SkillStatusEntry {
  name: string;
  description: string;
  source: string;
  filePath: string;
  baseDir: string;
  skillKey: string;
  bundled?: boolean;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  requirements: {
    bins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  missing: {
    bins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  configChecks: SkillsStatusConfigCheck[];
  install: SkillInstallOption[];
}

export interface SkillStatusReport {
  workspaceDir: string;
  managedSkillsDir: string;
  skills: SkillStatusEntry[];
}

// --- Agent Types (Ported from OpenClaw) ---

export interface GatewayAgentRow {
  id: string;
  name?: string;
  skills?: string[];
  model?: string;
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
    avatar?: string;
    avatarUrl?: string;
  };
}

export interface AgentsListResult {
  defaultId: string;
  mainKey: string;
  scope: string;
  agents: GatewayAgentRow[];
}

export interface AgentFileEntry {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
}

export interface AgentsFilesListResult {
  agentId: string;
  workspace: string;
  files: AgentFileEntry[];
}

// --- Usage Types (Ported from OpenClaw) ---

export interface UsageSessionEntry {
  key: string;
  channel?: string;
  agent?: string;
  provider?: string;
  model?: string;
  messages: number;
  tools: number;
  errors: number;
  tokens: number;
  cost: number;
  durationMs: number;
  updatedAt: number;
}

export interface UsageTotals {
  sessions: number;
  messages: number;
  tools: number;
  errors: number;
  tokens: number;
  cost: number;
  tenantUsage?: {
    monthlyUsage: number;
    monthlyLimit: number;
    plan: string;
    efficiency?: number;
    roi?: number;
  };
}

export interface CostDailyEntry {
  date: string;
  cost: number;
  tokens: number;
}

export interface SessionLogEntry {
  timestamp: number;
  role: "user" | "assistant" | "tool" | "toolResult";
  content: string;
  tokens?: number;
  cost?: number;
}

// --- Sessions Types (Ported from OpenClaw) ---

export interface GatewaySessionRow {
  key: string;
  kind: "direct" | "group" | "global" | "unknown";
  label?: string;
  displayName?: string;
  surface?: string;
  subject?: string;
  room?: string;
  space?: string;
  updatedAt: number | null;
  sessionId?: string;
  systemSent?: boolean;
  abortedLastRun?: boolean;
  thinkingLevel?: string;
  verboseLevel?: string;
  reasoningLevel?: string;
  elevatedLevel?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
  modelProvider?: string;
  contextTokens?: number;
}

export interface SessionsListResult {
  ts: number;
  path: string;
  count: number;
  defaults: {
    model: string | null;
    contextTokens: number | null;
  };
  sessions: GatewaySessionRow[];
}

// --- Nodes & Devices Types (Ported from OpenClaw) ---

export interface PairedDevice {
  deviceId: string;
  role: string;
  scopes: string[];
  name?: string;
  pairedAt: number;
  lastSeenAt?: number;
}

export interface PendingDevice {
  requestId: string;
  deviceId: string;
  name: string;
  role: string;
  requestedAt: number;
}

export interface DevicePairingList {
  pending: PendingDevice[];
  paired: PairedDevice[];
}

export interface NodeRegistryEntry {
  nodeId: string;
  name?: string;
  platform?: string;
  version?: string;
  connected: boolean;
  capabilities: string[];
  lastSeenAt: number;
}

// --- Logs Types (Ported from OpenClaw) ---

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LogEntry {
  raw: string;
  time?: string | null;
  level?: LogLevel | null;
  subsystem?: string | null;
  message?: string | null;
  meta?: Record<string, unknown> | null;
}
