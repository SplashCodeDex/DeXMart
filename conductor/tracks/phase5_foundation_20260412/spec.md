# Spec: Phase 5 — Foundation Grounding

## Overview

Phase 5 is the core of the True Fusion Master Plan. It corrects the architectural mistake
introduced in Phase 4 — a parallel channel management system — and completes the injection
of DeXMart's B2C requirements directly into OpenClaw's engine foundation.

After Phase 5, every one of the 40+ extensions automatically inherits:
- B2C user-scoped isolation (`userId` / `TenantContext`)
- Stripe plan-gated channel starts
- Firestore session persistence
- Correct data paths (`users/{userId}/...`)

## Problem Statement

Phase 4 accidentally created a **parallel channel management system**:

| What Should Exist | What Phase 4 Built (Wrong) |
|---|---|
| OpenClaw's `createChannelManager()` + plugin registry | ✅ Still there, untouched |
| ...with `userId` tenant context at the foundation | ❌ Separate `ChannelService` + `ChannelManager` singleton |
| ...with `extensions/whatsapp/` as canonical WhatsApp | ❌ Separate `WhatsappAdapter.ts` |
| ...with `extensions/` registry as source of truth | ❌ Separate `registry.ts` |

Additionally:
- `backend/` directory still exists (source fully migrated to `src/` in Phase 4)
- Firestore paths still use legacy `tenants/{tenantId}/...` in places
- `SystemAuthorityService` duplicates `auth-guard.ts` plan-gated enforcement
- `HybridMemoryAdapter` is built and tested but not wired into `runEmbeddedPiAgent()`

## Acceptance Criteria

### 5.1 — TenantContext in PluginRuntime
- `createChannelManager().startChannel()` accepts a `userId` / `TenantContext`
- All plugin lifecycle hooks receive tenant context
- Tests: `PluginRuntime` unit tests verify context propagation

### 5.2 — Firestore Auth as Default for SaaS Mode
- `src/web/session.ts` uses `makeFirestoreAuthStore()` by default when `SAAS_MODE=true`
- CLI mode retains file-based auth
- Tests: integration test verifies auth store selection based on env

### 5.3 — Stripe Billing Gates in Channel Startup
- `gateway/server-channels.ts` `startChannelInternal()` calls `assertCan('startChannel')` before booting any plugin
- Exceeding plan channel limit returns structured error (Result pattern)
- Tests: billing gate unit tests with mock Stripe plan data

### 5.4 — ChannelService Orchestrates Native createChannelManager()
- `ChannelService` delegates start/stop/status to `createChannelManager()` from `gateway/server-channels.ts`
- No `AdapterClass` system; plugins are first-class citizens
- Tests: `ChannelService` integration tests using real plugin registry

### 5.5 — Delete Deprecated Parallel System
- `src/services/channels/whatsapp/WhatsappAdapter.ts` deleted
- `src/services/channels/ChannelManager.ts` deleted
- `src/services/channels/registry.ts` deleted
- All imports updated to use native OpenClaw plugin system
- Tests: full test suite passes with zero references to deleted files

### 5.6 — HybridMemoryAdapter Wired into Agent Runtime
- `runEmbeddedPiAgent()` accepts optional `memoryManager` param
- `IngressService` passes `HybridMemoryAdapter` instance per user
- Tests: agent memory integration test verifies recall across calls

### 5.7 — All 40+ Extensions Inherit B2C Capabilities
- Smoke test: start a WhatsApp channel for two different `userId`s — sessions are isolated
- Smoke test: Stripe-gated channel start is enforced for both users
- Tests: multi-tenant isolation integration tests

### 5.8 — Delete backend/ Directory
- `backend/` directory removed from repo
- `backend` removed from `pnpm-workspace.yaml`
- CI/CD scripts updated to remove backend-specific steps
- Tests: `pnpm install` and `pnpm build` succeed without `backend/`

### 5.9 — tenants/ → users/ Path Migration
- `FirebaseService.SchemaMap` updated: all `tenants/{tenantId}/...` → `users/{userId}/...`
- Firestore security rules updated
- Migration script in `scripts/` for existing data
- Tests: all service query tests use `users/` paths

### 5.10 — Consolidate SystemAuthorityService into auth-guard.ts
- `SystemAuthorityService` (`src/services/`) deleted
- All callers updated to use `assertCan()` / `filterModelsForUser()` from `src/billing/auth-guard.ts`
- Tests: auth-guard tests cover all previously-tested SystemAuthorityService scenarios

## Non-Goals
- Phase 6 (ControlUI Replacement) is out of scope
- No new channel plugins or AI model integrations
- No frontend feature changes

## Key Files

| File | Role |
|---|---|
| `src/acp/control-plane/manager.ts` | PluginRuntime — inject TenantContext here |
| `gateway/server-channels.ts` | createChannelManager() — inject Stripe gate here |
| `src/web/session.ts` | Auth state factory — make Firestore default for SaaS |
| `src/services/ChannelService.ts` | Orchestration — wire to native createChannelManager() |
| `src/billing/auth-guard.ts` | Plan gating — consolidation target |
| `src/billing/usage-tracker.ts` | Usage tracking (Phase 2, already complete) |
| `src/persistence/channel-auth-state.ts` | Firestore auth store (Phase 2, already complete) |
| `src/memory/hybrid-adapter.ts` | Memory adapter (Phase 3, already complete) |
| `src/services/FirebaseService.ts` | SchemaMap — migration target for users/ paths |
| `backend/` | Directory to delete |
