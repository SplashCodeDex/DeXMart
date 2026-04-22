import { describe, it, expect, beforeEach } from "vitest";
// We'll import from the yet-to-be-created store
// @ts-ignore
import { useChatStore } from "./store";

describe("ChatStore", () => {
  beforeEach(() => {
    // Reset store before each test
    const store = useChatStore.getState();
    // @ts-ignore
    store.clearMessages();
  });

  it("should start with an empty state", () => {
    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.isStreaming).toBe(false);
    expect(state.error).toBe(null);
  });

  it("should add messages", () => {
    const { addMessage } = useChatStore.getState();
    const msg = {
      id: "1",
      role: "user" as const,
      content: "Hello",
      timestamp: Date.now(),
    };
    addMessage(msg);
    expect(useChatStore.getState().messages).toEqual([msg]);
  });

  it("should handle streaming updates", () => {
    const { addMessage, updateLastAssistantMessage, setStreaming } = useChatStore.getState();

    addMessage({
      id: "1",
      role: "user" as const,
      content: "Hello",
      timestamp: Date.now(),
    });

    setStreaming(true);
    expect(useChatStore.getState().isStreaming).toBe(true);

    const assistantMsg = {
      id: "2",
      role: "assistant" as const,
      content: "",
      timestamp: Date.now(),
    };
    addMessage(assistantMsg);

    updateLastAssistantMessage("H");
    updateLastAssistantMessage("e");
    updateLastAssistantMessage("l");

    const messages = useChatStore.getState().messages;
    expect(messages[1]?.content).toBe("Hel");

    setStreaming(false);
    expect(useChatStore.getState().isStreaming).toBe(false);
  });

  it("should handle errors", () => {
    const { setError } = useChatStore.getState();
    setError("Failed to send");
    expect(useChatStore.getState().error).toBe("Failed to send");

    setError(null);
    expect(useChatStore.getState().error).toBe(null);
  });

  it("should abort and clear controllers", () => {
    const { setAbortController, abort } = useChatStore.getState();
    let aborted = false;
    const controller = new AbortController();
    controller.signal.addEventListener("abort", () => {
      aborted = true;
    });

    setAbortController(controller);
    expect(useChatStore.getState().abortController).toBe(controller);

    abort();
    expect(aborted).toBe(true);
    expect(useChatStore.getState().abortController).toBe(null);
  });
});
