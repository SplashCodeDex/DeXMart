import { useCallback, useEffect } from "react";
import { useGateway } from "@/lib/gateway/gateway-hooks";
import { useChatStore, ChatMessage } from "../store";

export function useChatSession(sessionKey: string = "main") {
  const { rpc, status } = useGateway();
  const {
    addMessage,
    updateLastAssistantMessage,
    setStreaming,
    setError,
    abort: storeAbort,
    setAbortController,
  } = useChatStore();

  const sendMessage = useCallback(
    async (text: string) => {
      if (!rpc || !text.trim()) return;

      setError(null);
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      addMessage(userMsg);

      const runId = crypto.randomUUID();
      const controller = new AbortController();
      setAbortController(controller);

      try {
        setStreaming(true);
        await rpc.call("chat.send", {
          sessionKey,
          message: text,
          idempotencyKey: runId,
        });
      } catch (err: any) {
        setError(err.message || "Failed to send message");
        setStreaming(false);
        setAbortController(null);
      }
    },
    [rpc, sessionKey, addMessage, setStreaming, setError, setAbortController],
  );

  const abort = useCallback(() => {
    if (rpc) {
      // Also notify backend
      rpc.call("chat.abort", { sessionKey }).catch(() => {});
    }
    storeAbort();
  }, [rpc, sessionKey, storeAbort]);

  useEffect(() => {
    if (!rpc) return;

    const unsubscribe = rpc.subscribe("chat", (payload) => {
      if (payload.state === "delta") {
        const deltaText =
          typeof payload.message === "string"
            ? payload.message
            : (payload.message as any)?.content?.[0]?.text || "";

        if (deltaText) {
          const state = useChatStore.getState();
          const lastMsg = state.messages[state.messages.length - 1];
          // Simple logic: if last message is an assistant message and matches runId, append.
          // For now, we just append to the last assistant message.
          if (!lastMsg || lastMsg.role !== "assistant") {
            addMessage({
              id: payload.runId,
              role: "assistant",
              content: deltaText,
              timestamp: Date.now(),
              runId: payload.runId,
            });
          } else {
            updateLastAssistantMessage(deltaText);
          }
        }
      } else if (payload.state === "final") {
        setStreaming(false);
        setAbortController(null);
      } else if (payload.state === "error") {
        setError(payload.errorMessage || "Chat error");
        setStreaming(false);
        setAbortController(null);
      } else if (payload.state === "aborted") {
        setStreaming(false);
        setAbortController(null);
      }
    });

    return unsubscribe;
  }, [rpc, addMessage, updateLastAssistantMessage, setStreaming, setError, setAbortController]);

  return { sendMessage, abort, status };
}
