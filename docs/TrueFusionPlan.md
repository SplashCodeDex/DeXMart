# DeXMart: TRUE Fusion Plan

## The Master Plan

> **DeXMart = OpenClaw, but with B2C multi-tenancy, Stripe billing gates, and Firebase email
> auth grounded into the foundation — as if OpenClaw was always built with it.** The DeXMart
> Next.js dashboard completely replaces ControlUI as the sole user-facing interface.
>
> There is no "OpenClaw side" and "DeXMart side." There is only **DeXMart**.

### The Non-Negotiable Rules

1. **Zero duplication** — every function exists exactly once. No mirrors, no copies.
2. **No bridges** — no wrappers, adapters, or shims. Code calls code directly.
3. **Extensions are canonical** — `extensions/` contains the rich, battle-tested channel plugins (polls, reactions, media, pairing, directory). **Never** duplicate channel logic in `src/services/channels/`.
4. **Frontend dominates** — the DeXMart Next.js dashboard is THE UI. ControlUI is upstream heritage, not user-facing.
5. **Centralized elevation** — B2C tenancy, Stripe billing, Firebase auth, and Firestore persistence are injected into OpenClaw's **engine foundation** — not wrapped around it.
6. **One engine** — OpenClaw's `createChannelManager()` + `PluginRegistry` + `extensions/` is the single channel management system. There is no parallel system.
7. **Upstream leverage (no duplication of upstream)** — DeXMart MUST NOT duplicate logic, features, code, or capabilities that OpenClaw already provides. Instead, **leverage and utilize** what upstream offers. This ensures DeXMart automatically adapts to OpenClaw's changelogs — bug fixes, security patches, new features, and performance improvements are inherited through the sync process with zero rework. Before implementing anything new, search `src/` + `extensions/` + `CHANGELOG.md` for existing upstream capability. If it exists → use it. If it partially exists → extend via injection points.
8. **DeXMart-exclusive features are core, not plugins** — Features confirmed (via critical investigation) to be truly DeXMart-exclusive MUST be embedded into the unified project's core natively — in `src/` as first-class modules — not as plugins, sidecars, or secondary citizens. A feature is exclusive only if it does NOT exist upstream AND is fundamentally a B2C/SaaS concern AND would NOT make sense in OpenClaw's single-user mode. See `docs/architecture/UPSTREAM_LEVERAGE_POLICY.md` for the full investigation protocol.

### The Analogy

OpenClaw is to DeXMart what the Linux kernel is to Ubuntu: the engine under the hood that users never see and developers rarely think about as a separate thing.

## Upstream Sync: Managed Fork (Invisible to the Product)

OpenClaw upstream tracked as git remote. Security patches cherry-picked. New features reviewed, adapted, merged manually. This is an implementation detail — no developer needs to know or care about it during normal work.

---

## Phase 1: Repository Restructure ✅ COMPLETE

**Branch**: `fusion/phase-1-restructure`
**Commits**: 2 (`f11789c8b`, `5520f1809`)

### What was done:

- ✅ OpenClaw's 4,040 TS files flattened from `openclaw/src/` into root `src/`
- ✅ OpenClaw's 40 extensions copied to root `extensions/`
- ✅ DeXMart's enterprise services organized into `src/` core modules:
  - `src/billing/`, `src/tenancy/`, `src/persistence/`, `src/campaigns/`
  - `src/safety/`, `src/analytics/`, `src/ingress/`, `src/agents-management/`, `src/auth/`
- ✅ `TenantContext` type created at `src/tenancy/tenant-context.ts`
- ✅ Root `tsconfig.json` created
- ✅ All **bridge/wrapper files deleted** (openclawImports, openClawGateway, OpenClawSkillBridge, GenericOpenClawAdapter, openclaw.d.ts)
- ✅ All **duplicate implementations deleted** (geminiAI, gemini, toolRegistry, skillsManager, memoryService, ChannelAdapter, ChannelManager, ChannelWatchdog, WhatsappAdapter, simple.ts)
- ✅ **8,318 lines of dead code removed**

---

## Phase 2: TenantContext Injection ✅ COMPLETE

**54 tests passing. 5 test files.**

### What was done:

- ✅ `src/config/user-config.ts` — `loadConfigForUser(userId)` with 3-layer cache (memory → Redis → Firestore → fallback). OpenClaw's `loadConfig()` untouched.
- ✅ `src/persistence/channel-auth-state.ts` — `useChannelAuthState(store)` + `makeFirestoreAuthStore(userId, channelId, db)`. Replaces 2 duplicate files (`firestore-auth-state.ts`, `baileysFirestoreAuth.ts`). Works for ALL channels.
- ✅ `src/web/session.ts` — Added `authStateFactory` option to `createWaSocket()`. CLI keeps file-based auth; multi-user gets Firestore.
- ✅ `src/billing/usage-tracker.ts` — `trackUsage()` O(1) hot-path + batched Firestore flush (10s interval). No write per message.
- ✅ `src/billing/auth-guard.ts` — `filterModelsForUser()`, `assertCan()`, `buildGateDeniedMessage()`. Pure functions, zero coupling.
- ✅ `src/tenancy/__tests__/context-resolver.test.ts` — Fixed logger + Firebase mocks; all tests green.

---

## Phase 3: AI Agent Fusion ✅ COMPLETE

- ✅ DeXMart's `geminiAI.ts` DELETED (Phase 1)
- ✅ `IngressService` now calls `runEmbeddedPiAgent()` (Phase 4)
- ✅ `src/analytics/event-listener.ts` — agent event listener wired: `onAgentEvent()` → `MastermindStreamService` → Socket.IO → dashboard. Real-time reasoning events delivered per-user. 32 tests.
- ✅ Tenant-scoped model gating: `filterModelsForUser()` applied in `IngressService` before config is passed to `runEmbeddedPiAgent()`. `buildAllowedModelSet` enforces the restricted model set automatically.
- ✅ `src/memory/hybrid-adapter.ts` — HybridMemoryAdapter (server-side): local sqlite-vec + Firestore text backup (no vectors in cloud). 5-10 rule enforced. Cold-start rehydration. 13 tests.
- ✅ `frontend/src/lib/memory-worker.ts` — client-side WebWorker: Transformers.js (Xenova/all-MiniLM-L6-v2, quantized, 22MB) + IndexedDB (OPFS-backed) + Firestore proxy. Embeddings generated on device.
- ✅ `frontend/src/lib/memory-client.ts` — `useMemory()` React hook: wraps worker, handles model loading progress, Firestore proxy, typed API.

**99 tests across 7 files. All passing.**

> **Memory wiring note**: `HybridMemoryAdapter` is built and tested. The injection point is `src/agents/tools/memory-tool.ts` (calls `getMemorySearchManager` directly). Full wiring requires adding an optional `memoryManager` param to `runEmbeddedPiAgent` — a Phase 5 task. For PoC, the adapter is available and proven correct via tests.

---

## Phase 4: Dissolve backend/ Into src/ ✅ COMPLETE

**All `backend/src/` TypeScript source migrated to `src/`. The `backend/` directory contains only compiled `dist/` pending deletion.**

### What was done:

- ✅ All `backend/src/` directories moved to `src/` with no `dexmart-*` prefixes: `services/`, `routes/`, `middleware/`, `lib/`, `jobs/`, `server/`, `utils/`, `types/`, `commands/`, `events/`, `tools/`, `workers/`, `webhooks/`, `controllers/`
- ✅ `@/*` → `src/*` alias added to root `tsconfig.json`
- ✅ `ChannelWatchdog` dissolved → `ChannelService.startWatchdog()` (new method)
- ✅ `src/main.ts` unified: boots Express + watchdog + usage flush scheduler
- ✅ `MultiTenantApp.shutdown()` drains watchdog + usage tracker on SIGTERM
- ✅ 202 dead `dexmart-*` stub files deleted
- ✅ **`IngressService` → `runEmbeddedPiAgent()`**: core wiring done. DeXMart inbound → OpenClaw agent runtime. `GeminiAI` fully replaced.
- ✅ `GlobalContext.unifiedAI` dead type removed

> [!WARNING]
>
> ### ⚠️ DEPRECATED — Parallel Channel System (Dead End)
>
> The following files were recreated during Phase 4 as a **temporary measure** but represent a
> **dead-end architecture** — a parallel channel management system that duplicates OpenClaw's
> native `createChannelManager()` + `extensions/` plugin infrastructure. They are pending
> removal in Phase 5.
>
> | File                                                | Why It's Wrong                                                                      |
> | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
> | `src/services/channels/ChannelManager.ts`           | Duplicates `gateway/server-channels.ts` `createChannelManager()`                    |
> | `src/services/channels/registry.ts`                 | Duplicates `src/channels/plugins/index.ts` + `src/plugins/registry.ts`              |
> | `src/services/channels/whatsapp/WhatsappAdapter.ts` | Wraps OpenClaw's native WhatsApp extension instead of grounding B2C into the engine |
>
> **DO NOT extend these files.** New channel work belongs in `extensions/` and the native plugin system.

### Remaining before `backend/` can be deleted:

1. Staging smoke test — `src/main.ts` boots, channels reconnect, agent processes messages end-to-end
2. Delete `backend/` directory
3. Remove `backend` from `pnpm-workspace.yaml`

---

## Phase 5: Foundation Grounding ✅ COMPLETE

> **The core of the Master Plan.** B2C multi-tenancy, Stripe billing gates, and Firebase auth
> are injected directly into OpenClaw's engine — specifically its `PluginRuntime`,
> `createChannelManager()`, and `src/web/session.ts` — so every one of the 40+ extensions
> automatically inherits these capabilities without needing individual adapters.

### The Architectural Correction

Phase 4 accidentally created a **parallel channel management system** alongside OpenClaw's native one:

| What Should Exist (One System)                        | What Phase 4 Built (Wrong — Two Systems)                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| OpenClaw's `createChannelManager()` + plugin registry | ✅ Still there, untouched                                               |
| ...with `userId` tenant context at the foundation     | ❌ Separate `ChannelService` + `ChannelManager` singleton built instead |
| ...with `extensions/whatsapp/` as canonical WhatsApp  | ❌ Separate `WhatsappAdapter.ts` built instead                          |
| ...with `extensions/` registry as source of truth     | ❌ Separate `registry.ts` built instead                                 |

Phase 5 corrects this by injecting DeXMart's B2C requirements directly into OpenClaw's engine.

### Tasks:

- [x] **5.1**: Inject `userId` / `TenantContext` into `PluginRuntime` — so `createChannelManager().startChannel()` knows which tenant it's operating for
- [x] **5.2**: Inject Firestore auth into `src/web/session.ts` as the **default** for SaaS mode — not just an opt-in `authStateFactory` parameter
- [x] **5.3**: Inject Stripe billing gates into `gateway/server-channels.ts` — so `startChannelInternal()` checks `assertCan('startChannel')` before booting any plugin
- [x] **5.4**: Make `ChannelService` orchestrate OpenClaw's native `createChannelManager()` — not reinvent it with a separate `AdapterClass` system
- [x] **5.5**: Delete the deprecated parallel system: `WhatsappAdapter.ts`, DeXMart's `ChannelManager.ts`, DeXMart's `registry.ts`
- [x] **5.6**: Wire `HybridMemoryAdapter` into `runEmbeddedPiAgent()` via optional `memoryManager` param
- [x] **5.7**: Verify all 40+ extensions automatically inherit B2C isolation, Stripe gating, and Firestore persistence
- [x] **5.8**: Delete the `backend/` directory, remove `backend` from `pnpm-workspace.yaml`, and update CI/CD scripts — source is fully migrated to `src/` since Phase 4
- [x] **5.9**: Complete `tenants/{tenantId}` → `users/{userId}` path migration — update `FirebaseService.SchemaMap`, Firestore security rules, and all service queries to use the canonical `users/` hierarchy (see `DATA_MODEL.md` Section 9)
- [x] **5.10**: Consolidate `SystemAuthorityService` (legacy, `src/services/`) into `auth-guard.ts` (Phase 2, `src/billing/`) — both perform plan-gated feature enforcement, only one should exist

---

## Phase 6: ControlUI Replacement 🔲 PLANNED

> DeXMart's Next.js dashboard is **THE** user interface. ControlUI (OpenClaw's built-in
> web interface at `:18789`) is the upstream heritage UI and is **not user-facing** in DeXMart.

### Tasks:

- [ ] **6.1**: Map every ControlUI capability to a DeXMart dashboard feature
- [ ] **6.2**: Ensure the DeXMart dashboard can manage all channel operations (start, stop, QR, pairing, status) through the grounded engine (Phase 5)
- [ ] **6.3**: Remove the `/api/openclaw-ui` proxy from DeXMart's Express routes
- [ ] **6.4**: Document ControlUI as "development-only / upstream debugging tool" — not exposed to end users

---

## DeXMart-Exclusive Features (Core — Not Plugins)

> **Embedding Protocol**: Every feature listed below has been confirmed DeXMart-exclusive via the investigation protocol in `docs/architecture/UPSTREAM_LEVERAGE_POLICY.md` §2. They are embedded into the unified project's core as first-class `src/` modules — not plugins, not sidecars — because they are fundamentally tied to DeXMart's B2C/SaaS identity and would not make sense in OpenClaw's single-user mode. New exclusive features MUST follow the same protocol before being added to this table.

| Feature                | Location                                                         | Purpose                                        |
| ---------------------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| Firebase/Firestore     | `src/persistence/`, `src/lib/`                                   | Cloud persistence layer                        |
| Stripe billing         | `src/billing/`                                                   | Subscriptions, payment                         |
| Plan gating            | `src/billing/system-authority.ts`, `src/billing/auth-guard.ts`   | Feature/model/channel limits                   |
| Multi-tenancy          | `src/tenancy/`                                                   | User-as-tenant isolation (B2C)                 |
| Campaigns              | `src/campaigns/`, `src/services/CampaignService.ts`              | Bulk messaging                                 |
| Anti-ban               | `src/safety/`, `src/services/AntiBanService.ts`                  | Rate limiting                                  |
| Content moderation     | `src/safety/`, `src/services/ContentModeration.ts`               | Safety filters                                 |
| AI analytics           | `src/analytics/`, `src/services/analytics.ts`                    | Usage tracking, audit                          |
| Mastermind stream      | `src/services/MastermindStreamService.ts`                        | Real-time reasoning                            |
| Ingress routing        | `src/ingress/`                                                   | Omnichannel inbound message routing            |
| Agent management       | `src/agents-management/`, `src/services/AgentService.ts`         | Multi-agent CRUD per user                      |
| Dashboard              | `frontend/`                                                      | Next.js management UI (**replaces ControlUI**) |
| Automation/Flows       | `src/services/FlowEngine.ts`, `src/services/FlowService.ts`      | Automation engine                              |
| Contact/Group mgmt     | `src/services/ContactService.ts`, `src/services/GroupService.ts` | CRM features                                   |
| Usage tracking         | `src/billing/usage-tracker.ts`                                   | Batched Firestore writes (Phase 2)             |
| Universal channel auth | `src/persistence/channel-auth-state.ts`                          | Firestore session for all channels (Phase 2)   |
