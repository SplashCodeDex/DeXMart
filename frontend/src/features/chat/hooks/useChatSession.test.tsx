import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useChatStore } from "../store";
import { useChatSession } from "./useChatSession";

// Mock the gateway rpc
const mockCall = vi.fn();
const mockSubscribe = vi.fn(() => vi.fn());
const mockRpc = {
  call: mockCall,
  subscribe: mockSubscribe,
};

vi.mock("@/lib/gateway/gateway-hooks", () => ({
  useGateway: () => ({
    rpc: mockRpc,
    status: "connected",
  }),
}));

describe("useChatSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.getState().clearMessages();
  });

  it("should load chat history on mount", async () => {
    const historyMessages: ChatMessage[] = [
      { id: "1", role: "user", content: "Past message", timestamp: Date.now() },
    ];
    mockCall.mockResolvedValueOnce({ messages: historyMessages });

    renderHook(() => useChatSession());

    expect(mockCall).toHaveBeenCalledWith(
      "chat.history",
      expect.objectContaining({
        sessionKey: "main",
      }),
    );

    // Wait for async useEffect
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const messages = useChatStore.getState().messages;
    expect(messages).toEqual(historyMessages);
  });

  it("should send a message and handle streaming deltas", async () => {
    mockCall.mockResolvedValue({ runId: "run-1", status: "started" });

    const { result } = renderHook(() => useChatSession());

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(mockCall).toHaveBeenCalledWith(
      "chat.send",
      expect.objectContaining({
        message: "Hello",
      }),
    );

    // Simulate a delta event
    const chatHandler = (mockSubscribe.mock.calls as any).find(
      (call: any) => call[0] === "chat",
    )?.[1];
    expect(chatHandler).toBeDefined();

    act(() => {
      chatHandler?.({
        runId: "run-1",
        sessionKey: "main",
        seq: 1,
        state: "delta",
        message: " Hi",
      });
    });

    const messages = useChatStore.getState().messages;
    expect(messages.some((m) => m.role === "assistant" && m.content === " Hi")).toBe(true);
  });

  it("should handle sendMessage errors", async () => {
    mockCall.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useChatSession());

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    expect(useChatStore.getState().error).toBe("Network error");
    expect(useChatStore.getState().isStreaming).toBe(false);
  });

  it("should handle chat.error event", async () => {
    const { result } = renderHook(() => useChatSession());

    const chatHandler = (mockSubscribe.mock.calls as any).find(
      (call: any) => call[0] === "chat",
    )?.[1];

    act(() => {
      chatHandler?.({
        runId: "run-1",
        sessionKey: "main",
        seq: 1,
        state: "error",
        errorMessage: "Agent crashed",
      });
    });

    expect(useChatStore.getState().error).toBe("Agent crashed");
    expect(useChatStore.getState().isStreaming).toBe(false);
  });

  it("should handle chat.final event", async () => {
    useChatStore.getState().setStreaming(true);
    const { result } = renderHook(() => useChatSession());

    const chatHandler = (mockSubscribe.mock.calls as any).find(
      (call: any) => call[0] === "chat",
    )?.[1];

    act(() => {
      chatHandler?.({
        runId: "run-1",
        sessionKey: "main",
        seq: 1,
        state: "final",
      });
    });

    expect(useChatStore.getState().isStreaming).toBe(false);
  });

  it("should handle abort", async () => {
    const { result } = renderHook(() => useChatSession());

    act(() => {
      result.current.abort();
    });

    expect(mockCall).toHaveBeenCalledWith(
      "chat.abort",
      expect.objectContaining({
        sessionKey: "main",
      }),
    );
  });

  it("should handle /note slash command by calling chat.inject", async () => {
    const { result } = renderHook(() => useChatSession());

    await act(async () => {
      await result.current.sendMessage("/note Remember this");
    });

    expect(mockCall).toHaveBeenCalledWith(
      "chat.inject",
      expect.objectContaining({
        sessionKey: "main",
        message: "Remember this",
        label: "note",
      }),
    );
    // Should NOT call chat.send
    expect(mockCall).not.toHaveBeenCalledWith("chat.send", expect.anything());
  });
});
