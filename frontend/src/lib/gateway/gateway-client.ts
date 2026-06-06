/**
 * gateway-client.ts
 *
 * Singleton typed WebSocket client for the DeXMart Gateway.
 * Transport: Direct WS via same-origin Next.js reverse proxy
 * Auth: Firebase ID token in ConnectParams.auth.token
 *
 * Wire protocol frames are defined upstream in src/gateway/protocol/schema/frames.ts
 * — imported directly via @openclaw/protocol alias (PROJECT_RULES §0.1, no redeclaration).
 *
 * Phase 1.B — Dashboard ControlUI Parity track
 */

import { buildDeviceAuthPayloadV3 } from "@DeXMart/shared";
import { GATEWAY_CLIENT_IDS, GATEWAY_CLIENT_MODES } from "@openclaw/protocol/client-info.js";
import { loadOrCreateDeviceIdentity, signDevicePayload } from "./device-identity";

// ---------------------------------------------------------------------------
// Types (thin wrappers only — no schema redefinition)
// ---------------------------------------------------------------------------

export type GatewayErrorShape = {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
};

class GatewayError extends Error {
  code: string;
  retryable: boolean;
  retryAfterMs?: number;
  details?: unknown;

  constructor(shape: GatewayErrorShape) {
    super(shape.message);
    this.name = "GatewayError";
    this.code = shape.code;
    this.retryable = shape.retryable ?? false;
    this.retryAfterMs = shape.retryAfterMs;
    this.details = shape.details;
  }
}

interface BaseFrame {
  type: "req" | "res" | "event" | "hello-ok";
  id?: string;
}

type RequestFrame = BaseFrame & { type: "req"; method: string; params?: unknown };
type ResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: GatewayErrorShape;
};
type EventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: unknown;
};
type HelloOkFrame = { type: "hello-ok" };
type InboundFrame = RequestFrame | ResponseFrame | EventFrame | HelloOkFrame;

type EventHandler = (payload: unknown, meta: { seq?: number; stateVersion?: unknown }) => void;
type PendingCall = {
  resolve: (v: unknown) => void;
  reject: (e: GatewayError) => void;
  timer?: ReturnType<typeof setTimeout>;
};

const NON_RECOVERABLE_AUTH_CODES = new Set([
  "AUTH_UNAUTHORIZED",
  "AUTH_TOKEN_MISMATCH",
  "AUTH_TOKEN_MISSING",
  "AUTH_TOKEN_NOT_CONFIGURED",
  "AUTH_BOOTSTRAP_TOKEN_INVALID",
  "AUTH_DEVICE_TOKEN_MISMATCH",
]);

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type GatewayClientOptions = {
  /** WebSocket URL — /gateway/ws (same origin) or ws://... */
  url: string;
  /** Returns a fresh Firebase ID token. Called on every connect/reconnect. */
  getToken: () => Promise<string>;
  /** Called once on non-recoverable auth failure. */
  onAuthFailed?: (err: GatewayErrorShape) => void;
  /** Called whenever connection status changes. */
  onStatusChange?: (status: "connecting" | "connected" | "reconnecting" | "error") => void;
  /** Request timeout in ms. Default 30_000. */
  requestTimeoutMs?: number;
  /** Reconnect policy. */
  reconnect?: {
    baseDelayMs?: number;
    maxDelayMs?: number;
    /** If true, adds random jitter up to 20% of delay. Default true. */
    jitter?: boolean;
  };
};

// ---------------------------------------------------------------------------
// GatewayClient
// ---------------------------------------------------------------------------

export class GatewayClient {
  private readonly url: string;
  private readonly getToken: () => Promise<string>;
  private readonly onAuthFailed?: (err: GatewayErrorShape) => void;
  private readonly onStatusChange?: (
    status: "connecting" | "connected" | "reconnecting" | "error",
  ) => void;
  private readonly requestTimeoutMs: number;
  private readonly reconnectBaseDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly jitter: boolean;

  private ws: WebSocket | null = null;
  private pendingCalls = new Map<string, PendingCall>();
  private eventHandlers = new Map<string, Set<EventHandler>>();

  // State
  private _isHalted = false;
  private _reconnectAttempts = 0;
  private _reconnectTimer?: ReturnType<typeof setTimeout>;

  // Exposed after hello-ok
  serverVersion: string | null = null;
  serverConnId: string | null = null;
  supportedMethods: string[] = [];
  supportedEvents: string[] = [];
  protocol: number | null = null;

  constructor(opts: GatewayClientOptions) {
    this.url = opts.url;
    this.getToken = opts.getToken;
    this.onAuthFailed = opts.onAuthFailed;
    this.onStatusChange = opts.onStatusChange;
    this.requestTimeoutMs = opts.requestTimeoutMs ?? 30_000;
    this.reconnectBaseDelayMs = opts.reconnect?.baseDelayMs ?? 500;
    this.reconnectMaxDelayMs = opts.reconnect?.maxDelayMs ?? 30_000;
    this.jitter = opts.reconnect?.jitter ?? true;
  }

  get isHalted(): boolean {
    return this._isHalted;
  }

  // ---------------------------------------------------------------------------
  // connect()
  // ---------------------------------------------------------------------------

  connect(): Promise<void> {
    this.onStatusChange?.(this._reconnectAttempts > 0 ? "reconnecting" : "connecting");
    return new Promise<void>((resolve, reject) => {
      this._openSocket(resolve, reject);
    });
  }

  private _openSocket(
    onConnected: (() => void) | null,
    onFailed: ((e: Error) => void) | null,
  ): void {
    if (this._isHalted) {
      return;
    }

    const ws = new WebSocket(this.url);
    this.ws = ws;

    // eslint-disable-next-line unicorn/prefer-add-event-listener
    ws.onopen = () => {
      this._reconnectAttempts = 0;
      void this._sendConnectParams(null, onConnected, onFailed);
    };

    // eslint-disable-next-line unicorn/prefer-add-event-listener
    ws.onmessage = (ev: MessageEvent) => {
      const handled = this._handleInboundFrame(ev.data as string, onConnected, onFailed);

      // Nullify callbacks if we've successfully processed the handshake
      if (ev.data.includes('"hello-ok"')) {
        this.onStatusChange?.("connected");
        onConnected = null;
        onFailed = null;
      }
    };

    // eslint-disable-next-line unicorn/prefer-add-event-listener
    ws.onerror = (_ev: Event) => {
      if (onFailed) {
        const err = new Error("WebSocket error before hello-ok");
        this.onStatusChange?.("error");
        onFailed(err);
        onConnected = null;
        onFailed = null;
      }
    };

    // eslint-disable-next-line unicorn/prefer-add-event-listener
    ws.onclose = (ev: CloseEvent) => {
      this.ws = null;
      // Reject all in-flight calls
      this._rejectAllPending(
        new GatewayError({ code: "CONNECTION_LOST", message: `WebSocket closed (${ev.code})` }),
      );
      if (onFailed) {
        this.onStatusChange?.("error");
        onFailed(new Error(`WebSocket closed before hello-ok (${ev.code})`));
        onConnected = null;
        onFailed = null;
        return;
      }
      // Schedule reconnect unless halted
      if (!this._isHalted) {
        this.onStatusChange?.("reconnecting");
        this._scheduleReconnect();
      } else {
        this.onStatusChange?.("error");
      }
    };
  }

  private async _sendConnectParams(
    nonce: string | null,
    onConnected: (() => void) | null,
    onFailed: ((e: Error) => void) | null,
  ): Promise<void> {
    try {
      const token = await this.getToken();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connectParams: any = {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: GATEWAY_CLIENT_IDS.CONTROL_UI, // nearest valid client id for UI mode
          version: "1.0.0",
          platform: typeof navigator !== "undefined" ? navigator.platform : "web",
          mode: GATEWAY_CLIENT_MODES.UI,
        },
        auth: { token },
        role: "operator",
        scopes: [
          "operator.admin",
          "operator.read",
          "operator.write",
          "operator.approvals",
          "operator.pairing",
        ],
      };

      if (nonce) {
        const deviceIdentity = await loadOrCreateDeviceIdentity();
        const signedAtMs = Date.now();
        const payload = buildDeviceAuthPayloadV3({
          deviceId: deviceIdentity.deviceId,
          clientId: connectParams.client.id,
          clientMode: connectParams.client.mode,
          role: connectParams.role,
          scopes: connectParams.scopes,
          signedAtMs,
          token: connectParams.auth.token ?? null,
          nonce,
          platform: connectParams.client.platform,
          deviceFamily: null, // UI client doesn't have a stable device family metadata field yet
        });
        const signature = await signDevicePayload(deviceIdentity.privateKey, payload);

        connectParams.device = {
          id: deviceIdentity.deviceId,
          publicKey: deviceIdentity.publicKey,
          signature,
          signedAt: signedAtMs,
          nonce,
        };
      }

      const id = this._generateId();
      const reqFrame: RequestFrame = {
        type: "req",
        id,
        method: "connect",
        params: connectParams,
      };

      this.ws?.send(JSON.stringify(reqFrame));
    } catch (err) {
      onFailed?.(err instanceof Error ? err : new Error(String(err)));
      onConnected = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Inbound frame dispatch
  // ---------------------------------------------------------------------------

  private _handleInboundFrame(
    data: string,
    onConnected: (() => void) | null,
    onFailed: ((e: Error) => void) | null,
  ): boolean {
    let frame: InboundFrame;
    try {
      frame = JSON.parse(data) as InboundFrame;
    } catch {
      return false;
    }

    if (frame.type === "hello-ok") {
      // Cast through unknown to access typed fields
      const helloFrame = frame as unknown as {
        server: { version: string; connId: string };
        features: { methods: string[]; events: string[] };
        protocol: number;
      };
      this.serverVersion = helloFrame.server.version;
      this.serverConnId = helloFrame.server.connId;
      this.supportedMethods = helloFrame.features.methods;
      this.supportedEvents = helloFrame.features.events;
      this.protocol = helloFrame.protocol;
      onConnected?.();
      return true;
    }

    if (frame.type === "res") {
      this._handleResponseFrame(frame, onFailed);
      return true;
    }

    if (frame.type === "event") {
      if (frame.event === "connect.challenge") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nonce = (frame.payload as any)?.nonce;
        void this._sendConnectParams(nonce, onConnected, onFailed);
        return true;
      }
      this._dispatchEvent(frame);
      return true;
    }

    return false;
  }

  private _handleResponseFrame(frame: ResponseFrame, onFailed: ((e: Error) => void) | null): void {
    // Non-recoverable auth check (happens before hello-ok during connect)
    if (!frame.ok && frame.error && NON_RECOVERABLE_AUTH_CODES.has(frame.error.code)) {
      this._isHalted = true;
      this.onAuthFailed?.(frame.error);
      onFailed?.(new GatewayError(frame.error));
      return;
    }

    const pending = this.pendingCalls.get(frame.id);
    if (!pending) {
      return;
    } // stale response — ignore silently

    clearTimeout(pending.timer);
    this.pendingCalls.delete(frame.id);

    if (frame.ok) {
      pending.resolve(frame.payload ?? null);
    } else {
      pending.reject(
        new GatewayError(frame.error ?? { code: "UNKNOWN", message: "Unknown error" }),
      );
    }
  }

  private _dispatchEvent(frame: EventFrame): void {
    const handlers = this.eventHandlers.get(frame.event);
    if (!handlers || handlers.size === 0) {
      return;
    }
    const meta = { seq: frame.seq, stateVersion: frame.stateVersion };
    for (const handler of handlers) {
      handler(frame.payload, meta);
    }
  }

  // ---------------------------------------------------------------------------
  // call() — typed RPC request
  // ---------------------------------------------------------------------------

  call<T = unknown>(method: string, params?: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (this._isHalted) {
        reject(
          new GatewayError({
            code: "CLIENT_HALTED",
            message: "Gateway client is halted due to auth failure",
          }),
        );
        return;
      }
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(
          new GatewayError({ code: "NOT_CONNECTED", message: "Gateway client is not connected" }),
        );
        return;
      }

      const id = this._generateId();
      const reqFrame: RequestFrame = { type: "req", id, method, params };

      const timer = setTimeout(() => {
        if (this.pendingCalls.has(id)) {
          this.pendingCalls.delete(id);
          reject(
            new GatewayError({
              code: "TIMEOUT",
              message: `Request ${method} timed out after ${this.requestTimeoutMs}ms`,
            }),
          );
        }
      }, this.requestTimeoutMs);

      this.pendingCalls.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });

      this.ws.send(JSON.stringify(reqFrame));
    });
  }

  // ---------------------------------------------------------------------------
  // subscribe() — event stream
  // ---------------------------------------------------------------------------

  subscribe(event: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  // ---------------------------------------------------------------------------
  // disconnect / cleanup
  // ---------------------------------------------------------------------------

  disconnect(): void {
    this._isHalted = true;
    clearTimeout(this._reconnectTimer);
    this._rejectAllPending(
      new GatewayError({ code: "CLIENT_DISCONNECTED", message: "Client disconnected" }),
    );
    if (this.ws) {
      // eslint-disable-next-line unicorn/prefer-add-event-listener
      this.ws.onclose = null; // prevent reconnect loop
      this.ws.close(1000, "Client disconnected");
      this.ws = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private _scheduleReconnect(): void {
    if (this._isHalted) {
      return;
    }
    const attempt = this._reconnectAttempts++;
    const base = Math.min(
      this.reconnectBaseDelayMs * Math.pow(2, attempt),
      this.reconnectMaxDelayMs,
    );
    const delay = this.jitter ? base * (0.8 + Math.random() * 0.4) : base;

    console.debug(
      `[GatewayClient] Scheduling reconnect attempt ${attempt + 1} in ${Math.round(delay)}ms`,
    );

    this._reconnectTimer = setTimeout(() => {
      if (!this._isHalted) {
        console.debug(`[GatewayClient] Executing reconnect attempt ${attempt + 1}...`);
        this._openSocket(null, null);
      }
    }, delay);
  }

  private _rejectAllPending(err: GatewayError): void {
    for (const [id, pending] of this.pendingCalls) {
      clearTimeout(pending.timer);
      pending.reject(err);
      this.pendingCalls.delete(id);
    }
  }

  private _generateId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // jsdom fallback
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

// ---------------------------------------------------------------------------
// Factory (module-level singleton per URL)
// ---------------------------------------------------------------------------

const _clients = new Map<string, GatewayClient>();

export function createGatewayClient(opts: GatewayClientOptions): GatewayClient {
  const existing = _clients.get(opts.url);
  if (existing && !existing.isHalted) {
    return existing;
  }
  const client = new GatewayClient(opts);
  _clients.set(opts.url, client);
  return client;
}

function resetGatewayClientregistry(): void {
  _clients.clear();
}
