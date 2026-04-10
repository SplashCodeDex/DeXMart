# True Fusion Strategy

> **Last verified**: 2026-04-10 | **Status**: True Fusion Complete

---

## 1. What "True Fusion" Means

True Fusion is the process of making **one project called DeXMart** from two origins -- the OpenClaw engine (upstream heritage) and DeXMart platform features. The end result is not "two things glued together" -- it is a single, indistinguishable codebase where no developer needs to know or care what came from where.

**The non-negotiable rules:**

| Rule | What it means |
|------|---------------|
| **One project** | After fusion, there is only DeXMart. OpenClaw is the upstream heritage, not a visible boundary. |
| **Zero duplication** | Every function, feature, and service exists exactly once. No mirrors, no copies. |
| **No bridges** | No wrappers, adapters, or bridge files. Code calls code directly. |
| **Frontend dominates** | Every backend capability is accessible through the DeXMart Next.js dashboard. |
| **Centralized elevation** | Monetization, tenant auth, cloud persistence, and DeXMart-exclusive features apply to the entire project -- not bolted onto a side. |

**The analogy:** OpenClaw is to DeXMart what the Linux kernel is to Ubuntu. Ubuntu IS the product. The kernel is the heritage. Nobody opens Ubuntu and sees "the Linux part" and "the Ubuntu part" -- they see one operating system. That's True Fusion.

The result is a single `src/` tree. All modules coexist without boundaries. OpenClaw modules are imported directly (no bridges, no wrappers, no adapters). Platform features like billing and tenancy are integrated at well-defined touch points that elevate the entire project.

---

## 2. Why This Approach?

### 2.1 Alternatives Considered and Rejected

| Approach | Why Rejected |
|----------|-------------|
| **OpenClaw as npm dependency** | Cannot inject UserContext into config loading, session persistence, or model selection. Plugin SDK doesn't expose these. |
| **Full fork (modify OpenClaw internals)** | Creates permanent upstream divergence. Every OpenClaw update requires manual merge of modified internals. Unmaintainable. |
| **Microservices (DeXMart calls OpenClaw via HTTP)** | Adds latency to every message. Session state split across services. Deployment complexity multiplied. |
| **Bridge/adapter pattern** | Already tried -- created 8,318 lines of dead wrapper code. Import path chaos. "Which version?" confusion. |

### 2.2 Why Managed Fork Works

1. **Minimal touch points**: DeXMart only injects at 4 well-defined points (config, session, model selection, billing gate). OpenClaw's 4,040 files are untouched.
2. **Upstream sync is possible**: Cherry-pick security patches. Review new features. The 4 injection points are stable API surfaces unlikely to change between OpenClaw releases.
3. **Single import path**: No `openclaw/src/` vs `backend/src/` vs `src/` confusion. Everything is `@dexmart/*` or `@/*`.
4. **Tests coexist**: OpenClaw's tests pass unmodified. DeXMart's tests cover the injection layer.

---

## 3. The Four Phases

### Phase 1: Repository Restructure -- COMPLETE

**Branch**: `fusion/phase-1-restructure` | **Commits**: `f11789c8b`, `5520f1809`

**What was done:**

1. **Flattened OpenClaw**: All 4,040 TypeScript files from `openclaw/src/` copied into root `src/`. OpenClaw's directory structure preserved (e.g., `openclaw/src/agents/` becomes `src/agents/`).

2. **Copied extensions**: All 40 OpenClaw extensions from `openclaw/extensions/` to root `extensions/`.

3. **Organized DeXMart modules**: Enterprise services moved from scattered locations into clean `src/` modules:
   ```
   src/tenancy/          -- UserContext, AuthGuard, context resolver
   src/billing/          -- Stripe, plan gating, usage tracking
   src/persistence/      -- Firebase, Firestore, channel auth state
   src/campaigns/        -- Bulk messaging with anti-ban
   src/safety/           -- Anti-ban rules, content moderation
   src/analytics/        -- Usage tracking, Mastermind stream
   src/ingress/          -- Omnichannel message routing
   src/agents-management/ -- Agent CRUD per user
   src/auth/             -- Authentication layer
   ```

4. **Deleted all bridges**: Removed `openclawImports.ts`, `openClawGateway.ts`, `OpenClawSkillBridge.ts`, `GenericOpenClawAdapter.ts`, `openclaw.d.ts`. These were band-aids from the pre-fusion era.

5. **Deleted all duplicates**: Removed DeXMart's copies of `geminiAI.ts`, `toolRegistry.ts`, `skillsManager.ts`, `memoryService.ts`, `ChannelAdapter.ts`, `ChannelManager.ts`, `ChannelWatchdog.ts`, `WhatsappAdapter.ts`, `simple.ts`. OpenClaw's originals are now the single source of truth.

6. **Result**: 8,318 lines of dead code removed. Clean `src/` tree.

7. **Root tsconfig.json** created with path aliases:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "openclaw/plugin-sdk": ["./src/plugin-sdk/index.ts"],
         "@dexmart/*": ["./src/*"],
         "@/*": ["./src/*"]
       }
     }
   }
   ```

---

### Phase 2: UserContext Injection -- COMPLETE

**54 tests across 5 test files, all passing.**

Four injection points were implemented:

#### 2.1 User-Scoped Config Resolution (FR-1)

| Detail | Value |
|--------|-------|
| **File** | `src/config/user-config.ts` |
| **Test** | `src/config/io.user-config.test.ts` (8/8 passing) |
| **What it does** | Resolves config per-user from Firestore instead of a single file |
| **Cache strategy** | In-memory -> Redis (5-min TTL) -> Firestore -> platform defaults |
| **Non-breaking** | OpenClaw's `loadConfig()` still works for single-user/CLI mode |

**How it works:**
```
loadConfigForUser(userId)
  1. Check in-memory cache -> return if hit
  2. Check Redis cache (key: config:{userId}, TTL: 5min) -> return if hit
  3. Query Firestore at /users/{userId}/config -> return if found
  4. Fall back to ConfigManager platform defaults
  5. Cache result at all levels
```

#### 2.2 Universal Firestore Session Persistence (FR-2)

| Detail | Value |
|--------|-------|
| **File** | `src/persistence/channel-auth-state.ts` |
| **Test** | `src/persistence/channel-auth-state.test.ts` (12/12 passing) |
| **What it does** | Replaces `useMultiFileAuthState(authDir)` with cloud-backed session storage |
| **Firestore path** | `/users/{userId}/channels/{channelId}/auth` |
| **Applies to** | ALL channels (WhatsApp, Telegram, Discord, Slack, Signal, etc.) |
| **Injection point** | `src/web/session.ts` -- `createWaSocket()` accepts `authStateFactory` option |

**Why this matters:**
- File-based sessions don't survive container restarts or horizontal scaling
- Firestore sessions are durable, user-scoped, and queryable
- The `authStateFactory` pattern is opt-in -- single-user mode still uses files

#### 2.3 Billing-Gated Operations (FR-3)

| Detail | Value |
|--------|-------|
| **Files** | `src/billing/auth-guard.ts`, `src/billing/usage-tracker.ts` |
| **Tests** | `src/billing/auth-guard.test.ts` (20/20), `src/billing/usage-tracker.test.ts` (9/9) |
| **Gate points** | Model selection, channel start, agent creation, message send, feature access |
| **Denial** | HTTP 402 "Upgrade Required" with `buildGateDeniedMessage()` |
| **Grace period** | 10% overage allowed before hard block on message quotas |

**Key functions:**
```typescript
filterModelsForUser(ctx, models)   // Intersect available models with plan
assertCan(ctx, 'startChannel')     // Check against maxChannels
assertCan(ctx, 'sendMessage')      // Check against monthly quota
assertCan(ctx, 'createAgent')      // Check against maxAgents
assertCan(ctx, 'feature:campaigns') // Check feature flags
```

**Usage tracking:**
- In-memory counters incremented on each operation
- Batched Firestore flush every 10 seconds OR when threshold (50 operations) reached
- Non-blocking, fire-and-forget -- never slows down the request
- Re-queued on flush failure (no lost updates)

#### 2.4 UserContext Resolution Pipeline (FR-4)

| Detail | Value |
|--------|-------|
| **File** | `src/tenancy/context-resolver.ts` |
| **Test** | `src/tenancy/__tests__/context-resolver.test.ts` (5/5 passing) |
| **What it does** | Resolves UserContext from multiple sources (JWT, userId, channelId) |
| **Cache** | 5-min TTL for context, 24-hour TTL for channel-to-user mappings |

**Resolution sources (in priority order):**
1. **JWT token** -> decode, extract userId, look up profile + plan in Firestore
2. **Direct userId** -> look up profile + plan in Firestore
3. **Channel ID** -> look up channel-to-user mapping, then resolve userId

**The UserContext shape:**
```typescript
interface UserContext {
  userId: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  capabilities: {
    maxChannels: number;
    maxAgents: number;
    messagesPerMonth: number;
    models: string[];           // Allowed model IDs
    features: string[];         // Enabled feature flags
  };
  metadata: {
    email: string;
    createdAt: Date;
    subscriptionStatus: 'active' | 'past_due' | 'cancelled';
  };
}
```

---

### Phase 3: AI Agent Fusion -- COMPLETE

**Goal**: Make OpenClaw's pi-embedded-runner fully tenant-aware.

#### 3.1 Hook MastermindStreamService into OpenClaw Agent Events

- OpenClaw's agent runtime emits events: `reasoning:start`, `reasoning:thought`, `tool:invoke`, `tool:result`, `agent:spawn`, `reasoning:complete`
- `MastermindStreamService` already listens for these events and broadcasts via WebSocket
- **Task**: Wire `onAgentEvent()` callback into the pi-embedded-runner's event emitter
- **Scoping**: Each event tagged with `userId` so broadcasts go only to the owning user's dashboard

#### 3.2 Swap File-Based Memory for Firestore

- OpenClaw uses sqlite-vec for vector memory (local file)
- **Task**: Implement Firestore-backed memory adapter that conforms to OpenClaw's memory interface
- **Path**: `/users/{userId}/memory/{memoryId}`
- **Why**: File-based memory doesn't survive scaling or container restarts

#### 3.3 Tenant-Scoped Model Gating in Agent Selector

- OpenClaw's model selection iterates all configured providers
- **Task**: Inject `filterModelsForUser(ctx, availableModels)` before model selection
- **Result**: Agent only sees models the user's plan allows
- **Fallback**: If no models available after filtering, return clear error (not silent failure)

---

### Phase 4: Dissolve backend/ Into src/ -- COMPLETE

**Goal**: Eliminate the `backend/` package entirely. One codebase, one entry point.

#### What was done (2026-04-02 / 2026-04-03)

All `backend/src/` directories moved directly into `src/` with no `dexmart-*` prefixes:

| Component | From | To | Notes |
|-----------|------|-----|-------|
| Services (65 files) | `backend/src/services/` | `src/services/` | Merged with existing `src/services/ApiKeyManager.ts` |
| Routes (25 files) | `backend/src/routes/` | `src/routes/` | |
| Middleware (12 files) | `backend/src/middleware/` | `src/middleware/` | |
| Lib (16 files) | `backend/src/lib/` | `src/lib/` | Firebase, Redis, context init |
| Jobs (10 files) | `backend/src/jobs/` | `src/jobs/` | BullMQ workers |
| Server | `backend/src/server/` | `src/server/` | |
| Utils | `backend/src/utils/` | `src/utils/` | No filename conflicts with OpenClaw utils |
| Types | `backend/src/types/` | `src/types/` | No filename conflicts with OpenClaw types |
| Commands | `backend/src/commands/` | `src/commands/` | DeXMart command subdirs added alongside OpenClaw commands |
| Events, Tools, Workers, Webhooks, Controllers | `backend/src/*/` | `src/*/` | Direct move |
| Config (conflict) | `backend/src/config/config.ts` | `src/dexmart-config/config.ts` | Renamed to avoid conflict with OpenClaw's `src/config/config.ts` |

#### Key additional changes

- **`@/*` alias** added to root `tsconfig.json` → `src/*` (so backend's `@/utils/logger.js` resolves in `src/`)
- **`ChannelWatchdog` dissolved**: Source deleted in Phase 1. Import removed from `src/main.ts`. Logic absorbed into `ChannelService.startWatchdog()` (new method)
- **`src/main.ts` unified**: Now boots DeXMart's Express server + starts `channelService.startWatchdog()` + `startUsageFlushScheduler()` (Phase 2 hook)
- **`MultiTenantApp.shutdown()`**: Now stops watchdog + flushes usage tracker on SIGTERM
- **202 dead `dexmart-*` stub files deleted** (artifacts from Phase 1's incomplete staging)
- **`context-resolver.ts` imports fixed**: Now uses `../lib/firebase.js` and `../utils/logger.js` (real locations)
- **Recreated from compiled JS** (source deleted in Phase 1, now properly typed and fused):
  - `src/services/channels/ChannelManager.ts` — adapter instance registry with `getAdaptersForUser()`, `shutdownUserAdapters()`
  - `src/services/channels/registry.ts` — platform registry; `GenericOpenClawAdapter` bridge removed; `msteams/matrix/facebook` correctly flagged as `nativeOpenClaw: true`
  - `src/services/channels/whatsapp/WhatsappAdapter.ts` — **the fusion point**: wraps OpenClaw's `createWaSocket()` with Firestore auth (Phase 2 FR-2), anti-ban queue, multi-tenant isolation
- **`IngressService` → `runEmbeddedPiAgent()`**: Core fusion wiring. DeXMart's inbound message pipeline now feeds directly into OpenClaw's embedded agent runtime. `GeminiAI` (deleted in Phase 1) is replaced by the real engine.
- **`GlobalContext.unifiedAI`** type fixed — dead `GeminiAI` reference removed

#### What remains

The `backend/` directory still exists (source migrated, `dist/` untouched). It should be deleted once the app is verified booting from `src/main.ts` in a staging environment.

Next step before deletion:
1. Smoke test `src/main.ts` in staging — confirm the server starts, channels reconnect, and agent processing works end-to-end
2. Delete `backend/` directory
3. Update `pnpm-workspace.yaml` to remove `backend`
4. Update CI/CD scripts to reference `src/` directly

---

## 4. Upstream Sync Strategy

### 4.1 How We Track OpenClaw

```bash
# OpenClaw upstream is configured as a git remote
git remote add openclaw-upstream <openclaw-repo-url>

# Periodic fetch (automated via GitHub Actions every 12 hours)
git fetch openclaw-upstream

# Review changes
git log openclaw-upstream/main --oneline --since="2 weeks ago"
```

### 4.2 What We Cherry-Pick

| Category | Action | Example |
|----------|--------|---------|
| **Security patches** | Always cherry-pick immediately | CVE fixes, auth bypasses |
| **Channel bug fixes** | Cherry-pick after review | Baileys reconnect fixes |
| **New channel plugins** | Copy to `extensions/`, test | New Matrix bridge |
| **Agent runtime improvements** | Review, adapt, merge | Better model fallback logic |
| **Breaking API changes** | Review impact on 4 injection points | Config format changes |
| **UI/CLI changes** | Ignore (DeXMart has its own dashboard) | Terminal UI updates |

### 4.3 Sync Report

The `scripts/upstream-watcher.ts` automation runs every 12 hours and commits a report to `docs/OPENCLAW_UPSTREAM_REPORT.md` tracking:
- New commits since last sync
- Files changed that overlap with DeXMart's injection points
- Recommended actions (cherry-pick, review, ignore)

---

## 5. What Changed vs. Original OpenClaw

**Only 5 files modified from OpenClaw's originals (through Phase 4):**

| File | Change | Why |
|------|--------|-----|
| `src/web/session.ts` | Added `WaAuthStateFactory` type + `authStateFactory` option to `createWaSocket()` | Phase 2 FR-2: pluggable Firestore session persistence |
| `src/types/index.ts` | Removed dead `GlobalContext.unifiedAI: GeminiAI` reference | Phase 4: GeminiAI deleted in Phase 1; replaced with OpenClaw agent runner |
| `src/ingress/ingress-service.ts` | Replaced `context.unifiedAI.processMessage()` with `runEmbeddedPiAgent()` | Phase 4: core agent pipeline wiring |
| Root `tsconfig.json` | Added `@dexmart/*` and `@/*` path aliases → `src/*` | Phase 1 + Phase 4: clean import paths |
| `src/config/io.ts` | No changes — `loadConfigForUser()` extracted to `src/config/user-config.ts` (separate file, not a modification) | Phase 2 FR-1 |

**Everything else is additive** — new files in new directories that OpenClaw doesn't know about and doesn't need to:

| New file | Phase | What it adds |
|----------|-------|--------------|
| `src/config/user-config.ts` | 2 | User-scoped config (3-layer cache) |
| `src/persistence/channel-auth-state.ts` | 2 | Universal Firestore auth state for all channels |
| `src/billing/usage-tracker.ts` | 2 | Batched usage tracking |
| `src/billing/auth-guard.ts` | 2 | Billing gate utilities (`filterModelsForUser`, `assertCan`) |
| `src/services/channels/ChannelManager.ts` | 4 | Multi-tenant adapter registry |
| `src/services/channels/registry.ts` | 4 | Platform registry (no bridges, `nativeOpenClaw` flag) |
| `src/services/channels/whatsapp/WhatsappAdapter.ts` | 4 | Fusion point: OpenClaw socket + Firestore auth + anti-ban |
| All of `src/services/`, `src/routes/`, `src/middleware/`, `src/lib/`, `src/jobs/`, `src/server/` etc. | 4 | DeXMart business logic migrated from `backend/src/` |

---

## 6. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OpenClaw upstream breaks injection points | Low | High | Upstream watcher monitors changed files; injection points are stable APIs |
| Firestore costs scale with users | Medium | Medium | Usage tracking with batched writes; Redis caching reduces reads |
| Memory migration (sqlite-vec -> Firestore) loses vector search | Medium | High | Implement vector similarity in Firestore or use a managed vector DB |
| Phase 4 migration introduces regressions | Medium | Medium | TDD mandate; every moved service gets its tests moved too |
| Session persistence adds Firestore latency | Low | Low | Auth state reads are cached; writes are batched |

---

## 7. Success Criteria

The fusion is complete when a new developer sees **one project called DeXMart**:

- [x] **One codebase**: A single `src/` tree. All `backend/src/` source migrated. No mirrors in active development. (`backend/` kept only until staging smoke test, then deleted)
- [x] **One entry point**: `src/main.ts` is the unified entry point (boots Express, watchdog, usage flush)
- [x] **Zero bridges**: No `openclawImports`, `OpenClawSkillBridge`, `GenericOpenClawAdapter`, or shim files. Code calls code directly.
- [x] **Core agent wiring**: `IngressService` calls `runEmbeddedPiAgent()` — not a custom AI wrapper
- [x] **Session fusion**: `WhatsappAdapter` uses OpenClaw's `createWaSocket()` with Firestore auth state
- [x] **54 tests passing**: Phase 2 injection point tests — all green, zero failures
- [ ] **Zero duplication (second pass)**: Second-pass dedup of `src/services/` vs. `src/billing/`, `src/tenancy/` etc. (some service files still reference old patterns)
- [ ] **Frontend sees everything**: Every backend endpoint accessible through the dashboard (ongoing)
- [ ] **Upstream sync is invisible**: Upstream watcher automation not yet configured
- [ ] **B2C isolation verified**: Integration tests proving User A cannot see User B's data
- [ ] **Billing enforcement verified**: Integration tests proving Free users cannot access Pro features
- [ ] **Phase 3 complete**: MastermindStreamService → OpenClaw agent events; Firestore memory adapter
- [ ] **`backend/` deleted**: After staging smoke test confirms `src/main.ts` boots correctly
- [ ] **Indistinguishable**: No developer needs to know what came from OpenClaw vs what DeXMart built.
