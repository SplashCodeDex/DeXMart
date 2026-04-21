/**
 * gateway-client.frames.test.ts
 *
 * Red-phase tests for GatewayClient frame handling.
 * Covers: request→response, event subscribe, timeout, error propagation.
 *
 * Task 1.B.A.2 — Dashboard ControlUI Parity track, Phase 1.B
 * These tests MUST FAIL before gateway-client.ts exists (TDD Red phase).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Reuse the same MockWebSocket from connection tests ---
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN; // default to OPEN for frame tests
  url: string;
  sentMessages: string[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: { code: number; reason: string; wasClean: boolean }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: code ?? 1000, reason: reason ?? "", wasClean: true });
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateClose(code = 1006, reason = "") {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason, wasClean: false });
  }

  static instances: MockWebSocket[] = [];
  static reset() {
    MockWebSocket.instances = [];
  }
  static latest(): MockWebSocket {
    const inst = MockWebSocket.instances.at(-1);
    if (!inst) {
      throw new Error("No MockWebSocket instance created");
    }
    return inst;
  }
}

vi.stubGlobal("WebSocket", MockWebSocket);

const HELLO_OK = {
  type: "hello-ok",
  protocol: 1,
  server: { version: "2026.4.15", connId: "conn-id" },
  features: { methods: ["chat.send", "sessions.list"], events: ["session.update", "tick"] },
  snapshot: {},
  policy: { maxPayload: 65536, maxBufferedBytes: 1048576, tickIntervalMs: 30000 },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GatewayClient: any;

/** Boot a connected GatewayClient and return it with its underlying mock WS */
async function makeConnectedClient(overrides?: Record<string, unknown>) {
  const mod = await import("./gateway-client");
  GatewayClient = mod.GatewayClient;
  const client = new GatewayClient({
    url: "ws://localhost:18789",
    getToken: async () => "test-token",
    reconnect: { baseDelayMs: 100, maxDelayMs: 3200, jitter: false },
    ...overrides,
  });
  const connectPromise = client.connect();
  const ws = MockWebSocket.latest();
  ws.simulateOpen();
  await vi.advanceTimersByTimeAsync(0);
  ws.simulateMessage(HELLO_OK);
  await connectPromise;
  return { client, ws };
}

beforeEach(() => {
  vi.useFakeTimers();
  MockWebSocket.reset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
describe("GatewayClient — request→response (req/res frames)", () => {
  it("sends a req frame with a unique id, method, and params", async () => {
    const { client, ws } = await makeConnectedClient();
    // Fire and don't await — we'll drive the response manually
    const callPromise = client.call("chat.send", { text: "hello" });

    // Find the sent req frame (second message; first was ConnectParams)
    const reqMsg = ws.sentMessages.find((m: string) => {
      const p = JSON.parse(m) as { type?: unknown; method?: unknown };
      return p.type === "req" && p.method === "chat.send";
    });
    expect(reqMsg).toBeDefined();
    const req = JSON.parse(reqMsg!) as {
      id: string;
      type: string;
      method: string;
      params: unknown;
    };
    expect(req.type).toBe("req");
    expect(req.method).toBe("chat.send");
    expect(req.params).toEqual({ text: "hello" });
    expect(typeof req.id).toBe("string");
    expect(req.id.length).toBeGreaterThan(0);

    // Resolve the call
    ws.simulateMessage({ type: "res", id: req.id, ok: true, payload: { messageId: "123" } });
    await expect(callPromise).resolves.toEqual({ messageId: "123" });
  });

  it("resolves with payload on ok=true response", async () => {
    const { client, ws } = await makeConnectedClient();
    const callPromise = client.call("sessions.list", {});
    const reqId = JSON.parse(ws.sentMessages.at(-1)!).id as string;
    ws.simulateMessage({ type: "res", id: reqId, ok: true, payload: { sessions: [] } });
    await expect(callPromise).resolves.toEqual({ sessions: [] });
  });

  it("rejects with an error object on ok=false response", async () => {
    const { client, ws } = await makeConnectedClient();
    const callPromise = client.call("chat.send", { text: "hi" });
    const reqId = JSON.parse(ws.sentMessages.at(-1)!).id as string;
    ws.simulateMessage({
      type: "res",
      id: reqId,
      ok: false,
      error: { code: "NOT_FOUND", message: "Session not found", retryable: false },
    });
    await expect(callPromise).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("generates unique request IDs for concurrent calls", async () => {
    const { client, ws } = await makeConnectedClient();
    const p1 = client.call("chat.send", { text: "a" });
    const p2 = client.call("sessions.list", {});
    const frames = ws.sentMessages
      .map((m: string) => JSON.parse(m) as { type?: unknown; id?: string })
      .filter((f) => f.type === "req");
    expect(frames).toHaveLength(2);
    expect(frames[0]!.id).not.toBe(frames[1]!.id);
    // Resolve both
    ws.simulateMessage({ type: "res", id: frames[0]!.id, ok: true, payload: {} });
    ws.simulateMessage({ type: "res", id: frames[1]!.id, ok: true, payload: {} });
    await Promise.all([p1, p2]);
  });
});

// ---------------------------------------------------------------------------
describe("GatewayClient — event subscribe", () => {
  it("calls the registered handler when a matching event frame arrives", async () => {
    const { client, ws } = await makeConnectedClient();
    const handler = vi.fn();
    client.subscribe("session.update", handler);
    ws.simulateMessage({ type: "event", event: "session.update", payload: { sessionId: "abc" } });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      { sessionId: "abc" },
      expect.objectContaining({ seq: undefined, stateVersion: undefined }),
    );
  });

  it("supports multiple handlers for the same event", async () => {
    const { client, ws } = await makeConnectedClient();
    const h1 = vi.fn();
    const h2 = vi.fn();
    client.subscribe("session.update", h1);
    client.subscribe("session.update", h2);
    ws.simulateMessage({ type: "event", event: "session.update", payload: { sessionId: "x" } });
    expect(h1).toHaveBeenCalledWith({ sessionId: "x" }, expect.any(Object));
    expect(h2).toHaveBeenCalledWith({ sessionId: "x" }, expect.any(Object));
  });

  it("does not call handler for a different event", async () => {
    const { client, ws } = await makeConnectedClient();
    const handler = vi.fn();
    client.subscribe("session.update", handler);
    ws.simulateMessage({ type: "event", event: "tick", payload: { ts: 1 } });
    expect(handler).not.toHaveBeenCalled();
  });

  it("unsubscribe() stops the handler from receiving events", async () => {
    const { client, ws } = await makeConnectedClient();
    const handler = vi.fn();
    const unsub = client.subscribe("session.update", handler);
    unsub();
    ws.simulateMessage({ type: "event", event: "session.update", payload: {} });
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes seq and stateVersion fields to the handler", async () => {
    const { client, ws } = await makeConnectedClient();
    const handler = vi.fn();
    client.subscribe("session.update", handler);
    ws.simulateMessage({
      type: "event",
      event: "session.update",
      payload: { sessionId: "y" },
      seq: 42,
      stateVersion: "v2",
    });
    expect(handler).toHaveBeenCalledWith(
      { sessionId: "y" },
      expect.objectContaining({ seq: 42, stateVersion: "v2" }),
    );
  });
});

// ---------------------------------------------------------------------------
describe("GatewayClient — request timeout", () => {
  it("rejects a pending call with a TIMEOUT error after timeoutMs elapses", async () => {
    const { client, ws } = await makeConnectedClient({ requestTimeoutMs: 5000 });
    const callPromise = client.call("chat.send", { text: "slow" });
    const expectPromise = expect(callPromise).rejects.toMatchObject({ code: "TIMEOUT" });

    void ws; // WS won't send a response
    await vi.advanceTimersByTimeAsync(5001);
    await expectPromise;
  });

  it("does NOT reject if response arrives before timeout", async () => {
    const { client, ws } = await makeConnectedClient({ requestTimeoutMs: 5000 });
    const callPromise = client.call("chat.send", { text: "fast" });
    const reqId = JSON.parse(ws.sentMessages.at(-1)!).id as string;

    await vi.advanceTimersByTimeAsync(2000); // within timeout
    ws.simulateMessage({ type: "res", id: reqId, ok: true, payload: { done: true } });
    await expect(callPromise).resolves.toEqual({ done: true });
  });
});

// ---------------------------------------------------------------------------
describe("GatewayClient — error propagation", () => {
  it("propagates error code from error shape to the rejection", async () => {
    const { client, ws } = await makeConnectedClient();
    const callPromise = client.call("sessions.list", {});
    const reqId = JSON.parse(ws.sentMessages.at(-1)!).id as string;
    ws.simulateMessage({
      type: "res",
      id: reqId,
      ok: false,
      error: {
        code: "QUOTA_EXCEEDED",
        message: "Monthly quota used",
        retryable: true,
        retryAfterMs: 60000,
      },
    });
    const err = await callPromise.catch((e: unknown) => e);
    expect((err as { code: string }).code).toBe("QUOTA_EXCEEDED");
    expect((err as { retryable: boolean }).retryable).toBe(true);
    expect((err as { retryAfterMs: number }).retryAfterMs).toBe(60000);
  });

  it("rejects all pending calls when the WS connection drops unexpectedly", async () => {
    const { client, ws } = await makeConnectedClient({
      reconnect: { baseDelayMs: 30000, maxDelayMs: 30000, jitter: false },
    });
    const p1 = client.call("chat.send", { text: "a" });
    const p2 = client.call("sessions.list", {});
    const p1Expect = expect(p1).rejects.toMatchObject({ code: "CONNECTION_LOST" });
    const p2Expect = expect(p2).rejects.toMatchObject({ code: "CONNECTION_LOST" });

    ws.simulateClose(1006); // abnormal closure

    await p1Expect;
    await p2Expect;
  });

  it("ignores response frames with unknown IDs", async () => {
    const { client, ws } = await makeConnectedClient();
    // No call in flight — simulate stale response
    expect(() =>
      ws.simulateMessage({ type: "res", id: "unknown-id", ok: true, payload: {} }),
    ).not.toThrow();
    // Client remains connected and usable
    const p = client.call("sessions.list", {});
    const reqId = JSON.parse(ws.sentMessages.at(-1)!).id as string;
    ws.simulateMessage({ type: "res", id: reqId, ok: true, payload: { sessions: [] } });
    await expect(p).resolves.toEqual({ sessions: [] });
  });
});
