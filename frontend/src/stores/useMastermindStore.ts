import { create } from "zustand";

export type MastermindEventType =
  | "reasoning:start"
  | "reasoning:thought"
  | "tool:invoke"
  | "tool:result"
  | "agent:spawn"
  | "reasoning:complete"
  | "reasoning:error";

export interface MastermindEvent {
  type: MastermindEventType;
  agentId: string;
  sessionId?: string;
  parentAgentId?: string;
  content?: string;
  toolName?: string;
  params?: unknown;
  result?: unknown;
  error?: string;
  stage?: "planning" | "researching" | "auditing" | "synthesizing" | "executing";
  timestamp: string;
}

interface MastermindState {
  // Current trace events per agent
  traces: Record<string, MastermindEvent[]>;
  // Current status per agent (for badges)
  agentStatuses: Record<string, { status: string; stage?: string }>;
  // Hierarchical relationships
  agentHierarchy: Record<string, string[]>; // parentId -> childIds[]

  // Actions
  addEvent: (event: MastermindEvent) => void;
  clearTrace: (agentId: string) => void;
  getTrace: (agentId: string) => MastermindEvent[];
  getAgentStatus: (agentId: string) => string;
}

export const useMastermindStore = create<MastermindState>((set, get) => ({
  traces: {},
  agentStatuses: {},
  agentHierarchy: {},

  addEvent: (event) =>
    set((state) => {
      const { agentId, type, parentAgentId } = event;
      const newTraces = { ...state.traces };
      const newStatuses = { ...state.agentStatuses };
      const newHierarchy = { ...state.agentHierarchy };

      // 1. Add to trace
      if (!newTraces[agentId]) newTraces[agentId] = [];
      newTraces[agentId] = [...newTraces[agentId], event];

      // 2. Update status mapping
      let statusText = "";
      switch (type) {
        case "reasoning:start":
          statusText = "Starting...";
          break;
        case "reasoning:thought":
          statusText = event.content || "Thinking...";
          break;
        case "tool:invoke":
          statusText = `Using ${event.toolName}...`;
          break;
        case "agent:spawn":
          statusText = "Spawning sub-agent...";
          break;
        case "reasoning:complete":
          statusText = "Idle";
          break;
        case "reasoning:error":
          statusText = "Error";
          break;
        default:
          statusText = "Processing...";
      }
      newStatuses[agentId] = {
        status: statusText,
        ...(event.stage ? { stage: event.stage } : {}),
      };

      // 3. Update hierarchy if it's a spawn
      if (type === "agent:spawn" && parentAgentId) {
        if (!newHierarchy[parentAgentId]) newHierarchy[parentAgentId] = [];
        if (!newHierarchy[parentAgentId].includes(agentId)) {
          newHierarchy[parentAgentId] = [...newHierarchy[parentAgentId], agentId];
        }
      }

      return {
        traces: newTraces,
        agentStatuses: newStatuses,
        agentHierarchy: newHierarchy,
      };
    }),

  clearTrace: (agentId) =>
    set((state) => {
      const newTraces = { ...state.traces };
      delete newTraces[agentId];
      return { traces: newTraces };
    }),

  getTrace: (agentId) => get().traces[agentId] || [],

  getAgentStatus: (agentId) => get().agentStatuses[agentId]?.status || "Idle",
}));
