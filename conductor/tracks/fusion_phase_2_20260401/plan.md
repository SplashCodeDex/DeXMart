# Implementation Plan: TRUE Fusion Phase 2 — UserContext Injection

## Phase 1: User-Scoped Config Resolution ✅ COMPLETE
Focus: Replace OpenClaw's file-based config loading with a Firestore + Redis user-scoped resolver.

- [x] Task: Setup UserContextResolver Base
    - [x] Write tests for `UserContextResolver` (Firestore/Redis interactions, fallback logic).
    - [x] Implement `fromUserId`, `fromToken`, and `fromChannelId` methods in `src/tenancy/context-resolver.ts`.
    - [x] Fixed logger import (OpenClaw tslog → DeXMart winston logger).
    - [x] Fixed Redis mock to use proper constructor pattern.
    - [x] Fixed admin.auth() mock for Firebase token verification.
    - **5/5 tests passing** — `src/tenancy/__tests__/context-resolver.test.ts`
- [x] Task: User-Scoped Config Resolution
    - [x] Write tests for `loadConfigForUser` and `invalidateUserConfigCache`.
    - [x] Implemented in `src/config/user-config.ts` (separate from OpenClaw's io.ts — avoids json5/tslog dep issues).
    - [x] Three-layer cache: in-memory → Redis (5-min TTL) → Firestore → base fallback.
    - [x] OpenClaw's `loadConfig()` unchanged — callers with userId use `loadConfigForUser()`.
    - **8/8 tests passing** — `src/config/io.user-config.test.ts`

## Phase 2: Universal Session Persistence ✅ COMPLETE
Focus: Migrate channel session state from the local filesystem to Firestore, ensuring all channels are user-scoped and cloud-persisted.

- [x] Task: Universal Channel Auth State
    - [x] Created `src/persistence/channel-auth-state.ts` — replaces BOTH `firestore-auth-state.ts` and `dexmart-lib/baileysFirestoreAuth.ts` (two duplicates → one canonical module).
    - [x] `useChannelAuthState(store)` — generic, works with any AuthKeyValueStore backend.
    - [x] `makeFirestoreAuthStore(userId, channelId, firestore)` — Firestore adapter with correct B2C path: `/users/{userId}/channels/{channelId}/auth`.
    - [x] `useFirestoreChannelAuthState()` — convenience wrapper (drop-in replacement).
    - **12/12 tests passing** — `src/persistence/channel-auth-state.test.ts`
- [x] Task: Inject Session Persistence into OpenClaw Channels
    - [x] Added `WaAuthStateFactory` type and `authStateFactory` option to `createWaSocket()` in `src/web/session.ts`.
    - [x] OpenClaw's default (useMultiFileAuthState / file-system) fully preserved for single-user CLI.
    - [x] Multi-user path: callers with userId pass `() => useFirestoreChannelAuthState(userId, channelId, db)`.

## Phase 3: Usage Tracking and Billing Gates ✅ COMPLETE [checkpoint: 064f75c]
Focus: Enforce capabilities and track usage across all primary OpenClaw actions.

- [x] Task: UsageTracker Service
    - [x] Implemented `src/billing/usage-tracker.ts` with batched Firestore writes (10s interval, threshold 50).
    - [x] `trackUsage()` — synchronous O(1) hot-path accumulator.
    - [x] `flushUserUsage()` — per-user flush with re-queue on failure (no usage lost).
    - [x] `flushAllUsage()` — drain all users (for graceful shutdown).
    - [x] `startUsageFlushScheduler()` / `stopUsageFlushScheduler()` — background scheduler.
    - [x] Path: `/users/{userId}/usage/current` (B2C model — user = tenant).
    - **9/9 tests passing** — `src/billing/usage-tracker.test.ts`
- [x] Task: Billing Gate Utilities
    - [x] `createAuthGuard(ctx)` fully implemented in `src/tenancy/tenant-context.ts` (was already there).
    - [x] Created `src/billing/auth-guard.ts` with `filterModelsForUser()`, `buildGateDeniedMessage()`, `assertCan()`.
    - [x] `filterModelsForUser()` intersects plan capabilities with OpenClaw-configured models.
    - [x] `assertCan()` throws structured HTTP 402 with `PLAN_LIMIT_*` code for API middleware.
    - **20/20 tests passing** — `src/billing/auth-guard.test.ts`
- [x] Task: Grace Zone + WebSocket Billing Warnings (FR-3 completion) — `b9a120f`
    - [x] `GraceNotifier` type + `assertCanWithGrace()` in `src/billing/auth-guard.ts`.
    - [x] 90–99% of limit → allowed, `notify` called with `(userId, capability, usedPercent)`.
    - [x] ≥100% → hard block, HTTP 402 `PLAN_LIMIT_*`. Unlimited plans (-1) always pass.
    - [x] `makeBillingWarningNotifier(socket)` factory wires `SocketService` to `GraceNotifier`.
    - [x] `emitBillingWarning()` added to `SocketService` — emits `billing_warning` event with plan-aware message.
    - [x] Fixed `channel-auth-state.test.ts` baileys mock specifier (`'baileys'` not `'@whiskeysockets/baileys/lib/index.js'`).
    - **29/29 tests passing** — `src/billing/auth-guard.test.ts`

---

## Summary
**63 tests, 5 test files, all passing.**

### New files created:
| File | Purpose |
|---|---|
| `src/config/user-config.ts` | User-scoped config resolution (FR-1) |
| `src/config/io.user-config.test.ts` | Tests for user-config |
| `src/persistence/channel-auth-state.ts` | Universal channel auth state (FR-2) |
| `src/persistence/channel-auth-state.test.ts` | Tests for channel-auth-state |
| `src/billing/usage-tracker.ts` | Batched usage tracking (Phase 3.1) |
| `src/billing/usage-tracker.test.ts` | Tests for usage-tracker |
| `src/billing/auth-guard.ts` | Billing gate utilities (Phase 3.2) |
| `src/billing/auth-guard.test.ts` | Tests for auth-guard + createAuthGuard |

### Modified files:
| File | Change |
|---|---|
| `src/tenancy/context-resolver.ts` | Fixed logger import (OpenClaw tslog → DeXMart winston) |
| `src/tenancy/__tests__/context-resolver.test.ts` | Fixed Redis/Firebase mocks |
| `src/web/session.ts` | Added `WaAuthStateFactory` + `authStateFactory` option |

### Next phase (Phase 4 — Dissolve backend/):
- Move real services from `backend/src/services/` into `src/`
- Unify entry point: one `src/main.ts`
- Delete `backend/` directory
