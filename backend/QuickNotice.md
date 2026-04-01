# DeXMart ↔ OpenClaw Fusion Audit

## Executive Summary

DeXMart is supposed to be **"OpenClaw but enhanced"** for multi-tenant, payment, and subscription. After deep investigation, the reality is:

> **DeXMart is a parallel system that sits BESIDE OpenClaw, not ON TOP of it.** It treats OpenClaw as a utility library for send functions and skill metadata, while having independently rebuilt most of OpenClaw's core subsystems at a fraction of OpenClaw's sophistication.

---

## The Evidence

### 1. Channel System: Full Duplication

| Subsystem | OpenClaw (battle-tested) | DeXMart (rebuilt from scratch) |
|---|---|---|
| Channel Registry | [registry.ts](file:///home/codedex/projects/DeXMart/openclaw/src/channels/registry.ts) — 8 channels with full capabilities, metadata, aliases, plugin extensibility | [registry.ts](file:///home/codedex/projects/DeXMart/backend/src/services/channels/registry.ts) — 11 entries but just maps to adapter classes |
| Channel Dock system | [dock.ts](file:///home/codedex/projects/DeXMart/openclaw/src/channels/dock.ts) — 636 lines, per-channel capabilities, threading, streaming, grouping, mentions, ACLs | **None** — No equivalent exists |
| Channel Plugin System | [plugins/](file:///home/codedex/projects/DeXMart/openclaw/src/channels) — 46 files: allowlists, mention-gating, command-gating, status reactions, draft streaming, model overrides | **None** — No equivalent exists |
| Telegram | [98 files](file:///home/codedex/projects/DeXMart/openclaw/src/telegram/) — bot handlers (51K), message dispatch (25K), send (41K), sticker cache, inline buttons, reasoning lane coordinators, draft streaming, format wrapping | [1 file](file:///home/codedex/projects/DeXMart/backend/src/services/channels/telegram/TelegramAdapter.ts) — 108 lines, calls `getTelegramSend()` from OpenClaw |
| Discord | OpenClaw: full Discord bot with voice, reactions, threads | DeXMart: [1 file](file:///home/codedex/projects/DeXMart/backend/src/services/channels/discord/DiscordAdapter.ts) — 4K adapter |
| Slack | OpenClaw: Socket Mode, threading, reply-to modes | DeXMart: [1 file](file:///home/codedex/projects/DeXMart/backend/src/services/channels/slack/SlackAdapter.ts) — 5K adapter |

> [!IMPORTANT]
> **The DeXMart adapters delegate `sendMessage()` to OpenClaw's send functions** (via `openclawImports.ts`), but they **completely ignore** OpenClaw's channel dock system, plugin architecture, draft streaming, status reactions, mention gating, threading context, and all the battle-tested plumbing that makes OpenClaw's channels robust.

**What DeXMart adapters actually use from OpenClaw:**
- `sendMessageTelegram()` — the raw send function
- `sendMessageSlack()` — the raw send function
- `sendMessageSignal()`, `sendMessageIMessage()`, `sendMessageDiscord()` — raw sends
- `setActiveWebListener()` — for WhatsApp outbound

**What DeXMart ignores from OpenClaw:**
- All of dock.ts (threading, streaming, ACLs, capabilities)
- All of the channel plugins system (46+ files)
- Bot handlers, message dispatch, formatting, chunking
- Status reactions, mention gating, command gating
- Draft streaming with coalescing
- Network error handling, retry logic

---

### 2. AI/Agent System: Complete Independent Build

| Subsystem | OpenClaw | DeXMart |
|---|---|---|
| Agent engine | **454 files** in [agents/](file:///home/codedex/projects/DeXMart/openclaw/src/agents/) — model selection (18K), model fallback (17K), system prompts (31K), tool policies, subagent orchestration, skill management, session write locks, compaction, sandbox, auth profiles, pi-embedded runner | [geminiAI.ts](file:///home/codedex/projects/DeXMart/backend/src/services/geminiAI.ts) — 988 lines, Gemini-only, custom tool loop |
| Tool system | 20+ built-in tools: browser, canvas, nodes, cron, message, TTS, gateway, sessions, spawn, subagents, image gen, web search/fetch | [toolRegistry.ts](file:///home/codedex/projects/DeXMart/backend/src/services/toolRegistry.ts) — 120 lines, + 10 custom tools in [tools/](file:///home/codedex/projects/DeXMart/backend/src/tools/) |
| Model support | Anthropic, OpenAI, Google, Bedrock, Ollama, HuggingFace, GitHub Copilot, Together, Venice, Minimax, Qwen, Moonshot, Byteplus, Doubao, OpenCode/Zen + provider fallback chains | Gemini only (`gemini.ts`, `geminiAI.ts`) |
| Skills | Full workspace skills discovery, loading, versioning, install, prompt injection, bundled sets | [skillsManager.ts](file:///home/codedex/projects/DeXMart/backend/src/services/skillsManager.ts) — tier-gated wrapper |
| Memory | [memory/](file:///home/codedex/projects/DeXMart/openclaw/src/memory/) — sqlite-vec, session logs, compaction | [memoryService.ts](file:///home/codedex/projects/DeXMart/backend/src/services/memoryService.ts) — Redis/cache based |

> [!CAUTION]
> **DeXMart's AI brain (`geminiAI.ts`) does NOT use OpenClaw's agent runner at all.** It has built its own ReAct loop with Gemini, its own tool execution pipeline, its own conversation memory, and its own system prompt construction. OpenClaw's sophisticated agent system (model fallback chains, auth profile rotation, tool policy enforcement, session transcript repair, context window guards, subagent orchestration) — all of this is **unused**.

---

### 3. Gateway Bridge: Fragile Dynamic Imports

The [openClawGateway.ts](file:///home/codedex/projects/DeXMart/backend/src/services/openClawGateway.ts) (713 lines) is the main integration point. It does this:

```typescript
// Every method does this:
const module = await this.safeImport('../../../openclaw/src/some/module.js');
```

> [!WARNING]
> **Every single OpenClaw interaction goes through relative-path dynamic `import()` calls** that bypass OpenClaw's proper exports. This means:
> 1. **No type safety** — everything is `any`
> 2. **Breaks if OpenClaw refactors internal paths** (which it does regularly)
> 3. **Sideloads OpenClaw code** without its initialization flow
> 4. **Runs OpenClaw's modules in DeXMart's process** without OpenClaw's dependency injection

The [openclawImports.ts](file:///home/codedex/projects/DeXMart/backend/src/utils/openclawImports.ts) utility has 12 functions that all use `../../../openclaw/src/` relative paths instead of proper package exports.

**OpenClaw already provides proper exports** in its [package.json exports map](file:///home/codedex/projects/DeXMart/openclaw/package.json#L37-L84):
```json
"./telegram/send": { "types": "./src/telegram/send.ts", "default": "./dist/telegram/send.js" },
"./discord/send": { ... },
"./slack/send": { ... },
"./signal/send": { ... },
"./web/outbound": { ... },
"./web/active-listener": { ... }
```

But DeXMart ignores ALL of these and uses raw relative imports instead.

---

### 4. What DeXMart Has That OpenClaw Doesn't (Genuine Value-Add)

These are the **production-grade enhancements** that justify DeXMart's existence:

| Feature | File | Purpose |
|---|---|---|
| Multi-tenant isolation | [multiTenantService.ts](file:///home/codedex/projects/DeXMart/backend/src/services/multiTenantService.ts) | Firestore-based tenant management |
| Stripe billing | [stripeService.ts](file:///home/codedex/projects/DeXMart/backend/src/services/stripeService.ts), [billingService.ts](file:///home/codedex/projects/DeXMart/backend/src/services/billingService.ts) | Subscription & payment |
| Plan-based gating | [SystemAuthorityService.ts](file:///home/codedex/projects/DeXMart/backend/src/services/SystemAuthorityService.ts) | Feature/model/channel limits per tier |
| Firebase persistence | [FirebaseService.ts](file:///home/codedex/projects/DeXMart/backend/src/services/FirebaseService.ts) | Cloud Firestore |
| JWT auth | [authSystem.ts](file:///home/codedex/projects/DeXMart/backend/src/services/authSystem.ts) | User authentication |
| Campaign system | [campaignService.ts](file:///home/codedex/projects/DeXMart/backend/src/services/campaignService.ts) | Bulk messaging campaigns |
| Anti-ban | [antiBanService.ts](file:///home/codedex/projects/DeXMart/backend/src/services/antiBanService.ts) | Rate limiting & message spinning |
| Content moderation | [contentModeration.ts](file:///home/codedex/projects/DeXMart/backend/src/services/contentModeration.ts) | Safety filters |
| AI analytics | [aiAnalytics.ts](file:///home/codedex/projects/DeXMart/backend/src/services/aiAnalytics.ts) | Usage tracking |
| Audit logging | [auditService.ts](file:///home/codedex/projects/DeXMart/backend/src/services/auditService.ts) | Compliance trail |
| Tenant config | [tenantConfigService.ts](file:///home/codedex/projects/DeXMart/backend/src/services/tenantConfigService.ts) | Per-tenant settings |
| Agent (in-app) hierarchy | [AgentService.ts](file:///home/codedex/projects/DeXMart/backend/src/services/AgentService.ts) | Multi-agent per tenant |
| Omnichannel ingress | [IngressService.ts](file:///home/codedex/projects/DeXMart/backend/src/services/IngressService.ts) | Unified message routing |
| Mastermind stream | [MastermindStreamService.ts](file:///home/codedex/projects/DeXMart/backend/src/services/MastermindStreamService.ts) | Real-time reasoning visibility |
| Next.js dashboard | [frontend/](file:///home/codedex/projects/DeXMart/frontend/) | Full management UI |

---

## 5. The Core Problem: Sideways Integration, Not Vertical Fusion

```
┌──────────────────────────────────────────────────────────┐
│                    CURRENT ARCHITECTURE                   │
│                                                          │
│  ┌──────────────────┐         ┌─────────────────────┐   │
│  │   DeXMart Backend │         │     OpenClaw         │   │
│  │                    │         │                     │   │
│  │  geminiAI.ts ───┐  │  ╳     │  454-file agent     │   │
│  │  toolRegistry ──┤  │  ╳     │  system             │   │
│  │  skillsManager ─┤  │  ╳     │                     │   │
│  │  memoryService ─┘  │  ╳     │  (COMPLETELY UNUSED) │   │
│  │                    │         │                     │   │
│  │  ChannelService ───┼────────►│  send functions     │   │
│  │  Adapters (thin)───┼────────►│  ONLY               │   │
│  │                    │  ╳     │                     │   │
│  │  (ignores dock,    │  ╳     │  dock, plugins,     │   │
│  │   plugins, draft   │  ╳     │  threading, draft   │   │
│  │   streaming...)    │  ╳     │  streaming...       │   │
│  │                    │         │                     │   │
│  │  openClawGateway ──┼─·····►│  config, sessions,  │   │
│  │  (fragile paths)   │fragile │  cron, health       │   │
│  └──────────────────┘         └─────────────────────┘   │
│                                                          │
│  ╳ = completely disconnected                             │
│  ► = uses via raw relative imports                       │
│  ····► = fragile dynamic import (any-typed)              │
└──────────────────────────────────────────────────────────┘
```

---

## User Review Required

> [!IMPORTANT]
> **This analysis reveals that ~80% of OpenClaw's sophisticated subsystems are completely unused by DeXMart.** The backend essentially uses OpenClaw as a "send message" utility library while running its own parallel AI engine, tool system, and channel management.
>
> The question is: **Do you want to deeply fuse into OpenClaw's actual subsystems, or continue the current pattern?**

## Proposed Strategy: Direct Fusion

If you approve, the fusion would mean:

### Phase 1: Fix the Import Layer (Low-risk, immediate gains)
- Replace all `../../../openclaw/src/` relative imports with proper `openclaw/telegram/send`, `openclaw/discord/send`, etc. package exports
- Add missing exports to OpenClaw's `package.json` exports map for modules DeXMart needs
- Remove the `openclaw.d.ts` ambient module declaration — use real types

### Phase 2: Fuse Channel Adapter Layer (Medium-risk, huge quality gain)
- Make DeXMart's `ChannelAdapter` interface extend/implement OpenClaw's `ChannelDock` capabilities
- Wire into OpenClaw's dock system for threading, streaming, mention-gating, ACLs
- Leverage OpenClaw's bot-handlers/message-dispatch instead of thin wrappers
- Keep DeXMart's multi-tenant routing + Firestore persistence on top

### Phase 3: Fuse AI Agent System (High-risk, highest reward)
- Replace `geminiAI.ts` custom ReAct loop with OpenClaw's `pi-embedded-runner`
- Gain: model fallback chains, auth profile rotation, compaction, context window guards, tool policy enforcement, subagent orchestration
- Keep: DeXMart's tier gating, tenant scoping, Mastermind stream, Firebase memory
- Add: Multi-model support (Anthropic, OpenAI, Bedrock, Ollama, etc.) for free

### Phase 4: Fuse Tool System
- Replace DeXMart's `ToolRegistry` + `OpenClawSkillBridge` with direct consumption of `createOpenClawTools()` output
- Keep DeXMart-exclusive tools (campaigns, anti-ban, etc.) as plugins registered into OpenClaw's tool system

## Open Questions

> [!IMPORTANT]
> 1. **Do you want to proceed with this fusion strategy?** Each phase can be done independently.
> 2. **Phase priority**: Which phase is most valuable to you first? I'd recommend Phase 1 (import fix) since it's zero-risk and unblocks everything else.
> 3. **OpenClaw versioning**: The `openclaw/` directory appears to be a git subtree or a copy of the OpenClaw repo. Do you track upstream? This matters for conflict management during fusion.

## Verification Plan

### Automated Tests
- Run `pnpm --filter backend test:run` after each phase
- Run `pnpm --filter openclaw test:fast` to verify OpenClaw isn't broken
- Verify channel send functions work via existing integration tests

### Manual Verification
- Start backend with `pnpm dev:backend`, verify all channels connect
- Test message sending on Telegram/Discord/Slack after adapter changes
- Verify the dashboard loads correctly after gateway bridge changes
