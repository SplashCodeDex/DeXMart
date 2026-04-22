import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  thinking?: string;
  runId?: string;
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  abortController: AbortController | null;

  // Actions
  addMessage: (msg: ChatMessage) => void;
  updateLastAssistantMessage: (delta: string) => void;
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
