/**
 * gateway-client.connection.test.ts
 *
 * Red-phase tests for GatewayClient connection lifecycle.
 * Covers: connect, auth handshake, reconnect with exponential backoff,
 * and non-recoverable auth halt.
 *
 * Task 1.B.A.1 — Dashboard ControlUI Parity track, Phase 1.B
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

describe("GatewayClient — connect", () => {
  it("opens WebSocket to the configured gateway URL", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({ url: "ws://localhost:18789", getToken: async () => "tok" });
    void client.connect().catch(() => {}); // handle rejection

    const ws = MockWebSocket.latest();
    expect(ws.url).toBe("ws://localhost:18789");
  });

  it("sends ConnectParams as first message after WS opens", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      getToken: async () => "my-token",
    });
    void client.connect().catch(() => {}); // handle rejection

    const ws = MockWebSocket.latest();
    ws.simulateOpen();

    // Wait for async getToken
    await vi.waitFor(() => expect(ws.sentMessages.length).toBe(1));

    const params = JSON.parse(ws.sentMessages[0]);
    expect(params.auth.token).toBe("my-token");
    expect(params.client.id).toBeDefined();
  });

  it("resolves connect() after receiving hello-ok frame", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({ url: "ws://localhost:18789", getToken: async () => "tok" });
    const connectPromise = client.connect();

    const ws = MockWebSocket.latest();
    ws.simulateOpen();
    ws.simulateMessage(HELLO_OK_FRAME);

    await expect(connectPromise).resolves.toBeUndefined();
  });

  it("exposes server version and features after hello-ok", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({ url: "ws://localhost:18789", getToken: async () => "tok" });
    const connectPromise = client.connect();

    const ws = MockWebSocket.latest();
    ws.simulateOpen();
    ws.simulateMessage(HELLO_OK_FRAME);
    await connectPromise;

    expect(client.serverVersion).toBe("2026.4.15");
    expect(client.supportedMethods).toContain("chat.send");
  });

  it("rejects connect() if WS emits error before hello-ok", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({ url: "ws://localhost:18789", getToken: async () => "tok" });
    const connectPromise = client.connect();

    const ws = MockWebSocket.latest();
    ws.simulateError();

    await expect(connectPromise).rejects.toThrow("WebSocket error before hello-ok");
  });
});

describe("GatewayClient — reconnect with exponential backoff", () => {
  it("attempts to reconnect after unexpected disconnect", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      getToken: async () => "tok",
      reconnect: { baseDelayMs: 100, jitter: false },
    });
    void client.connect().catch(() => {});

    const ws1 = MockWebSocket.latest();
    ws1.simulateOpen();
    ws1.simulateMessage(HELLO_OK_FRAME);

    // Unexpected close
    ws1.simulateClose(1006);

    // Should wait baseDelayMs (100ms)
    expect(MockWebSocket.instances.length).toBe(1);
    vi.advanceTimersByTime(100);

    expect(MockWebSocket.instances.length).toBe(2);
    expect(MockWebSocket.latest().url).toBe("ws://localhost:18789");
  });

  it("doubles delay on successive reconnect failures (exponential backoff)", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      getToken: async () => "tok",
      reconnect: { baseDelayMs: 100, jitter: false },
    });
    void client.connect().catch(() => {});

    const ws1 = MockWebSocket.latest();
    ws1.simulateOpen();
    ws1.simulateMessage(HELLO_OK_FRAME);
    ws1.simulateClose(1006);

    // Attempt 1: 100ms
    vi.advanceTimersByTime(100);
    expect(MockWebSocket.instances.length).toBe(2);
    const ws2 = MockWebSocket.latest();
    ws2.simulateClose(1006);

    // Attempt 2: 200ms
    vi.advanceTimersByTime(100);
    expect(MockWebSocket.instances.length).toBe(2); // Not yet
    vi.advanceTimersByTime(100);
    expect(MockWebSocket.instances.length).toBe(3);

    // Attempt 3: 400ms
    const ws3 = MockWebSocket.latest();
    ws3.simulateClose(1006);
    vi.advanceTimersByTime(300);
    expect(MockWebSocket.instances.length).toBe(3);
    vi.advanceTimersByTime(100);
    expect(MockWebSocket.instances.length).toBe(4);
  });

  it("caps reconnect delay at maxDelayMs", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      getToken: async () => "tok",
      reconnect: { baseDelayMs: 100, maxDelayMs: 500, jitter: false },
    });
    void client.connect().catch(() => {});

    const ws1 = MockWebSocket.latest();
    ws1.simulateOpen();
    ws1.simulateMessage(HELLO_OK_FRAME);
    ws1.simulateClose(1006);

    // Backoff: 100, 200, 400, 500, 500
    const expectedDelays = [100, 200, 400, 500, 500];
    for (let i = 0; i < expectedDelays.length; i++) {
      vi.advanceTimersByTime(expectedDelays[i]!);
      expect(MockWebSocket.instances.length).toBe(i + 2);
      MockWebSocket.latest().simulateClose(1006);
    }
  });
});

describe("GatewayClient — non-recoverable auth halt", () => {
  it("does NOT reconnect after AUTH_UNAUTHORIZED response", async () => {
    expect(GatewayClient).toBeDefined();
    const onAuthFailed = vi.fn();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      getToken: async () => "tok",
      onAuthFailed,
    });
    const connectPromise = client.connect();

    const ws = MockWebSocket.latest();
    ws.simulateOpen();
    ws.simulateMessage({
      type: "res",
      ok: false,
      error: { code: "AUTH_UNAUTHORIZED", message: "Bad token" },
    });

    await expect(connectPromise).rejects.toThrow("Bad token");
    expect(onAuthFailed).toHaveBeenCalledWith(
      expect.objectContaining({ code: "AUTH_UNAUTHORIZED" }),
    );

    // Wait and ensure no reconnect happens
    vi.advanceTimersByTime(10000);
    expect(MockWebSocket.instances.length).toBe(1);
    expect(client.isHalted).toBe(true);
  });

  it("halts on AUTH_TOKEN_MISMATCH as well", async () => {
    expect(GatewayClient).toBeDefined();
    const onAuthFailed = vi.fn();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      getToken: async () => "tok",
      onAuthFailed,
    });
    const connectPromise = client.connect();

    const ws = MockWebSocket.latest();
    ws.simulateOpen();
    ws.simulateMessage({
      type: "res",
      ok: false,
      error: { code: "AUTH_TOKEN_MISMATCH", message: "Wrong user" },
    });

    await expect(connectPromise).rejects.toThrow("Wrong user");
    expect(client.isHalted).toBe(true);
    vi.advanceTimersByTime(10000);
    expect(MockWebSocket.instances.length).toBe(1);
  });

  it("exposes isHalted=true after a non-recoverable auth failure", async () => {
    expect(GatewayClient).toBeDefined();
    const client = new GatewayClient({
      url: "ws://localhost:18789",
      getToken: async () => "tok",
    });
    const connectPromise = client.connect();

    expect(client.isHalted).toBe(false);

    const ws = MockWebSocket.latest();
    ws.simulateOpen();
    ws.simulateMessage({
      type: "res",
      ok: false,
      error: { code: "AUTH_UNAUTHORIZED", message: "Bad token" },
    });

    await expect(connectPromise).rejects.toThrow("Bad token");
    expect(client.isHalted).toBe(true);
  });
});
