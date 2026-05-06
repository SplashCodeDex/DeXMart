"use client";

import { create } from "zustand";
import { circuitBreaker } from "@/lib/api/apiCircuitBreaker";
import { api } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type {
  Channel,
  ActivityEvent,
  BotProgressUpdate,
  CronJob,
  CronStatus,
  CronRunLogEntry,
  SkillStatusReport,
  AgentsListResult,
  AgentIdentityResult,
  UsageSessionEntry,
  UsageTotals,
  CostDailyEntry,
  SessionsListResult,
  NodeRegistryEntry,
  DevicePairingList,
  PlatformMetadata,
  LogEntry,
} from "@/types";

interface NestedAgentTrace {
  id: string;
  label: string;
  parent?: string;
  status: "thinking" | "complete" | "error";
  task?: string;
  timestamp: string;
}

interface OmnichannelState {
  // Data
  channels: Channel[];
  activity: ActivityEvent[];
  cronJobs: CronJob[];
  cronStatus: CronStatus | null;
  cronRuns: Record<string, CronRunLogEntry[]>;
  skillReport: SkillStatusReport | null;
  skills: unknown[]; // Unified Skill/Tool list
  agentsResult: AgentsListResult | null;
  agentIdentities: Record<string, AgentIdentityResult>;
  usageTotals: UsageTotals | null;
  usageDaily: CostDailyEntry[];
  usageSessions: UsageSessionEntry[];
  sessionsList: SessionsListResult | null;
  nodes: NodeRegistryEntry[];
  devices: DevicePairingList | null;
  logs: LogEntry[];
  gatewayHealth: unknown;
  nestedTrace: NestedAgentTrace[]; // Phase 2: Visual Trace
  platforms: PlatformMetadata[];
  isLoadingPlatforms: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchPlatforms: () => Promise<void>;
  fetchChannels: (agentId?: string) => Promise<void>;
  fetchAllChannels: () => Promise<void>;
  updateChannelStatus: (botId: string, status: Channel["status"]) => void;
  addActivityEvent: (event: Omit<ActivityEvent, "id">) => void;
  handleProgressUpdate: (update: BotProgressUpdate) => void;

  // Sub-agent Trace Actions
  addTraceNode: (trace: Omit<NestedAgentTrace, "timestamp">) => void;
  clearTrace: () => void;

  // Cron Actions
  fetchCronJobs: () => Promise<void>;
  fetchCronStatus: () => Promise<void>;
  fetchCronRuns: (jobId: string) => Promise<void>;
  createCronJob: (job: Partial<CronJob>) => Promise<boolean>;
  toggleCronJob: (id: string, enabled: boolean) => Promise<boolean>;
  runCronJob: (id: string) => Promise<boolean>;
  removeCronJob: (id: string) => Promise<boolean>;

  // Skill Actions
  fetchSkillReport: () => Promise<void>;
  fetchSkills: () => Promise<void>;
  toggleSkill: (key: string, enabled: boolean) => Promise<boolean>;
  saveSkillKey: (key: string, apiKey: string) => Promise<boolean>;
  installSkill: (key: string, installId: string) => Promise<boolean>;

  // Agent Actions
  fetchAgents: () => Promise<void>;
  fetchAgentIdentity: (id: string) => Promise<void>;
  createAgent: (agent: {
    name: string;
    iconName: string;
    systemPrompt: string;
    model: string;
  }) => Promise<{ success: boolean; data?: string; error?: string }>;
  updateAgent: (
    id: string,
    updates: {
      name?: string;
      iconName?: string;
      systemPrompt?: string;
      model?: string;
    },
  ) => Promise<boolean>;

  // Channel Lifecycle Actions
  disconnectChannel: (agentId: string, channelId: string) => Promise<boolean>;
  logoutChannel: (channelId: string) => void;
  deleteAgent: (agentId: string, deleteFiles?: boolean) => Promise<boolean>;
  deleteChannel: (agentId: string, channelId: string, archive?: boolean) => Promise<boolean>;
  moveChannel: (
    channelId: string,
    currentAgentId: string,
    targetAgentId: string,
  ) => Promise<boolean>;

  // Usage & Session Actions
  fetchUsageTotals: () => Promise<void>;
  fetchUsageDaily: () => Promise<void>;
  fetchUsageSessions: () => Promise<void>;
  fetchSessions: () => Promise<void>;

  // Nodes & Logs Actions
  fetchNodes: () => Promise<void>;
  fetchDevices: () => Promise<void>;
  fetchLogs: () => Promise<void>;
  streamLogs: () => () => void;
  approveDevice: (id: string) => Promise<boolean>;
  rejectDevice: (id: string) => Promise<boolean>;
  revokeDevice: (id: string) => Promise<boolean>;

  // Gateway Actions
  fetchGatewayHealth: () => Promise<void>;
  getSkillCount: () => number;
  addLogEntry: (entry: LogEntry) => void;
}

const MAX_ACTIVITY_LOGS = 100;
const MAX_SYSTEM_LOGS = 500;

/**
 * Omnichannel Store
 *
 * Manages the state for all communication channels (WhatsApp, Telegram, etc.)
 * and the real-time activity feed.
 */
export const useOmnichannelStore = create<OmnichannelState>((set, get) => ({
  channels: [],
  activity: [],
  cronJobs: [],
  cronStatus: null,
  cronRuns: {},
  skillReport: null,
  skills: [],
  agentsResult: null,
  agentIdentities: {},
  usageTotals: null,
  usageDaily: [],
  usageSessions: [],
  sessionsList: null,
  nodes: [],
  devices: null,
  logs: [],
  gatewayHealth: null,
  nestedTrace: [],
  platforms: [],
  isLoadingPlatforms: false,
  isLoading: false,
  error: null,

  fetchPlatforms: async () => {
    set({ isLoadingPlatforms: true });
    try {
      const response = await api.get<PlatformMetadata[]>(API_ENDPOINTS.OMNICHANNEL.PLATFORMS);
      if (response.success) {
        set({ platforms: response.data || [], isLoadingPlatforms: false });
      } else {
        set({ isLoadingPlatforms: false });
      }
    } catch (err) {
      console.error("Failed to fetch platforms:", err);
      set({ isLoadingPlatforms: false });
    }
  },

  fetchChannels: async (agentId: string = "system_default") => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<Record<string, unknown>[]>(
        API_ENDPOINTS.OMNICHANNEL.AGENTS.CHANNELS.LIST(agentId),
      );

      if (response.success) {
        // Map the backend BotListItem shape to the frontend Channel shape
        const data = response.data || [];
        const mappedChannels: Channel[] = data.map((bot) => ({
          id: bot["id"] as string,
          name: bot["name"] as string,
          type: (bot["type"] as string) || "whatsapp",
          status: bot["status"] as Channel["status"],
          account:
            (bot["phoneNumber"] as string | null) || (bot["account"] as string | null) || null,
          lastActiveAt: bot["lastActiveAt"] as string | undefined,
          assignedAgentId: bot["assignedAgentId"] as string | undefined,
        }));
        set({ channels: mappedChannels, isLoading: false });
      } else {
        set({ error: response.error.message || "Failed to fetch channels", isLoading: false });
      }
    } catch {
      set({
        error: "Failed to connect to the server",
        isLoading: false,
      });
    }
  },

  fetchAllChannels: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<Record<string, unknown>[]>(
        API_ENDPOINTS.OMNICHANNEL.CHANNELS.ALL,
      );

      if (response.success) {
        const data = response.data || [];
        const mappedChannels: Channel[] = data.map((bot) => ({
          id: bot["id"] as string,
          name: bot["name"] as string,
          type: (bot["type"] as string) || "whatsapp",
          status: bot["status"] as Channel["status"],
          account:
            (bot["account"] as string | null) || (bot["phoneNumber"] as string | null) || null,
          lastActiveAt: bot["lastActiveAt"] as string | undefined,
          assignedAgentId: bot["assignedAgentId"] as string | undefined,
        }));
        set({ channels: mappedChannels, isLoading: false });
      } else {
        set({ error: response.error.message || "Failed to fetch all channels", isLoading: false });
      }
    } catch {
      set({
        error: "Failed to connect to the server",
        isLoading: false,
      });
    }
  },

  updateChannelStatus: (botId, status) => {
    set((state) => ({
      channels: state.channels.map((c) => (c.id === botId ? { ...c, status } : c)),
    }));
  },

  addActivityEvent: (event) => {
    const newEvent: ActivityEvent = {
      ...event,
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    set((state) => ({
      activity: [newEvent, ...state.activity].slice(0, MAX_ACTIVITY_LOGS),
    }));
  },

  handleProgressUpdate: (update) => {
    const { botId, step, status: progressStatus } = update;

    // Map progress status to channel status
    let channelStatus: Channel["status"] = "connecting";

    if (progressStatus === "complete") channelStatus = "connected";
    else if (progressStatus === "error") channelStatus = "error";

    set((state) => ({
      channels: state.channels.map((c) =>
        c.id === botId
          ? {
              ...c,
              status: channelStatus,
              lastProgress: { step, status: progressStatus },
            }
          : c,
      ),
    }));

    // Also log progress as a system activity event
    get().addActivityEvent({
      botId,
      channel: "system",
      type: "system",
      message: `${step}: ${progressStatus}`,
      timestamp: new Date().toISOString(),
    });
  },

  addTraceNode: (trace) => {
    set((state) => ({
      nestedTrace: [...state.nestedTrace, { ...trace, timestamp: new Date().toISOString() }],
    }));
  },

  clearTrace: () => {
    set({ nestedTrace: [] });
  },

  // --- Cron Actions ---

  fetchCronJobs: async () => {
    try {
      const response = await api.get<CronJob[]>(API_ENDPOINTS.OMNICHANNEL.CRON.LIST);
      if (response.success) {
        set({ cronJobs: response.data });
      }
    } catch (err) {
      console.error("Failed to fetch cron jobs:", err);
    }
  },

  fetchCronStatus: async () => {
    try {
      const response = await api.get<CronStatus>(API_ENDPOINTS.OMNICHANNEL.CRON.STATUS);
      if (response.success) {
        set({ cronStatus: response.data });
      }
    } catch (err) {
      console.error("Failed to fetch cron status:", err);
    }
  },

  fetchCronRuns: async (jobId) => {
    try {
      const response = await api.get<CronRunLogEntry[]>(API_ENDPOINTS.OMNICHANNEL.CRON.RUNS(jobId));
      if (response.success) {
        set((state) => ({
          cronRuns: { ...state.cronRuns, [jobId]: response.data },
        }));
      }
    } catch (err) {
      console.error(`Failed to fetch runs for job ${jobId}:`, err);
    }
  },

  createCronJob: async (job) => {
    try {
      const response = await api.post(API_ENDPOINTS.OMNICHANNEL.CRON.CREATE, job);
      if (response.success) {
        await get().fetchCronJobs();
        await get().fetchCronStatus();
        return true;
      }
    } catch (err) {
      console.error("Failed to create cron job:", err);
    }
    return false;
  },

  toggleCronJob: async (id, enabled) => {
    try {
      const response = await api.post(API_ENDPOINTS.OMNICHANNEL.CRON.TOGGLE(id), { enabled });
      if (response.success) {
        await get().fetchCronJobs();
        return true;
      }
    } catch (err) {
      console.error(`Failed to toggle cron job ${id}:`, err);
    }
    return false;
  },

  runCronJob: async (id) => {
    try {
      const response = await api.post(API_ENDPOINTS.OMNICHANNEL.CRON.RUN(id), {});
      return response.success;
    } catch (err) {
      console.error(`Failed to run cron job ${id}:`, err);
    }
    return false;
  },

  removeCronJob: async (id) => {
    try {
      const response = await api.delete(API_ENDPOINTS.OMNICHANNEL.CRON.DELETE(id));
      if (response.success) {
        await get().fetchCronJobs();
        await get().fetchCronStatus();
        return true;
      }
    } catch (err) {
      console.error(`Failed to remove cron job ${id}:`, err);
    }
    return false;
  },

  // --- Skill Actions ---

  fetchSkillReport: async () => {
    if (circuitBreaker.isOpen("omnichannel")) {
      return;
    }
    try {
      const response = await api.get<SkillStatusReport>(API_ENDPOINTS.OMNICHANNEL.SKILLS.REPORT);
      if (response.success) {
        set({ skillReport: response.data });
        circuitBreaker.recordSuccess("omnichannel");
      } else {
        circuitBreaker.recordFailure("omnichannel");
      }
    } catch (err) {
      console.error("Failed to fetch skill report:", err);
      circuitBreaker.recordFailure("omnichannel");
    }
  },

  fetchSkills: async () => {
    if (circuitBreaker.isOpen("omnichannel")) return;
    try {
      const response = await api.get<unknown[]>(API_ENDPOINTS.OMNICHANNEL.SKILLS.LIST);
      if (response.success) {
        set({ skills: response.data });
        circuitBreaker.recordSuccess("omnichannel");
      } else {
        circuitBreaker.recordFailure("omnichannel");
      }
    } catch (err) {
      console.error("Failed to fetch skills:", err);
      circuitBreaker.recordFailure("omnichannel");
    }
  },

  toggleSkill: async (key, enabled) => {
    try {
      const response = await api.patch(API_ENDPOINTS.OMNICHANNEL.SKILLS.TOGGLE(key), { enabled });
      if (response.success) {
        await get().fetchSkillReport();
        await get().fetchSkills();
        return true;
      }
    } catch (err) {
      console.error(`Failed to toggle skill ${key}:`, err);
    }
    return false;
  },

  saveSkillKey: async (key, apiKey) => {
    try {
      const response = await api.post(API_ENDPOINTS.OMNICHANNEL.SKILLS.SAVE_KEY(key), { apiKey });
      return response.success;
    } catch (err) {
      console.error(`Failed to save key for skill ${key}:`, err);
    }
    return false;
  },

  installSkill: async (key, installId) => {
    try {
      const response = await api.post(API_ENDPOINTS.OMNICHANNEL.SKILLS.INSTALL(key), { installId });
      if (response.success) {
        await get().fetchSkillReport();
        await get().fetchSkills();
        return true;
      }
    } catch (err) {
      console.error(`Failed to install skill ${key}:`, err);
    }
    return false;
  },

  // --- Agent Actions ---

  fetchAgents: async () => {
    if (circuitBreaker.isOpen("omnichannel")) return;
    try {
      const response = await api.get<AgentsListResult>(API_ENDPOINTS.OMNICHANNEL.AGENTS.LIST);
      if (response.success) {
        set({ agentsResult: response.data });
        circuitBreaker.recordSuccess("omnichannel");
      } else {
        circuitBreaker.recordFailure("omnichannel");
      }
    } catch (err) {
      console.error("Failed to fetch agents:", err);
      circuitBreaker.recordFailure("omnichannel");
    }
  },

  fetchAgentIdentity: async (id) => {
    try {
      const response = await api.get<AgentIdentityResult>(
        API_ENDPOINTS.OMNICHANNEL.AGENTS.IDENTITY(id),
      );
      if (response.success) {
        set((state) => ({
          agentIdentities: { ...state.agentIdentities, [id]: response.data },
        }));
      }
    } catch (err) {
      console.error(`Failed to fetch identity for agent ${id}:`, err);
    }
  },

  createAgent: async (agent) => {
    try {
      const response = await api.post<Record<string, unknown>>(
        API_ENDPOINTS.OMNICHANNEL.AGENTS.CREATE,
        agent,
      );
      if (response.success) {
        await get().fetchAgents();
        return {
          success: true,
          data: response.data?.agentId as string,
        };
      }
      return {
        success: false,
        error: response.error.message,
      };
    } catch (err) {
      console.error("Failed to create agent:", err);
      return {
        success: false,
        error: "Connection error",
      };
    }
  },

  updateAgent: async (id, updates) => {
    try {
      const response = await api.patch(API_ENDPOINTS.OMNICHANNEL.AGENTS.UPDATE(id), updates);
      if (response.success) {
        await get().fetchAgents();
        await get().fetchAgentIdentity(id);
        return true;
      }
    } catch (err) {
      console.error(`Failed to update agent ${id}:`, err);
    }
    return false;
  },

  deleteAgent: async (agentId, deleteFiles = true) => {
    try {
      // DeXMart 2026 Rule: Prefer Gateway RPC for parity features
      // The backend API routes these internal/omnichannel requests to the Gateway.
      const response = await api.delete(
        `${API_ENDPOINTS.OMNICHANNEL.AGENTS.DELETE(agentId)}?deleteFiles=${deleteFiles}`,
      );

      if (response.success) {
        await get().fetchAgents();
        return true;
      }
    } catch (err) {
      console.error(`Failed to delete agent ${agentId}:`, err);
    }
    return false;
  },

  disconnectChannel: async (agentId, channelId) => {
    // Optimistic update: immediately update channel status to disconnected
    get().updateChannelStatus(channelId, "disconnected");

    try {
      const response = await api.post(
        API_ENDPOINTS.OMNICHANNEL.AGENTS.CHANNELS.DISCONNECT(agentId, channelId),
        {},
      );
      if (response.success) {
        await get().fetchAllChannels();
        return true;
      } else {
        // Rollback on failure - refetch channels to get actual status
        await get().fetchAllChannels();
        return false;
      }
    } catch (err) {
      console.error("Failed to disconnect channel:", err);
      // Rollback on error - refetch channels to get actual status
      await get().fetchAllChannels();
      return false;
    }
  },

  logoutChannel: (channelId) => {
    get().updateChannelStatus(channelId, "logged_out");
  },

  deleteChannel: async (agentId, channelId, archive = false) => {
    try {
      const response = await api.delete(
        `${API_ENDPOINTS.OMNICHANNEL.AGENTS.CHANNELS.DELETE(agentId, channelId)}?archive=${archive}`,
      );
      if (response.success) {
        await get().fetchAllChannels();
        return true;
      }
    } catch (err) {
      console.error("Failed to delete channel:", err);
    }
    return false;
  },

  moveChannel: async (channelId, currentAgentId, targetAgentId) => {
    try {
      const response = await api.post(
        API_ENDPOINTS.OMNICHANNEL.AGENTS.CHANNELS.MOVE(currentAgentId, channelId),
        { targetAgentId },
      );
      if (response.success) {
        await get().fetchAllChannels();
        return true;
      }
    } catch (err) {
      console.error("Failed to move channel:", err);
    }
    return false;
  },

  // --- Usage & Session Actions ---

  fetchUsageTotals: async () => {
    try {
      const response = await api.get<UsageTotals>(API_ENDPOINTS.OMNICHANNEL.USAGE.TOTALS);
      if (response.success) {
        set({ usageTotals: response.data });
      }
    } catch (err) {
      console.error("Failed to fetch usage totals:", err);
    }
  },

  fetchUsageDaily: async () => {
    try {
      const response = await api.get<{ daily: CostDailyEntry[] }>(
        API_ENDPOINTS.OMNICHANNEL.USAGE.DAILY,
      );
      if (response.success) {
        set({ usageDaily: response.data.daily || [] });
      }
    } catch (err) {
      console.error("Failed to fetch daily usage:", err);
    }
  },

  fetchUsageSessions: async () => {
    try {
      const response = await api.get<{ sessions: UsageSessionEntry[] }>(
        API_ENDPOINTS.OMNICHANNEL.USAGE.SESSIONS,
      );
      if (response.success) {
        set({ usageSessions: response.data.sessions || [] });
      }
    } catch (err) {
      console.error("Failed to fetch usage sessions:", err);
    }
  },

  fetchSessions: async () => {
    try {
      const response = await api.get<SessionsListResult>(API_ENDPOINTS.OMNICHANNEL.SESSIONS.LIST);
      if (response.success) {
        set({ sessionsList: response.data });
      }
    } catch (err) {
      console.error("Failed to fetch sessions list:", err);
    }
  },

  // --- Nodes & Logs Actions ---

  fetchNodes: async () => {
    try {
      const response = await api.get<NodeRegistryEntry[]>(API_ENDPOINTS.OMNICHANNEL.NODES.LIST);
      if (response.success) {
        set({ nodes: response.data });
      }
    } catch (err) {
      console.error("Failed to fetch nodes:", err);
    }
  },

  fetchDevices: async () => {
    try {
      const response = await api.get<DevicePairingList>(API_ENDPOINTS.OMNICHANNEL.NODES.DEVICES);
      if (response.success) {
        set({ devices: response.data });
      }
    } catch (err) {
      console.error("Failed to fetch devices:", err);
    }
  },

  fetchLogs: async () => {
    try {
      const response = await api.get<{ lines: LogEntry[] }>(API_ENDPOINTS.OMNICHANNEL.LOGS.LIST);
      if (response.success && response.data) {
        set({ logs: response.data.lines || [] });
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  },

  streamLogs: () => {
    if (typeof window === "undefined") return () => {};

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
    const baseUrl = backendUrl.endsWith("/") ? backendUrl.slice(0, -1) : backendUrl;
    const url = `${baseUrl}${API_ENDPOINTS.OMNICHANNEL.LOGS.STREAM}`;

    const eventSource = new EventSource(url, { withCredentials: true });

    eventSource.onmessage = (event) => {
      try {
        const entry = JSON.parse(event.data);
        get().addLogEntry(entry);
      } catch (err) {
        console.error("Failed to parse log entry:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("Log stream error:", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  },

  addLogEntry: (entry) => {
    set((state) => ({
      logs: [entry, ...state.logs].slice(0, MAX_SYSTEM_LOGS),
    }));
  },

  approveDevice: async (id) => {
    try {
      const response = await api.post(API_ENDPOINTS.OMNICHANNEL.NODES.APPROVE(id), {});
      if (response.success) {
        await get().fetchDevices();
        return true;
      }
    } catch (err) {
      console.error(`Failed to approve device ${id}:`, err);
    }
    return false;
  },

  rejectDevice: async (id) => {
    try {
      const response = await api.post(API_ENDPOINTS.OMNICHANNEL.NODES.REJECT(id), {});
      if (response.success) {
        await get().fetchDevices();
        return true;
      }
    } catch (err) {
      console.error(`Failed to reject device ${id}:`, err);
    }
    return false;
  },

  revokeDevice: async (id) => {
    try {
      const response = await api.post(API_ENDPOINTS.OMNICHANNEL.NODES.REVOKE(id), {});
      if (response.success) {
        await get().fetchDevices();
        return true;
      }
    } catch (err) {
      console.error(`Failed to revoke device ${id}:`, err);
    }
    return false;
  },

  // --- Gateway Actions ---

  fetchGatewayHealth: async () => {
    if (circuitBreaker.isOpen("omnichannel")) return;
    try {
      const response = await api.get<unknown>(API_ENDPOINTS.OMNICHANNEL.GATEWAY.HEALTH);
      if (response.success) {
        set({ gatewayHealth: response.data });
        circuitBreaker.recordSuccess("omnichannel");
      } else {
        circuitBreaker.recordFailure("omnichannel");
      }
    } catch (err) {
      console.error("Failed to fetch gateway health:", err);
      circuitBreaker.recordFailure("omnichannel");
    }
  },
  getSkillCount: () => {
    const { skillReport, skills } = get();
    // Fallback to 51 if not loaded, but try to use real data
    if (skillReport?.skills) return skillReport.skills.length;
    if (skills?.length) return skills.length;
    return 51; // Design default if nothing loaded
  },
}));
