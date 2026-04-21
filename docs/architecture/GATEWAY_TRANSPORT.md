# Gateway Transport Architecture

> **Status:** APPROVED — locked for Phase 1.B and all downstream work.
> **Produced by:** Task 1.A.3 (Dashboard ControlUI Parity track — Phase 1)
> **Approved in:** Task 1.A.4

---

## Decision Summary

**Selected Transport: Direct WebSocket via Same-Origin Next.js Reverse Proxy**

The DeXMart Next.js frontend opens a WebSocket to the **same origin** (`wss://dexmart.app/gateway/ws`). The Next.js server (or its edge/Node layer) transparently proxies this WebSocket connection to the single shared OpenClaw Gateway process. Tenant isolation is enforced at the **Gateway auth handshake** via the Firebase JWT carried in `ConnectParams.auth.token`, NOT at the transport layer. No per-tenant relay process is required.

---

## Topology Survey Results

| Question                               | Answer                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| Gateway deployment model               | **Single shared Gateway** — one managed OpenClaw process serves all B2C tenants |
| Frontend ↔ Gateway origin relationship | **Same origin** — Next.js reverse-proxies to Gateway                            |
| Existing WS relay/proxy infrastructure | **None**                                                                        |

---

## Options Evaluated

### Option 1 ✅ — Direct WS via Same-Origin Reverse Proxy (SELECTED)

```
Browser
  │  wss://dexmart.app/gateway/ws
  ▼
Next.js server (reverse proxy at /gateway/ws)
  │  ws://localhost:<gateway_port>/
  ▼
Single shared OpenClaw Gateway
  │  ConnectParams.auth.token = Firebase JWT (tenantId = uid)
  └─▶ Multi-tenant isolation enforced at auth handshake
```

**How it works:**

1. The browser connects to `wss://dexmart.app/gateway/ws` — same origin as the Next.js app.
2. Next.js proxies this WebSocket at the edge to the internal Gateway process (e.g. `ws://localhost:18789/`).
3. The frontend sends `ConnectParams` in the first frame; `auth.token` is a short-lived Firebase ID token obtained client-side via `getIdToken()`.
4. DeXMart's Gateway auth injection (already grounded in Phase 5 Foundation) validates the Firebase JWT, extracts the `uid`, and scopes all subsequent RPC calls to `users/{uid}/...` in Firestore.
5. No code duplication — uses upstream `ConnectParams` / `HelloOkSchema` / `RequestFrameSchema` / `ResponseFrameSchema` / `EventFrameSchema` directly from `src/gateway/protocol/schema/frames.ts`.

**Advantages:**

- ✅ Zero CORS complexity — same origin eliminates all preflight/CORS errors
- ✅ No new infrastructure — Next.js's built-in WS proxy (via `next.config.ts` `rewrites` or a custom server) handles it
- ✅ Tenant isolation is already built — Phase 5 Foundation grounded Firebase auth into the Gateway engine
- ✅ Scales with a single Gateway binary; horizontal scaling is standard Load Balancer → multiple Gateway pods (stateless session via Firestore)
- ✅ Upstream leverage — zero deviation from OpenClaw's wire protocol; no forked frames
- ✅ Security: Firebase ID token is short-lived (1 hour), refreshed via `onIdTokenChanged`; token travels in the first WS frame only (not in the URL)

**Tradeoffs / mitigations:**

- ⚠️ Single Gateway becomes a hot path → mitigated by horizontal scaling and Firestore-backed session storage (already in place per Phase 5 Foundation)
- ⚠️ Next.js proxy adds one network hop → acceptable; latency measured in single-digit ms on same-network deployments
- ⚠️ Gateway WS path must not conflict with Next.js routes → enforced by reserving `/gateway/ws` as a non-page path in `next.config.ts`

---

### Option 2 ❌ — Relay Proxy (Rejected)

A separate DeXMart backend process maintains one persistent WS per active tenant and relays frames to the browser via Socket.io.

**Rejected because:**

- Adds a stateful relay service to operate and monitor
- Relay introduces an additional failure point and a fan-in/fan-out latency cost
- DeXMart has no existing relay infrastructure (Q3 survey)
- Gains no advantage over Option 1 given same-origin deployment

---

### Option 3 ❌ — Tenant-Mux Gateway (Rejected)

Single Gateway instance with per-tenant muxing logic injected at handler entry (diverges from upstream's connection model).

**Rejected because:**

- Would require forking or patching OpenClaw's connection handler — violates PROJECT_RULES §0.1 (Upstream Leverage)
- Upstream's auth handshake already provides the isolation seam; duplicating this at the mux layer is redundant
- Not compatible with upstream's existing `ConnectParams` / `HelloOkSchema` contract without schema mutation

---

## WS Frame Contract Reference

All frames are defined in `src/gateway/protocol/schema/frames.ts` and are imported directly into the frontend client — **no redeclaration**.

| Frame type   | Key fields                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| `req`        | `type="req"`, `id: string`, `method: string`, `params?: unknown`                                       |
| `res`        | `type="res"`, `id: string`, `ok: boolean`, `payload?: unknown`, `error?: ErrorShape`                   |
| `event`      | `type="event"`, `event: string`, `payload?: unknown`, `seq?: number`, `stateVersion?: StateVersion`    |
| `ErrorShape` | `code: string`, `message: string`, `details?: unknown`, `retryable?: boolean`, `retryAfterMs?: number` |

Connect handshake:

- Client → `ConnectParams` (first WS message, JSON-encoded): includes `auth.token` (Firebase ID token), `client.id = "dexmart-dashboard"`, `client.mode = "ui"`
- Server → `HelloOkSchema`: protocol version, `features.methods[]`, `features.events[]`, initial snapshot, policy (maxPayload, tickIntervalMs)

---

## Implementation Constraints for Phase 1.B

1. **Single WS client per browser tab** — `gateway-client.ts` is a module-level singleton. Multiple React components share it via `GatewayProvider` context.
2. **Firebase token refresh** — subscribe to `onIdTokenChanged(auth, ...)` and re-authenticate the WS connection on token rotation (before 1-hour expiry). The client must support a reconnect path that re-sends `ConnectParams` with a fresh token without dropping in-flight requests.
3. **Exponential backoff reconnect** — per test plan: `gateway-client.connection.test.ts`. Base 500ms, max 30s, jitter ±20%.
4. **Non-recoverable auth halt** — if the server responds with `AUTH_UNAUTHORIZED` or `AUTH_TOKEN_MISMATCH` after a reconnect attempt, the client MUST halt and surface an error to the UI rather than retrying indefinitely.
5. **Idempotency keys** — `req` frames include a caller-supplied `id` (UUID v4). The client must deduplicate on reconnect if the request was already sent but no `res` received (pending map cleared on clean disconnect, preserved on reconnect).
6. **Next.js proxy config** — reserve `/gateway/ws` in `next.config.ts` as a WS rewrite target. Do NOT route this through the Next.js App Router page system.
7. **No duplicate Zod schemas** — `frontend/src/lib/gateway/gateway-types.ts` re-exports from `src/gateway/protocol/schema/*` via workspace alias. Zero redeclarations.

---

## Workspace Alias Setup (if not already present)

Verify `frontend/tsconfig.json` or root `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "paths": {
      "@openclaw/protocol": ["../src/gateway/protocol/index.ts"],
      "@openclaw/protocol/*": ["../src/gateway/protocol/*"]
    }
  }
}
```

If absent, add it in Phase 1.B.C.1 before importing schemas.

---

## Sign-off Record

| Role          | Name                  | Confirmed     |
| ------------- | --------------------- | ------------- |
| Product owner | Adema (SplashCodeDex) | ✅ Task 1.A.4 |
