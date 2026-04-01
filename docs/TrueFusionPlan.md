# DeXMart ↔ OpenClaw: TRUE Fusion Plan

## The Vision (Final, Crystallized)

> **OpenClaw is the engine. Accept it as-is. DeXMart adds exactly two things on top:**
> 1. **Multi-tenancy** — `TenantContext` wraps every OpenClaw operation so one engine serves many users
> 2. **Billing gate** — checks capabilities before OpenClaw acts (select model, start channel, execute tool, run cron)
>
> Everything else is OpenClaw's code, untouched. Plus DeXMart-exclusive features OpenClaw genuinely doesn't have.

## Upstream Sync: Managed Fork
OpenClaw upstream tracked as git remote. Security patches cherry-picked. New features reviewed, adapted, merged manually. Upstream sync is controlled, not dead.

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

## Phase 2: TenantContext Injection (Next)

**Goal**: Make OpenClaw's core tenant-aware without modifying its internal logic. Two injection points:

### 2.1: Config Resolution
- OpenClaw's `loadConfig()` reads a single file → Make it resolve per-tenant from Firestore
- Touch point: `src/config/io.ts` → add `loadConfigForTenant(tenantId)` that reads from Firestore
- OpenClaw's internal code keeps calling `loadConfig()` — we just change WHERE it reads from

### 2.2: Session Persistence
- OpenClaw's sessions use `useMultiFileAuthState(authDir)` (file system)
- Swap to `useFirestoreAuthState(tenantId, channelId)` (already exists in DeXMart)
- Touch point: `src/web/session.ts` → make auth store configurable

### 2.3: Channel Lifecycle
- OpenClaw's `createChannelManager()` manages channels globally
- Enhance to scope channels per tenant
- Use OpenClaw's `startChannelHealthMonitor()` with tenant iteration (replaces ChannelWatchdog)

### 2.4: Billing Gates
- Wire `SystemAuthorityService` checks into:
  - `src/agents/model-selection.ts` → intersect available models with `ctx.capabilities.models`
  - `src/gateway/server-channels.ts` → check `ctx.capabilities.maxChannels` before starting
  - `src/agents/openclaw-tools.ts` → check `ctx.capabilities.features` before tool execution
  - `src/cron/` → check plan before scheduling

---

## Phase 3: AI Agent Fusion

- DeXMart's `geminiAI.ts` is DELETED (done ✅)
- OpenClaw's `pi-embedded-runner` IS the agent system
- Add tenant-scoped model gating: `capabilities.models` filter in model selection
- Hook `MastermindStreamService` into OpenClaw's `onAgentEvent()`
- Swap OpenClaw's file-based memory for Firestore-backed memory

---

## Phase 4: Dissolve backend/ Into src/

- Move remaining DeXMart-exclusive services from `backend/src/services/` into appropriate `src/` modules
- Move routes, middleware, server into `src/dexmart-server/` (already started)
- Unify entry point: ONE `src/main.ts`
- Delete `backend/` directory entirely

---

## DeXMart-Exclusive Features (Keep, No OpenClaw Equivalent)

| Feature | Location | Purpose |
|---|---|---|
| Firebase/Firestore | `src/persistence/` | Cloud persistence layer |
| Stripe billing | `src/billing/` | Subscriptions, payment |
| Plan gating | `src/billing/system-authority.ts` | Feature/model/channel limits |
| Multi-tenancy | `src/tenancy/` | Tenant isolation |
| Campaigns | `src/campaigns/` | Bulk messaging |
| Anti-ban | `src/safety/anti-ban.ts` | Rate limiting |
| Content moderation | `src/safety/content-moderation.ts` | Safety filters |
| AI analytics | `src/analytics/` | Usage tracking, audit |
| Mastermind stream | `src/analytics/mastermind-stream.ts` | Real-time reasoning |
| Ingress routing | `src/ingress/` | Omnichannel message routing |
| Agent management | `src/agents-management/` | Multi-agent per tenant |
| Dashboard | `frontend/` | Next.js management UI |
| Automation/Flows | `backend/src/services/` (to move) | Automation engine |
| Contact/Group mgmt | `backend/src/services/` (to move) | CRM features |
