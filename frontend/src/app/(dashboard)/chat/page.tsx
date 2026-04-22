"use client";

import { ChatActionRenderer } from "@/features/chat/components/ChatActionRenderer";
import { StreamingText } from "@/features/chat/components/StreamingText";
import { SessionHeader } from "@/features/chat/components/SessionHeader";
import { useChatSession } from "@/features/chat/hooks/useChatSession";
import { useChatStore, ChatMessage } from "@/features/chat/store";
import { VirtualLogList } from "@/components/shared/VirtualLogList";
import { useEffect, useRef, useState } from "react";

export default function ChatPage() {
  const [currentSessionKey, setCurrentSessionKey] = useState("main");
  const { sendMessage, abort, status } = useChatSession(currentSessionKey);
  const { messages, isStreaming, error, clearMessages } = useChatStore();
  const listContainerRef = useRef<HTMLDivElement>(null);

  const handleSessionChange = (key: string) => {
    setCurrentSessionKey(key);
    clearMessages();
  };

  // Auto-scroll to bottom on new messages or streaming deltas
  useEffect(() => {
    if (listContainerRef.current) {
      const scrollElement = listContainerRef.current.querySelector("div[style*='overflow: auto']");
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isStreaming]);

  const renderMessage = (msg: ChatMessage) => (
    <div
      key={msg.id}
      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} p-2`}
    >
      <div
        className={cn(
          "max-w-[80%] p-4 rounded-2xl shadow-sm",
          msg.role === "user"
            ? "bg-primary text-primary-foreground rounded-tr-none"
            : "bg-muted/50 text-foreground border border-border/50 rounded-tl-none",
        )}
      >
        {msg.actions && msg.actions.length > 0 && (
          <div className="mb-3 space-y-2">
            {msg.actions.map((action) => (
              <ChatActionRenderer key={action.id} action={action} />
            ))}
          </div>
        )}
        {msg.content && (
          <div className="message-content">
            {msg.role === "user" ? (
              <div className="whitespace-pre-wrap">{msg.content}</div>
            ) : (
              <StreamingText content={msg.content} />
            )}
          </div>
        )}
        {msg.thinking && !msg.actions?.some((a) => a.type === "thinking") && (
          <div className="mt-2 p-2 rounded bg-background/20 text-xs italic opacity-80 border-l-2 border-primary/30">
            {msg.thinking}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <SessionHeader 
        currentSessionKey={currentSessionKey} 
        onSessionChange={handleSessionChange} 
      />

      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <div ref={listContainerRef} className="flex-1 mb-4 overflow-hidden flex flex-col">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 border border-border/50 rounded-2xl bg-card/40 backdrop-blur-md shadow-inner">
              <div className="p-4 rounded-full bg-primary/10">
                <span className="text-4xl text-primary">💬</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">No messages yet</h2>
                <p className="text-muted-foreground max-w-xs">
                  Start a conversation with Mastermind to see it in action.
                </p>
              </div>
            </div>
          ) : (
            <VirtualLogList
              items={messages}
              renderItem={renderMessage}
              height="100%"
              estimateSize={100}
              className="border-border/50 rounded-2xl bg-card/40 backdrop-blur-md shadow-inner"
            />
          )}
          {isStreaming && messages.length > 0 && (
            <div className="flex justify-start mt-2">
              <div className="bg-muted/30 text-muted-foreground p-2 px-4 rounded-full border border-border/30 text-xs animate-pulse">
                Agent is thinking...
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-sm">
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const input = form.elements.namedItem("message") as HTMLInputElement;
            if (input.value.trim()) {
              sendMessage(input.value);
              input.value = "";
            }
          }}
          className="flex gap-3 bg-background/40 p-2 rounded-2xl border border-border/50 backdrop-blur-sm shadow-lg"
        >
          <input
            name="message"
            type="text"
            placeholder="Ask Mastermind anything..."
            disabled={status !== "connected" || isStreaming}
            autoComplete="off"
            className="flex-1 p-3 bg-transparent border-none focus:ring-0 text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={status !== "connected" || isStreaming}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-xl font-medium shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
          >
            Send
          </button>
          {isStreaming && (
            <button
              type="button"
              onClick={abort}
              className="px-4 py-2 bg-destructive/20 text-destructive border border-destructive/30 rounded-xl font-medium hover:bg-destructive/30 transition-all"
            >
              Abort
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// Helper for class names
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
