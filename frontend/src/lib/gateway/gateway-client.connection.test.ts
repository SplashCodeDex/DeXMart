/**
 * gateway-client.connection.test.ts
 *
 * Red-phase tests for GatewayClient connection lifecycle.
 * Covers: connect, auth handshake, reconnect with exponential backoff,
 * and non-recoverable auth halt.
 *
 * Task 1.B.A.1 — Dashboard ControlUI Parity track, Phase 1.B
 * These tests MUST FAIL before gateway-client.ts exists (TDD Red phase).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Mock WebSocket ---
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
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

  // Test helpers
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

  simulateError() {
    this.onerror?.(new Event("error"));
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

// --- Helpers ---
const HELLO_OK_FRAME = {
  type: "hello-ok",
  protocol: 1,
  server: { version: "2026.4.15", connId: "test-conn-id" },
  features: { methods: ["chat.send", "sessions.list"], events: ["session.update"] },
  snapshot: {},
  policy: { maxPayload: 65536, maxBufferedBytes: 1048576, tickIntervalMs: 30000 },
};

// Will be imported after implementation exists — intentionally fails until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GatewayClient: any;
let createGatewayClient: (...args: unknown[]) => unknown;

beforeEach(async () => {
  vi.useFakeTimers();
  MockWebSocket.reset();
  try {
    const mod = await import("./gateway-client");
    GatewayClient = mod.GatewayClient;
    createGatewayClient = mod.createGatewayClient as any;
  } catch {
    GatewayClient = undefined;
    createGatewayClient = undefined as unknown as typeof createGatewayClient;
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
describe("GatewayClient — module export", () => {
  it("exports GatewayClient class and createGatewayClient factory", () => {
    expect(GatewayClient).toBeDefined();
    expect(typeof createGatewayClient).toBe("function");
  });
});

// ---------------------------------------------------------------------------
describe("GatewayClient — connect", () => {
  it("opens WebSocket to the configured gateway URL", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({ url: "ws://localhost:18789", getToken: async () => "tok" });
    void client.connect();
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.latest().url).toBe("ws://localhost:18789");
  });

  it("sends ConnectParams as first message after WS opens", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      getToken: async () => "firebase-jwt",
    });
    const connectPromise = client.connect();
    MockWebSocket.latest().simulateOpen();
    await vi.advanceTimersByTimeAsync(0);
    const sent = MockWebSocket.latest().sentMessages;
    expect(sent).toHaveLength(1);
    const params = JSON.parse(sent[0]!);
    expect(params.auth?.token).toBe("firebase-jwt");
    expect(params.client?.mode).toBe("ui");
    expect(params.minProtocol).toBeGreaterThanOrEqual(1);
    expect(params.maxProtocol).toBeGreaterThanOrEqual(1);
    // Resolve the promise so test doesn't hang
    MockWebSocket.latest().simulateMessage(HELLO_OK_FRAME);
    await connectPromise;
  });

  it("resolves connect() after receiving hello-ok frame", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({ url: "ws://localhost:18789", getToken: async () => "tok" });
    const connectPromise = client.connect();
    MockWebSocket.latest().simulateOpen();
    await vi.advanceTimersByTimeAsync(0);
    MockWebSocket.latest().simulateMessage(HELLO_OK_FRAME);
    await expect(connectPromise).resolves.toBeUndefined();
  });

  it("exposes server version and features after hello-ok", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({ url: "ws://localhost:18789", getToken: async () => "tok" });
    const connectPromise = client.connect();
    MockWebSocket.latest().simulateOpen();
    await vi.advanceTimersByTimeAsync(0);
    MockWebSocket.latest().simulateMessage(HELLO_OK_FRAME);
    await connectPromise;
    expect(client.serverVersion).toBe("2026.4.15");
    expect(client.supportedMethods).toContain("chat.send");
    expect(client.supportedEvents).toContain("session.update");
  });

  it("rejects connect() if WS emits error before hello-ok", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({ url: "ws://localhost:18789", getToken: async () => "tok" });
    const connectPromise = client.connect();
    MockWebSocket.latest().simulateOpen();
    MockWebSocket.latest().simulateError();
    MockWebSocket.latest().simulateClose(1006);
    await expect(connectPromise).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
describe("GatewayClient — reconnect with exponential backoff", () => {
  it("attempts to reconnect after unexpected disconnect", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      getToken: async () => "tok",
      reconnect: { baseDelayMs: 100, maxDelayMs: 3200, jitter: false },
    });
    const connectPromise = client.connect();
    const ws1 = MockWebSocket.latest();
    ws1.simulateOpen();
    await vi.advanceTimersByTimeAsync(0);
    ws1.simulateMessage(HELLO_OK_FRAME);
    await connectPromise;

    // Simulate unexpected drop
    ws1.simulateClose(1006);
    await vi.advanceTimersByTimeAsync(0);

    // Advance timer past base delay — a new WS should be created
    await vi.advanceTimersByTimeAsync(150);
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it("doubles delay on successive reconnect failures (exponential backoff)", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      getToken: async () => "tok",
      reconnect: { baseDelayMs: 100, maxDelayMs: 3200, jitter: false },
    });
    const connectPromise = client.connect();
    const ws1 = MockWebSocket.latest();
    ws1.simulateOpen();
    await vi.advanceTimersByTimeAsync(0);
    ws1.simulateMessage(HELLO_OK_FRAME);
    await connectPromise;

    // First drop → reconnect after 100ms
    ws1.simulateClose(1006);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(150);
    const ws2 = MockWebSocket.latest();
    ws2.simulateClose(1006); // second failure immediately
    await vi.advanceTimersByTimeAsync(0);

    // Second reconnect should wait ~200ms
    await vi.advanceTimersByTimeAsync(150); // not enough — under 200ms
    expect(MockWebSocket.instances).toHaveLength(2); // not yet created

    await vi.advanceTimersByTimeAsync(100); // now over 200ms total
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it("caps reconnect delay at maxDelayMs", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      getToken: async () => "tok",
      reconnect: { baseDelayMs: 100, maxDelayMs: 300, jitter: false },
    });
    const connectPromise = client.connect();
    const ws1 = MockWebSocket.latest();
    ws1.simulateOpen();
    await vi.advanceTimersByTimeAsync(0);
    ws1.simulateMessage(HELLO_OK_FRAME);
    await connectPromise;

    // Simulate 5 drops
    for (let i = 0; i < 5; i++) {
      MockWebSocket.latest().simulateClose(1006);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(350); // always advance past maxDelay
    }
    // 6 total WS instances (1 original + 5 reconnects)
    expect(MockWebSocket.instances).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
describe("GatewayClient — non-recoverable auth halt", () => {
  it("does NOT reconnect after AUTH_UNAUTHORIZED response", async () => {
    expect(GatewayClient).toBeDefined();
    const onAuthFailed = vi.fn();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      getToken: async () => "bad-token",
      onAuthFailed,
      reconnect: { baseDelayMs: 100, maxDelayMs: 3200, jitter: false },
    });
    client.connect().catch(() => {});
    const ws1 = MockWebSocket.latest();
    ws1.simulateOpen();
    await vi.advanceTimersByTimeAsync(0);
    // Server rejects auth
    ws1.simulateMessage({
      type: "res",
      id: "__connect__",
      ok: false,
      error: { code: "AUTH_UNAUTHORIZED", message: "Token invalid", retryable: false },
    });
    ws1.simulateClose(1008);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);

    // Must NOT have created a second WebSocket
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(onAuthFailed).toHaveBeenCalledWith(
      expect.objectContaining({ code: "AUTH_UNAUTHORIZED" }),
    );
  });

  it("halts on AUTH_TOKEN_MISMATCH as well", async () => {
    expect(GatewayClient).toBeDefined();
    const onAuthFailed = vi.fn();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      getToken: async () => "stale-token",
      onAuthFailed,
      reconnect: { baseDelayMs: 100, maxDelayMs: 3200, jitter: false },
    });
    client.connect().catch(() => {});
    MockWebSocket.latest().simulateOpen();
    await vi.advanceTimersByTimeAsync(0);
    MockWebSocket.latest().simulateMessage({
      type: "res",
      id: "__connect__",
      ok: false,
      error: { code: "AUTH_TOKEN_MISMATCH", message: "Token mismatch", retryable: false },
    });
    MockWebSocket.latest().simulateClose(1008);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(onAuthFailed).toHaveBeenCalled();
  });

  it("exposes isHalted=true after a non-recoverable auth failure", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      getToken: async () => "bad",
      reconnect: { baseDelayMs: 100, maxDelayMs: 3200, jitter: false },
    });
    client.connect().catch(() => {});
    MockWebSocket.latest().simulateOpen();
    await vi.advanceTimersByTimeAsync(0);
    MockWebSocket.latest().simulateMessage({
      type: "res",
      id: "__connect__",
      ok: false,
      error: { code: "AUTH_UNAUTHORIZED", message: "Unauthorized", retryable: false },
    });
    MockWebSocket.latest().simulateClose(1008);
    await vi.advanceTimersByTimeAsync(0);
    expect(client.isHalted).toBe(true);
  });
});
