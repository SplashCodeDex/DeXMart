# Plan: Phase 5 — Foundation Grounding

## Phase 1: Engine Foundation Injection [checkpoint: 4612742]

### Task 5.1 — Inject TenantContext into PluginRuntime
- [x] Task 5.1.1: Write failing tests — `PluginRuntime` unit tests assert that `startChannel()` propagates `userId`/`TenantContext` to plugin lifecycle hooks
- [x] Task 5.1.2: Extend `PluginRuntime` types to accept optional `TenantContext` param in `createChannelManager()` and `startChannel()`
- [x] Task 5.1.3: Thread `TenantContext` through `PluginRuntime` internals so all plugin hooks receive it
- [x] Task 5.1.4: Update `src/services/ChannelService.ts` call sites to pass `userId` when starting channels
- [x] Task 5.1.5: Run tests (green) + coverage check

### Task 5.2 — Inject Firestore Auth as Default for SaaS Mode
- [x] Task 5.2.1: Write failing tests — integration test asserts `src/web/session.ts` selects `makeFirestoreAuthStore()` when `SAAS_MODE=true` and file-based store otherwise
- [x] Task 5.2.2: Update `src/web/session.ts`: read `SAAS_MODE` env; default `authStateFactory` to `makeFirestoreAuthStore(userId, channelId, db)` in SaaS mode
- [x] Task 5.2.3: Ensure CLI mode (`SAAS_MODE` unset/false) retains file-based auth unchanged
- [x] Task 5.2.4: Run tests (green) + coverage check

### Task 5.3 — Inject Stripe Billing Gates into Channel Startup
- [x] Task 5.3.1: Write failing tests — billing gate unit tests: `assertCan('startChannel')` blocks start when plan limit exceeded, passes when within limit
- [x] Task 5.3.2: Add `ChannelBillingGuard` interface and `billingGuard?` to `ChannelManagerOptions`
- [x] Task 5.3.3: Enforce `billingGuard.canStartChannel()` in `startChannelInternal()` before booting any plugin; throws HTTP 402 on denial
- [x] Task 5.3.4: Run tests (green) + coverage check
- [x] Task: Conductor - User Manual Verification 'Phase 1: Engine Foundation Injection' (Protocol in workflow.md) [4612742]

---

## Phase 2: Channel System Unification

### Task 5.4 — ChannelService Orchestrates Native createChannelManager()
- [x] Task 5.4.1: Write failing tests — `ChannelService` integration tests assert start/stop/status delegated to `createChannelManager()` from `gateway/server-channels.ts`
- [x] Task 5.4.2: Refactor `src/services/ChannelService.ts` to call `createChannelManager()` for channel lifecycle (remove `AdapterClass` dispatch)
- [x] Task 5.4.3: Verify plugin registry auto-discovers `extensions/` plugins without manual registration
- [x] Task 5.4.4: Run tests (green) + coverage check [c566894]

### Task 5.5 — Delete Deprecated Parallel Channel System
- [ ] Task 5.5.1: Audit all imports of `WhatsappAdapter`, `ChannelManager` (DeXMart's), and `registry` (DeXMart's) across `src/`
- [ ] Task 5.5.2: Update all import sites to use native OpenClaw plugin system equivalents
- [ ] Task 5.5.3: Delete `src/services/channels/whatsapp/WhatsappAdapter.ts`
- [ ] Task 5.5.4: Delete `src/services/channels/ChannelManager.ts`
- [ ] Task 5.5.5: Delete `src/services/channels/registry.ts`
- [ ] Task 5.5.6: Run full test suite — verify zero references to deleted files, all tests green
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Channel System Unification' (Protocol in workflow.md)

---

## Phase 3: Memory & Verification

### Task 5.6 — Wire HybridMemoryAdapter into runEmbeddedPiAgent()
- [ ] Task 5.6.1: Write failing tests — agent memory integration test: `runEmbeddedPiAgent()` with `memoryManager` option stores and recalls a fact across two invocations
- [ ] Task 5.6.2: Add optional `memoryManager?: MemorySearchManager` param to `runEmbeddedPiAgent()` signature
- [ ] Task 5.6.3: Wire `memoryManager` into agent tool registration (via `src/agents/tools/memory-tool.ts`)
- [ ] Task 5.6.4: Update `IngressService` to instantiate `HybridMemoryAdapter` per user and pass it to `runEmbeddedPiAgent()`
- [ ] Task 5.6.5: Run tests (green) + coverage check

### Task 5.7 — Verify All 40+ Extensions Inherit B2C Capabilities
- [ ] Task 5.7.1: Write multi-tenant isolation integration tests: start WhatsApp channel for two different `userId`s, assert sessions are isolated in Firestore
- [ ] Task 5.7.2: Write Stripe-gating integration test: verify `startChannel` is blocked for over-plan user across at least 2 channel types
- [ ] Task 5.7.3: Run full integration suite — confirm all 40+ extensions inherit B2C isolation, Stripe gating, Firestore persistence
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Memory & Verification' (Protocol in workflow.md)

---

## Phase 4: Repository Cleanup

### Task 5.8 — Delete backend/ Directory
- [ ] Task 5.8.1: Confirm no source files in `backend/src/` are referenced anywhere in `src/` (grep check)
- [ ] Task 5.8.2: Remove `backend` entry from `pnpm-workspace.yaml`
- [ ] Task 5.8.3: Delete `backend/` directory
- [ ] Task 5.8.4: Update `.github/workflows/backend-ci.yml` — rename to `ci.yml`, change paths to `src/`
- [ ] Task 5.8.5: Run `pnpm install` and `pnpm build` — verify success with no backend workspace

### Task 5.9 — Complete tenants/ → users/ Path Migration
- [ ] Task 5.9.1: Write failing tests — service query tests assert all Firestore paths use `users/{userId}/...` pattern
- [ ] Task 5.9.2: Update `FirebaseService.SchemaMap`: replace all `tenants/{tenantId}/...` keys with `users/{userId}/...`
- [ ] Task 5.9.3: Update Firestore security rules: `tenants/{tenantId}` → `users/{userId}`, enforce `request.auth.uid == userId`
- [ ] Task 5.9.4: Write migration script `scripts/migrate-tenants-to-users.ts` for existing Firestore data
- [ ] Task 5.9.5: Run tests (green) + coverage check

### Task 5.10 — Consolidate SystemAuthorityService into auth-guard.ts
- [ ] Task 5.10.1: Audit all `SystemAuthorityService` call sites across `src/`
- [ ] Task 5.10.2: Write tests in `src/billing/auth-guard.test.ts` covering all `SystemAuthorityService` scenarios not already covered
- [ ] Task 5.10.3: Update all call sites to use `assertCan()` / `filterModelsForUser()` from `src/billing/auth-guard.ts`
- [ ] Task 5.10.4: Delete `src/services/SystemAuthorityService.ts` (or equivalent path)
- [ ] Task 5.10.5: Run full test suite (green) + coverage check
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Repository Cleanup' (Protocol in workflow.md)
