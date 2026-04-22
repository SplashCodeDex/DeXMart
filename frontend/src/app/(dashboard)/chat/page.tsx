"use client";

import { ChatActionRenderer } from "@/features/chat/components/ChatActionRenderer";
import { StreamingText } from "@/features/chat/components/StreamingText";
import { useChatSession } from "@/features/chat/hooks/useChatSession";
import { useChatStore } from "@/features/chat/store";

export default function ChatPage() {
  const { sendMessage, abort, status } = useChatSession();
  const { messages, isStreaming, error } = useChatStore();

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Mastermind Chat</h1>
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${status === "connected" ? "bg-green-500" : "bg-yellow-500"}`}
          />
          <span className="text-sm text-muted-foreground uppercase tracking-wider">{status}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 p-6 space-y-4 border border-border/50 rounded-2xl bg-card/40 backdrop-blur-md shadow-inner">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
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
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
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
        ))}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-muted/30 text-muted-foreground p-3 rounded-2xl border border-border/30 animate-pulse">
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
  );
}

// Helper for class names
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
