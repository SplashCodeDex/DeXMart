# DeXMart: TRUE Fusion Plan

## The Vision (Final, Crystallized)

> **DeXMart is one project.** OpenClaw is the upstream heritage — the foundation it was built on. After fusion, there is no "OpenClaw side" and "DeXMart side" — there is only DeXMart.
>
> **The non-negotiable rules:**
> - **Zero duplication** — every function exists exactly once. No mirrors, no copies.
> - **No bridges** — no wrappers, adapters, or shims. Code calls code directly.
> - **Frontend dominates** — every backend capability is accessible through the DeXMart Next.js dashboard.
> - **Centralized elevation** — monetization (Stripe), tenant auth (Firebase), cloud persistence (Firestore), and DeXMart-exclusive features apply to the entire project.
>
> OpenClaw is to DeXMart what the Linux kernel is to Ubuntu: the engine under the hood that users never see and developers rarely think about as a separate thing.

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

## Phase 3: AI Agent Fusion 🔄 IN PROGRESS

- ✅ DeXMart's `geminiAI.ts` DELETED (Phase 1)
- ✅ `IngressService` now calls `runEmbeddedPiAgent()` (Phase 4 — see below)
- ⏳ Hook `MastermindStreamService` into the agent event emitter (`onAgentEvent()`)
- ⏳ Add tenant-scoped model gating: `filterModelsForUser()` pre-filter in model selector
- ⏳ Swap file-based sqlite-vec memory for Firestore-backed memory adapter

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
- ✅ `src/services/channels/ChannelManager.ts` recreated + enhanced with `getAdaptersForUser()`, `shutdownUserAdapters()`
- ✅ `src/services/channels/registry.ts` recreated — `GenericOpenClawAdapter` bridge gone; `nativeOpenClaw` flag for MSTeams/Matrix/Facebook
- ✅ `src/services/channels/whatsapp/WhatsappAdapter.ts` — **fusion point**: OpenClaw `createWaSocket()` + Firestore auth (Phase 2 FR-2) + anti-ban queue
- ✅ **`IngressService` → `runEmbeddedPiAgent()`**: core wiring done. DeXMart inbound → OpenClaw agent runtime. `GeminiAI` fully replaced.
- ✅ `GlobalContext.unifiedAI` dead type removed

### Remaining before `backend/` can be deleted:
1. Staging smoke test — `src/main.ts` boots, channels reconnect, agent processes messages end-to-end
2. Delete `backend/` directory
3. Remove `backend` from `pnpm-workspace.yaml`

---

## DeXMart-Exclusive Features (Core — Not Plugins)

| Feature | Location | Purpose |
|---|---|---|
| Firebase/Firestore | `src/persistence/`, `src/lib/` | Cloud persistence layer |
| Stripe billing | `src/billing/` | Subscriptions, payment |
| Plan gating | `src/billing/system-authority.ts`, `src/billing/auth-guard.ts` | Feature/model/channel limits |
| Multi-tenancy | `src/tenancy/` | User-as-tenant isolation (B2C) |
| Campaigns | `src/campaigns/`, `src/services/CampaignService.ts` | Bulk messaging |
| Anti-ban | `src/safety/`, `src/services/AntiBanService.ts` | Rate limiting |
| Content moderation | `src/safety/`, `src/services/ContentModeration.ts` | Safety filters |
| AI analytics | `src/analytics/`, `src/services/analytics.ts` | Usage tracking, audit |
| Mastermind stream | `src/services/MastermindStreamService.ts` | Real-time reasoning (Phase 3 pending) |
| Ingress routing | `src/ingress/` | Omnichannel inbound message routing |
| Agent management | `src/agents-management/`, `src/services/AgentService.ts` | Multi-agent CRUD per user |
| Dashboard | `frontend/` | Next.js management UI |
| Automation/Flows | `src/services/FlowEngine.ts`, `src/services/FlowService.ts` | Automation engine |
| Contact/Group mgmt | `src/services/ContactService.ts`, `src/services/GroupService.ts` | CRM features |
| Usage tracking | `src/billing/usage-tracker.ts` | Batched Firestore writes (Phase 2) |
| Universal channel auth | `src/persistence/channel-auth-state.ts` | Firestore session for all channels (Phase 2) |
