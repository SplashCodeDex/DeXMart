# Specification: TRUE Fusion Phase 2 — UserContext Injection

## Overview

Inject `UserContext` into OpenClaw's core engine to enable B2C multi-tenancy and billing gating. This transforms OpenClaw from a single-user, file-based system into a multi-user, cloud-persisted, billing-gated platform — without modifying OpenClaw's internal logic beyond the minimum necessary injection points.

After this track, every OpenClaw operation (config resolution, session persistence, channel lifecycle, model selection, tool execution) will be scoped to the authenticated user and gated by their subscription plan.

## Functional Requirements

### FR-1: User-Scoped Config Resolution

- Replace OpenClaw's file-based `loadConfig()` with a user-scoped resolver
- Each user's configuration is stored in Firestore at `/users/{userId}/config`
- Config is cached in Redis with a 5-minute TTL to minimize Firestore reads
- Cache is invalidated on config updates (dashboard save, API call)
- OpenClaw's internal modules continue calling `loadConfig()` — the function signature is preserved, but its data source changes from JSON5 file to Firestore→Redis pipeline
- Fallback: if Redis is unavailable, read directly from Firestore

### FR-2: Universal Firestore Session Persistence

- Replace OpenClaw's `useMultiFileAuthState(authDir)` with `useFirestoreAuthState(userId, channelId)` for ALL channel types
- Session state stored at `/users/{userId}/sessions/{channelId}/`
- Applies universally: WhatsApp (Baileys creds), Telegram (bot tokens), Discord (bot tokens), Slack (OAuth tokens), Signal, and all other channels
- The existing `baileysFirestoreAuth.ts` pattern from DeXMart serves as the reference implementation — generalized for all channel types
- Session read/write operations are batched to minimize Firestore round-trips

### FR-3: Billing-Gated Operations

- Wire `UserContext.capabilities` checks into OpenClaw's operation flow:
  - **Model Selection:** Filter available models by `capabilities.models` before the agent runtime selects one
  - **Channel Start:** Check `capabilities.maxChannels` vs `usage.activeChannels` before starting a new channel
  - **Agent Creation:** Check `capabilities.maxAgents` vs `usage.activeAgents` before creating a new agent
  - **Message Send:** Check `capabilities.maxMessagesPerMonth` vs `usage.messagesThisPeriod` before sending
  - **Feature Access:** Check `capabilities.features[featureName]` before executing feature-gated tools (campaigns, anti-ban, etc.)
- **Soft block with grace:** When a user exceeds limits, allow up to 10% overage with a warning notification (via WebSocket push). After the 10% grace, hard block with HTTP 402 "Upgrade Required"
- Usage counters updated asynchronously (fire-and-forget increment, periodic Firestore flush)

### FR-4: UserContext Resolution Pipeline

- Build a `UserContextResolver` implementation backed by Firestore + Redis:
  - `fromUserId(userId)` → Firestore lookup at `/users/{userId}`, cached in Redis
  - `fromToken(jwt)` → decode JWT → extract `userId` → call `fromUserId()`
  - `fromChannelId(channelId)` → reverse lookup via `/channelMappings/{channelId}` → `userId` → call `fromUserId()`
- `AuthGuard` (already created in Phase 1) enforces user isolation at every data access point
- `UserContext` flows through the request lifecycle: HTTP middleware → route handler → service → OpenClaw engine

### FR-5: Usage Tracking

- Implement `UsageTracker` service that maintains in-memory counters per user
- Counters: `messagesThisPeriod`, `activeChannels`, `activeAgents`, `tokensConsumed`
- Counters are flushed to Firestore at `/users/{userId}/usage` every 30 seconds (batched write)
- On user context resolution, current usage is loaded from Firestore and cached

## Non-Functional Requirements

- **NFR-1:** Config resolution must complete in <50ms (Redis cache hit) or <200ms (Firestore fallback)
- **NFR-2:** Session persistence must not add >100ms latency to channel connection flows
- **NFR-3:** Billing gate checks must complete in <5ms (in-memory capability check)
- **NFR-4:** Usage counter flush must be non-blocking (fire-and-forget with error logging)
- **NFR-5:** Zero regression to OpenClaw's existing test suite after injection

## Acceptance Criteria

- [ ] `loadConfig()` resolves per-user config from Firestore with Redis caching
- [ ] All channel types persist session state in Firestore (not filesystem)
- [ ] Model selection respects user plan capabilities
- [ ] Channel start blocked when user exceeds `maxChannels` (after 10% grace)
- [ ] Message send blocked when user exceeds monthly cap (after 10% grace)
- [ ] 402 "Upgrade Required" returned with clear upgrade path info
- [ ] Warning notifications pushed via WebSocket when user enters grace zone
- [ ] `UserContextResolver` resolves from JWT, userId, or channelId
- [ ] `AuthGuard.assertOwns()` prevents cross-user data access
- [ ] Usage counters increment in real-time and flush to Firestore periodically
- [ ] OpenClaw's existing test suite passes without modification

## Out of Scope

- Dashboard UI changes (separate track)
- Stripe webhook integration for plan changes (existing implementation stays)
- Campaign system integration with billing (separate track)
- Migration tooling for existing single-tenant data
- OpenClaw upstream sync workflow
