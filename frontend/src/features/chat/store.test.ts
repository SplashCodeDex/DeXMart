import { describe, it, expect, beforeEach } from "vitest";
// We'll import from the yet-to-be-created store
import { useChatStore } from "./store";

describe("ChatStore", () => {
  beforeEach(() => {
    // Reset store before each test
    const store = useChatStore.getState();
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

  it("should upsert actions into messages", () => {
    const { upsertAction } = useChatStore.getState();
    const runId = "run-123";
    const action = {
      id: "tool-1",
      type: "tool" as const,
      status: "running" as const,
      title: "Searching",
      timestamp: Date.now(),
    };

    // Case 1: Message doesn't exist, should create a new assistant message
    upsertAction(runId, action);
    let messages = useChatStore.getState().messages;
    expect(messages.length).toBe(1);
    expect(messages[0]?.runId).toBe(runId);
    expect(messages[0]?.actions).toEqual([action]);

    // Case 2: Message exists, should add a new action
    const action2 = {
      id: "tool-2",
      type: "tool" as const,
      status: "pending" as const,
      title: "Reading",
      timestamp: Date.now(),
    };
    upsertAction(runId, action2);
    messages = useChatStore.getState().messages;
    expect(messages[0]?.actions?.length).toBe(2);
    expect(messages[0]?.actions?.[1]).toEqual(action2);

    // Case 3: Action exists, should update it
    const actionUpdate = {
      id: "tool-1",
      type: "tool" as const,
      status: "success" as const,
      title: "Found results",
      timestamp: Date.now(),
    };
    upsertAction(runId, actionUpdate);
    messages = useChatStore.getState().messages;
    expect(messages[0]?.actions?.length).toBe(2);
    expect(messages[0]?.actions?.[0]?.status).toBe("success");
    expect(messages[0]?.actions?.[0]?.title).toBe("Found results");
  });
});
