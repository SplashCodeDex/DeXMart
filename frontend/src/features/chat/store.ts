import { create } from "zustand";

export interface ChatAction {
  id: string;
  type: "tool" | "thinking" | "plan" | "approval" | "command_output" | "patch";
  status: "pending" | "running" | "success" | "error" | "requested" | "resolved";
  title: string;
  content?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  thinking?: string;
  runId?: string;
  actions?: ChatAction[];
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  abortController: AbortController | null;

  // Actions
  addMessage: (msg: ChatMessage) => void;
  updateLastAssistantMessage: (delta: string) => void;
  upsertAction: (runId: string, action: ChatAction) => void;
  setStreaming: (isStreaming: boolean) => void;
  setError: (error: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setAbortController: (controller: AbortController | null) => void;
  abort: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  error: null,
  abortController: null,

  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, msg],
    })),

  updateLastAssistantMessage: (delta) =>
    set((state) => {
      const lastMsgIndex = [...state.messages].reverse().findIndex((m) => m.role === "assistant");
      if (lastMsgIndex === -1) return state;

      const actualIndex = state.messages.length - 1 - lastMsgIndex;
      const newMessages = [...state.messages];
      const targetMsg = newMessages[actualIndex];

      if (targetMsg) {
        newMessages[actualIndex] = {
          ...targetMsg,
          content: targetMsg.content + delta,
        };
      }

      return { messages: newMessages };
    }),

  upsertAction: (runId, action) =>
    set((state) => {
      const msgIndex = [...state.messages].reverse().findIndex((m) => m.runId === runId);
      if (msgIndex === -1) {
        const newAssistantMsg: ChatMessage = {
          id: runId,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
          runId,
          actions: [action],
        };
        return { messages: [...state.messages, newAssistantMsg] };
      }

      const actualIndex = state.messages.length - 1 - msgIndex;
      if (actualIndex < 0 || !state.messages[actualIndex]) {
        return state;
      }
      const newMessages = [...state.messages];
      const targetMsg = { ...newMessages[actualIndex]! };
      const actions = [...(targetMsg.actions || [])];

      const actionIndex = actions.findIndex((a) => a.id === action.id);
      if (actionIndex === -1) {
        actions.push(action);
      } else {
        actions[actionIndex] = { ...actions[actionIndex], ...action };
      }

      targetMsg.actions = actions;
      newMessages[actualIndex] = targetMsg;

      return { messages: newMessages };
    }),

  setStreaming: (isStreaming) => set({ isStreaming }),

  setError: (error) => set({ error }),

  setMessages: (messages) => set({ messages }),

  setAbortController: (abortController) => set({ abortController }),

  abort: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({ abortController: null, isStreaming: false });
  },

  clearMessages: () =>
    set({ messages: [], error: null, isStreaming: false, abortController: null }),
}));
