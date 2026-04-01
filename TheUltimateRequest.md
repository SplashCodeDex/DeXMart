# DeXMart ↔ OpenClaw: TRUE Fusion Plan (Revised)

## Design Principles

Before diving into phases, these are the non-negotiable principles driving every decision:

### 1. Managed Fork, Not Divorce
OpenClaw upstream is tracked as a git remote. Security patches and bugfixes are cherry-picked. New features and breaking changes are reviewed, tested, and adapted manually. Upstream sync is **controlled, not dead**.

### 2. Enterprise Features Are Core, Not Plugins
Billing, multi-tenancy, Firebase, Firestore, campaigns, anti-ban, content moderation, analytics, audit logging — these are **load-bearing platform infrastructure**. They live in `src/` at the same level as `agents/`, `channels/`, `gateway/`. They are not optional, togglable, or relegated to an extensions directory. They are what makes DeXMart enterprise-grade — like Notion's billing or Figma's auth.

### 3. One Codebase, One Process, One Identity
After fusion, there is no `backend/` vs `openclaw/` distinction. There is `src/` — one project, one server, one entry point. DeXMart IS OpenClaw, enhanced.

---

## Target Directory Structure

```
DeXMart/
├── src/
│   ├── main.ts                          ← ONE entry point
│   │
│   │── ─── OpenClaw Engine (forked) ──────────────
│   ├── agents/                          ← AI agent system (454 files)
│   │   ├── pi-embedded-runner/          ← Core agent execution engine
│   │   ├── model-selection.ts           ← Multi-model with tenant tier gating
│   │   ├── openclaw-tools.ts            ← Tool factory
│   │   ├── skills/                      ← Workspace skills
│   │   ├── subagent-registry.ts         ← Sub-agent orchestration
│   │   └── ...
│   ├── channels/                        ← Channel dock, plugins, registry
│   │   ├── dock.ts                      ← Per-channel capabilities
│   │   ├── registry.ts                  ← Channel metadata
│   │   └── plugins/                     ← Channel plugin system
│   ├── telegram/                        ← Full Telegram (98 files)
│   ├── discord/                         ← Full Discord
│   ├── slack/                           ← Full Slack
│   ├── signal/                          ← Full Signal
│   ├── web/                             ← WhatsApp (Baileys runtime)
│   ├── gateway/                         ← WebSocket + HTTP gateway server
│   │   ├── server.impl.ts              ← Enhanced with TenantContext
│   │   ├── server-channels.ts          ← Per-tenant channel manager
│   │   └── ...
│   ├── config/                          ← Config system (enhanced)
│   │   ├── types.ts                     ← OpenClawConfig types
│   │   ├── io.ts                        ← File-based (dev) + Firestore (prod)
│   │   └── tenant-config.ts             ← Per-tenant config resolution
│   │
│   │── ─── DeXMart Platform (core infrastructure) ──
│   ├── auth/                            ← JWT authentication, Firebase Auth
│   │   ├── jwt.ts
│   │   ├── firebase-auth.ts
│   │   └── middleware.ts
│   ├── billing/                         ← Stripe, subscriptions, plan gating
│   │   ├── stripe.ts
│   │   ├── plans.ts
│   │   └── system-authority.ts          ← Feature/model/channel limits per tier
│   ├── tenancy/                         ← Multi-tenant isolation
│   │   ├── tenant-context.ts            ← TenantContext type definition
│   │   ├── tenant-service.ts            ← CRUD, lifecycle
│   │   ├── tenant-config.ts             ← Per-tenant OpenClawConfig resolution
│   │   └── tenant-scoped-store.ts       ← Firestore session/auth store
│   ├── persistence/                     ← Firebase/Firestore layer
│   │   ├── firebase.ts                  ← Firebase Admin SDK
│   │   ├── firestore-auth-state.ts      ← Baileys auth via Firestore
│   │   └── firestore-sessions.ts        ← Session persistence
│   ├── campaigns/                       ← Bulk messaging, scheduling
│   │   ├── campaign-service.ts
│   │   ├── campaign-worker.ts
│   │   └── templates.ts
│   ├── safety/                          ← Anti-ban, content moderation
│   │   ├── anti-ban.ts
│   │   ├── content-moderation.ts
│   │   └── rate-limiter.ts
│   ├── analytics/                       ← AI analytics, audit trail
│   │   ├── ai-analytics.ts
│   │   ├── audit-service.ts
│   │   └── mastermind-stream.ts         ← Real-time reasoning visibility
│   ├── ingress/                         ← Omnichannel message routing
│   │   ├── ingress-service.ts           ← Unified inbound handler
│   │   ├── automation.ts
│   │   └── flow-engine.ts
│   ├── agents-management/               ← In-app agent CRUD (not OpenClaw agents)
│   │   ├── agent-service.ts             ← Multi-agent per tenant
│   │   └── agent-assignment.ts
│   │
│   │── ─── Shared Infrastructure ─────────────────
│   ├── cache/                           ← Redis/memory cache
│   ├── jobs/                            ← BullMQ job queues
│   ├── socket/                          ← Socket.IO real-time
│   ├── utils/                           ← Shared utilities
│   └── types/                           ← Shared TypeScript types
│
├── extensions/                          ← OPTIONAL channel plugins (user-facing)
│   ├── whatsapp/                        ← WhatsApp channel plugin
│   ├── telegram/                        ← Telegram channel plugin
│   ├── matrix/                          ← Matrix (optional)
│   ├── msteams/                         ← MS Teams (optional)
│   ├── twitch/                          ← Twitch (optional)
│   └── ...                              ← 40+ optional channel extensions
│
├── frontend/                            ← Next.js dashboard
├── shared/                              ← Workspace shared package
└── package.json                         ← ONE package
```

> [!IMPORTANT]
> Notice the distinction:
> - `src/billing/`, `src/tenancy/`, `src/auth/`, `src/campaigns/`, `src/safety/`, `src/analytics/` — **CORE platform infrastructure**. Not optional. Not togglable. Always loaded. These are DeXMart.
> - `extensions/matrix/`, `extensions/twitch/`, `extensions/msteams/` — **Optional channel plugins**. User-facing. Togglable via config. These follow OpenClaw's existing extension pattern.

---

## The TenantContext — The Glue

This is the single abstraction that makes everything tenant-aware without duplicating OpenClaw's subsystems:

```typescript
// src/tenancy/tenant-context.ts

import type { OpenClawConfig } from '../config/types.js';
import type { PlanTier } from '../billing/plans.js';

/**
 * TenantContext flows through EVERY request.
 * It replaces OpenClaw's global loadConfig() with per-tenant resolution.
 * It is NOT optional. It is NOT a plugin. It is the foundation.
 */
export interface TenantContext {
  /** Unique tenant identifier */
  tenantId: string;
  
  /** OpenClaw config resolved from Firestore for this tenant */
  config: OpenClawConfig;
  
  /** Billing tier — determines model access, channel limits, feature gates */
  plan: PlanTier;
  
  /** Resolved feature set based on plan */
  capabilities: {
    models: string[];           // Which AI models this tenant can use
    maxChannels: number;        // How many channels they can have
    maxAgents: number;          // How many agents
    maxMessages: number;        // Monthly message cap
    features: {
      campaigns: boolean;
      antiBan: boolean;
      aiSpinning: boolean;
      customTools: boolean;
      subagents: boolean;
    };
  };
  
  /** Current usage counters */
  usage: {
    messagesThisMonth: number;
    activeChannels: number;
    activeAgents: number;
  };
}
```

Every OpenClaw function that currently does `const cfg = loadConfig()` will instead receive the `TenantContext`'s `config` field. This is surgical — we change where config comes from, not how it's used.

---

## Managed Fork Workflow

### Initial Setup
```bash
# In the DeXMart repo, track upstream
git remote add openclaw-upstream https://github.com/openclaw/openclaw.git
git fetch openclaw-upstream

# Create a branch specifically for tracking upstream changes
git branch openclaw-tracking openclaw-upstream/main
```

### Periodic Sync Process (Weekly/Bi-weekly)
```bash
# 1. Fetch latest upstream
git fetch openclaw-upstream

# 2. Review what changed
git log openclaw-tracking..openclaw-upstream/main --oneline

# 3. For security patches and bugfixes — cherry-pick directly
git cherry-pick <commit-hash>

# 4. For new features — create a review branch
git checkout -b review/openclaw-feature-xyz
git cherry-pick <commit-hash>
# Test, adapt to TenantContext, verify no regression
# Merge to main only after validation

# 5. Update tracking branch
git branch -f openclaw-tracking openclaw-upstream/main
```

### What Flows Easily (Cherry-Pick)
- Security patches (XSS fixes, auth hardening)
- Bug fixes (message dispatch, format parsing, network error handling)
- Dependency updates (Baileys version bump, grammY update)
- Test improvements

### What Requires Manual Adaptation
- New channel plugins → Need TenantContext injection
- Agent system changes → Need tenant-scoped model gating
- Config schema changes → Need Firestore migration
- Gateway API changes → Need frontend API contract update
- Breaking changes → Need careful regression testing

---

## Execution Phases

### Phase 1: Repository Restructure (Week 1-2)
- Flatten `openclaw/src/` into `src/` as the primary source tree
- Move DeXMart's enterprise services into proper `src/` modules (NOT extensions)
- Set up `openclaw-upstream` git remote for managed fork tracking
- Delete all bridge files (`openclawImports.ts`, `openClawGateway.ts`, `OpenClawSkillBridge.ts`)
- Delete thin adapter wrappers (`TelegramAdapter.ts`, `DiscordAdapter.ts`, etc.)
- Verify: project builds, tests pass

### Phase 2: TenantContext Injection (Week 3-6)
- Create `TenantContext` type and `TenantConfigProvider` (Firestore-backed)
- Modify OpenClaw's `loadConfig()` call sites to accept tenant-scoped config
- Modify channel manager to scope channels per tenant
- Modify session management to use Firestore instead of file system
- Wire `SystemAuthorityService` checks into model selection and tool execution
- Verify: multi-tenant config resolution works, channels start per-tenant

### Phase 3: AI Agent Fusion (Week 5-8)
- Replace `geminiAI.ts` with OpenClaw's `pi-embedded-runner`
- Wire tenant tier gating into model selection (`capabilities.models` filter)
- Preserve Mastermind stream by hooking into OpenClaw's `onAgentEvent()`
- Preserve Firebase-backed conversation memory
- Preserve usage recording via `SystemAuthorityService`
- Verify: AI responds using multi-model fallback, billing is enforced

### Phase 4: Tool & Skills Unification (Week 7-9)
- Register DeXMart-exclusive tools (campaigns, anti-ban, etc.) into OpenClaw's tool system via `resolvePluginTools()`
- These are CORE tools that are always available (not optional plugins) — they register unconditionally
- Preserve tier-based tool gating from `skillsManager`
- Verify: all tools execute correctly, tier gating works

### Phase 5: Consolidation & Cleanup (Week 9-10)
- Delete `backend/` directory entirely
- Unify entry point to one `main.ts`
- Update frontend API contracts if gateway endpoints changed
- Run full E2E test suite
- First OpenClaw upstream sync via managed fork workflow
- Verify: complete system works end-to-end

---

## Open Questions

> [!IMPORTANT]
> 1. **Shall I proceed with Phase 1 (Repository Restructure)?** This is the foundation — it's mostly file moves and deletions, relatively low risk, and unblocks everything else.
>
> 2. **Git branching strategy**: Should I create a new branch (e.g., `feat/true-fusion`) for this work, or work on a phase-based branch structure (`fusion/phase-1-restructure`, `fusion/phase-2-tenantcontext`, etc.)?
>
> 3. **Frontend**: The Next.js dashboard currently makes REST calls to `backend/`. After fusion, should it talk to OpenClaw's existing gateway WebSocket protocol, or should we add REST endpoint compatibility to the gateway? (I lean toward adding REST to the gateway — less frontend disruption.)

## Verification Plan

### Per-Phase Verification
| Phase | Command | What It Proves |
|---|---|---|
| 1 | `pnpm build && pnpm test` | Restructured project compiles and existing tests pass |
| 2 | Boot server → multi-tenant Firestore config resolved | TenantContext flows through the system |
| 3 | Send message → get multi-model AI response | Agent system works with tenant gating |
| 4 | AI uses campaign tool → billing checked | Tools unified, tier gating enforced |
| 5 | Full E2E: WhatsApp/Telegram message → AI → response → dashboard | Complete system operational |

### Regression Guard
- OpenClaw's existing test suite runs after every phase
- DeXMart's existing endpoint tests (adapted for new API surface) run after Phase 5
- Manual verification on WhatsApp/Telegram after Phase 3
