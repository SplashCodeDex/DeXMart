# DeXMart Architecture Blueprint

> **Last verified**: 2026-04-10 | **Branch**: `fusion/phase-1-restructure` | **Status**: True Fusion Complete — unified `src/` tree, no legacy directories

---

## 1. Vision

**DeXMart is one project.** It is a B2C multi-tenant omnichannel AI automation platform built on top of the OpenClaw engine. After fusion, there is no "OpenClaw side" and "DeXMart side" -- there is only **DeXMart**.

### The Fusion Contract

> OpenClaw is the upstream heritage -- the foundation DeXMart was built on. But the result is a single, indistinguishable codebase. There are:
>
> - **No bridges, wrappers, or adapters** between "OpenClaw code" and "DeXMart code"
> - **No duplicated functions or features** -- every capability has exactly one implementation
> - **No mirrors** -- code exists in one place only (not in both `backend/` and `src/`)
> - **No separate identity** -- the project IS DeXMart, full stop
>
> OpenClaw is to DeXMart what WebKit is to Safari: the engine under the hood that users never see and developers rarely think about as a separate thing.

### What DeXMart Elevates

The entire OpenClaw engine is elevated with enterprise-grade capabilities that apply to the whole project:

1. **Monetization** -- Stripe subscriptions gate every feature (models, channels, tools, agents) by plan tier
2. **Tenant authentication** -- Gmail/email OAuth via Firebase Auth, every user isolated by `userId`
3. **Cloud persistence** -- Firestore replaces all file-based storage (sessions, config, memory)
4. **DeXMart-exclusive features** -- campaigns, anti-ban, content moderation, Mastermind stream, analytics, visual flows -- centralized for the entire project
5. **DeXMart frontend** -- the Next.js dashboard is THE UI; every backend endpoint (including those originating from OpenClaw's engine) is accessible through it

### The End State

After fusion is complete, a new developer joining the project sees **one codebase called DeXMart**. They don't need to know what came from OpenClaw and what was built by DeXMart. The distinction exists only for upstream sync purposes (cherry-picking security patches from OpenClaw's repo).

**The user model is B2C** (like Spotify or CapCut): every user IS the tenant. No teams, orgs, or admin/editor roles. Shared infrastructure with logical isolation -- `userId` tags everything.

---

## 2. Guiding Principles

| Principle | Description |
|-----------|-------------|
| **One Project** | There is no "OpenClaw part" and "DeXMart part". There is only DeXMart. OpenClaw is the upstream heritage, not a visible boundary. |
| **Zero Duplication** | Every function, feature, and service exists exactly once. No mirrors, no copies, no bridges, no wrappers, no adapters. |
| **Frontend Dominates** | The DeXMart Next.js dashboard is THE user interface. Every backend endpoint -- regardless of its upstream origin -- must be accessible through it. |
| **Centralized Elevation** | Monetization (Stripe), tenant auth (Firebase), cloud persistence (Firestore), and DeXMart-exclusive features are applied to the entire project, not bolted onto a side. |
| **Managed Upstream** | OpenClaw upstream tracked as git remote for security patches and feature review. The sync is invisible to the product -- it's an implementation detail. |
| **Cloud-Native Persistence** | No file-based sessions or configs. Everything goes to Firestore with Redis caching. Scales horizontally. |
| **Zero-Trust Tenancy** | Every data operation is scoped by `userId`. Firestore security rules enforce isolation. No cross-user data leakage is possible. |
| **TDD First** | Red -> Green -> Refactor. Every feature starts with a failing test. |

---

## 3. High-Level Architecture

```
+------------------------------------------------------------------+
|                        End Users (Browser)                        |
+------------------------------------------------------------------+
            |                                    |
        HTTPS/WSS                           HTTPS/WSS
            |                                    |
+-----------v-----------+          +-------------v--------------+
|   Frontend (Next.js)  |          |  External Channels         |
|   Port 3000           |          |  (WhatsApp, Telegram,      |
|   App Router + RSC    |          |   Discord, Slack, Signal,  |
|   Tailwind + Zustand  |          |   40+ via OpenClaw)        |
+-----------+-----------+          +-------------+--------------+
            |                                    |
        REST + WS                         Webhooks / WS
            |                                    |
+-----------v------------------------------------v--------------+
|                   DeXMart Backend (src/)                       |
|                   One codebase. One project.                  |
|                                                               |
|  Capabilities (all part of DeXMart):                          |
|                                                               |
|  - AI Agent Runtime (pi-embedded-runner, 13+ model providers) |
|  - 40+ Channel Plugins (WhatsApp, Telegram, Discord, etc.)   |
|  - Tool/Skill Registry + Memory System                        |
|  - UserContext + AuthGuard (B2C tenant isolation)             |
|  - BillingGate + Stripe (monetization for all features)      |
|  - Firebase Persistence (cloud sessions, config, data)       |
|  - Campaign Engine + Anti-Ban/Safety                          |
|  - Analytics + Mastermind Stream (real-time reasoning)        |
|  - Ingress Routing + Agent Management                         |
|  - Automation Flows + Webhook Forwarding                      |
|  - Health Monitor + Gateway (HTTP + WebSocket)                |
|                                                               |
+-------+-----------+-----------+-----------+-------------------+
        |           |           |           |
   +----v----+ +----v----+ +----v----+ +----v----+
   |Firestore| | Redis   | | BullMQ  | | Stripe  |
   |(Primary)| | (Cache) | | (Jobs)  | |(Billing)|
   +---------+ +---------+ +---------+ +---------+
```

---

## 4. Package Structure (Monorepo)

```
DeXMart/                          # Root -- pnpm workspace
|
+-- src/                          # THE DeXMart CODEBASE (one project, one tree)
|   |
|   +-- [AI & Agent Runtime]     # OpenClaw heritage — never modified internally
|   |   +-- agents/              # pi-embedded-runner, model selection, tools
|   |   +-- providers/           # 13+ AI model providers (Gemini, Claude, GPT, etc.)
|   |   +-- memory/              # Vector memory (sqlite-vec)
|   |   +-- commands/            # Bot command system (OpenClaw + DeXMart subdirs)
|   |
|   +-- [Channel Plugins]        # 40+ messaging platforms
|   |   +-- web/                 # WhatsApp (Baileys 7.0) — OpenClaw engine
|   |   +-- telegram/            # Telegram (grammy)
|   |   +-- discord/             # Discord (discord.js)
|   |   +-- slack/               # Slack (@slack/bolt)
|   |   +-- signal/              # Signal
|   |   +-- facebook/            # Facebook Messenger
|   |   +-- imessage/            # iMessage
|   |   +-- line/, matrix/, ...  # 35+ more channels
|   |   +-- channels/            # Generic channel abstractions
|   |   +-- routing/             # Message routing
|   |   +-- services/channels/   # DeXMart adapter registry + WhatsappAdapter
|   |
|   +-- [Platform Infrastructure]
|   |   +-- gateway/             # Hono HTTP gateway + channel health monitor
|   |   +-- plugins/             # Plugin system
|   |   +-- plugin-sdk/          # Plugin SDK exports
|   |   +-- config/              # OpenClaw config loading (io.ts, user-config.ts)
|   |   +-- infra/               # Health checks, monitoring
|   |   +-- media/               # Media processing
|   |   +-- cli/                 # CLI tools
|   |
|   +-- [Tenant & Billing]       # B2C monetization + isolation
|   |   +-- tenancy/             # UserContext, AuthGuard, context resolver
|   |   +-- billing/             # Stripe, plan gating, usage tracking, auth-guard
|   |   +-- auth/                # Authentication layer (Firebase Auth)
|   |
|   +-- [Persistence & Data]     # Cloud-native storage
|   |   +-- persistence/         # Firebase/Firestore, channel auth state (FR-2)
|   |   +-- analytics/           # Usage tracking, Mastermind stream
|   |   +-- lib/                 # Firebase admin init, Redis, context (from backend)
|   |
|   +-- [Business Features]      # DeXMart-exclusive capabilities
|   |   +-- campaigns/           # Bulk messaging with anti-ban
|   |   +-- safety/              # Anti-ban, content moderation
|   |   +-- ingress/             # Omnichannel inbound routing → OpenClaw agent
|   |   +-- agents-management/   # Multi-agent CRUD per user
|   |
|   +-- [Server & API]           # HTTP server, routes, middleware (Phase 4 migration)
|   |   +-- server/              # Express app (MultiTenantApp)
|   |   +-- routes/              # Express route handlers
|   |   +-- middleware/          # Auth, security, rate limiting
|   |   +-- jobs/                # BullMQ workers
|   |   +-- dexmart-config/      # ConfigManager, env validation (renamed: conflict avoidance)
|   |   +-- utils/               # Helpers, validators (OpenClaw + DeXMart)
|   |   +-- types/               # Type definitions (OpenClaw + DeXMart)
|   |   +-- workers/             # Queue workers (whatsapp, campaign, media)
|   |   +-- controllers/         # Express controllers
|   |   +-- events/              # Event emitters
|   |   +-- tools/               # Tool definitions
|   |   +-- webhooks/            # Webhook handlers
|   |
|   +-- main.ts                  # UNIFIED entry point (boots Express + watchdog + usage flush)
|
+-- extensions/                  # OpenClaw extension plugins (40+)
|
+-- frontend/                    # Next.js 16 dashboard
|   +-- src/
|       +-- app/                 # App Router (thin wrappers)
|       +-- features/            # Self-contained business modules
|       +-- components/          # UI primitives + layouts
|       +-- server/dal/          # Data Access Layer
|       +-- stores/              # Zustand stores
|       +-- lib/                 # Client utilities
|
+-- backend/                     # LEGACY — source migrated to src/ in Phase 4
|   |                            # dist/ kept as reference; delete after staging smoke test
|   +-- dist/                    # Compiled JS only (source is now in src/)
|
+-- shared/                      # @DeXMart/shared -- cross-package Zod schemas
|   +-- src/schemas/
|       +-- billingSchemas.ts
|       +-- omnichannelSchemas.ts
|       +-- automationSchemas.ts
|       +-- webhookSchemas.ts
|
+-- openclaw/                    # REFERENCE ONLY (upstream sync source)
|
+-- conductor/                   # Project planning & track management
|
+-- docs/                        # Architecture & technical documentation
```

---

## 5. Technology Stack

| Layer | Technology | Version | Role |
|-------|-----------|---------|------|
| **Runtime** | Node.js | 24+ | Server runtime (strict ESM) |
| **Language** | TypeScript | 5.9.3 | Strict mode everywhere |
| **Frontend** | Next.js | 16.1.6 | App Router, Turbopack, PPR |
| **UI Library** | React | 19.2.3 | Server Components, React Compiler |
| **Styling** | Tailwind CSS | 4.1.18 | CSS-first configuration |
| **Client State** | Zustand | 5.0.10 | Minimal client-side stores |
| **Backend HTTP** | Express | 5.2.1 | DeXMart API server |
| **Gateway HTTP** | Hono | 4.11.10 | OpenClaw gateway server |
| **WhatsApp** | Baileys | 7.0.0 | WhatsApp Web protocol |
| **Telegram** | grammY | 1.41.0 | Telegram Bot API |
| **Discord** | discord.js | 14.25.1 | Discord gateway |
| **Agent Runtime** | pi-embedded-runner | Built-in | OpenClaw's agent execution |
| **AI Providers** | 13+ providers | Various | Gemini, Claude, GPT, Ollama, etc. |
| **Database** | Firestore | Firebase Admin 13 | Primary data store |
| **Auth** | Firebase Auth | Admin SDK 13 | JWT + OAuth |
| **Cache** | Redis (ioredis) | 5.9.2 | Session/config caching |
| **Jobs** | BullMQ | 5.66.5 | Background job processing |
| **Payments** | Stripe | 20.2.0 | Subscriptions, billing |
| **WebSocket** | Socket.io | 4.8.3 | Real-time UI updates |
| **Logging** | Pino | 10.2+ | Structured JSON logging |
| **Observability** | OpenTelemetry | Auto | Traces and metrics |
| **Testing** | Vitest | 4.1.2 | All test suites |
| **Validation** | Zod | 4.3.5 | All I/O boundaries |

---

## 6. Component Relationships

### 6.1 Request Authorization Flow

Every request passes through two checks before reaching any DeXMart capability:

```
                   Incoming Request
                         |
                         v
              +---------------------+
              | UserContext Resolver |  <-- WHO is this?
              | (JWT -> userId ->   |
              |  Firestore lookup)  |
              +----------+----------+
                         |
                    UserContext
                    { userId, plan,
                      capabilities }
                         |
                         v
              +---------------------+
              |    AuthGuard +      |  <-- WHAT can they do?
              |    BillingGate      |
              | (can I use this     |
              |  model/channel/     |
              |  feature?)          |
              +----------+----------+
                         |
                   Allowed / Denied
                         |
                         v
              +---------------------+
              | DeXMart Core        |  <-- The unified engine
              | (agent runtime,     |
              |  channel plugins,   |
              |  tool execution,    |
              |  campaigns, flows)  |
              +---------------------+
```

There is no "hand-off" from DeXMart to OpenClaw. The agent runtime, channel plugins, and tool system ARE DeXMart. The authorization layer is simply the front door.

### 6.2 Message Processing Pipeline

```
External Channel (WhatsApp/Telegram/etc.)
         |
         v
  Channel Webhook Route
         |
         v
  Message Normalizer --> CommonMessage format
         |
         v
  IngressService.handleCommonMessage()
         |
         +-- 1. Deduplication (clock skew tolerance)
         +-- 2. Agent Resolution (from path or system_default)
         +-- 3. Priority-Based Routing:
         |       |
         |       +-- Priority 1: Automations (message_received trigger)
         |       +-- Priority 2: Visual Flows (FlowEngine)
         |       +-- Priority 3: AI Agent (pi-embedded-runner)
         |       +-- Priority 4: Webhooks (fallback forwarding)
         |
         +-- 4. Analytics Tracking
         +-- 5. Response sent to user
```

### 6.3 Frontend-Backend Communication

```
Frontend (Next.js 16)
  |
  +-- Server Components --> DAL (server/dal/) --> Firestore direct
  |
  +-- Client Components --> REST API (/api/*) --> Backend Express
  |                                                    |
  +-- Real-time ---------> WebSocket (Socket.io) <-----+
       (Mastermind Stream,                        (MastermindStreamService
        Channel Status,                            emits reasoning events)
        QR Codes)
```

---

## 7. Security Architecture

| Layer | Mechanism | Implementation |
|-------|-----------|----------------|
| **Authentication** | Firebase Auth + JWT | `authMiddleware.ts` verifies tokens on every request |
| **Authorization** | UserContext + AuthGuard | Every operation checks `ctx.userId` ownership |
| **Data Isolation** | Firestore subcollections | All paths scoped: `/users/{userId}/...` |
| **API Security** | Helmet + CSRF + CORS | `httpSecurity.ts`, Express middleware chain |
| **Rate Limiting** | Per-user, per-command, global | `rateLimiter.ts` with Redis backing |
| **Input Validation** | Zod schemas | Every API boundary validated before processing |
| **Plan Enforcement** | BillingGate | `planMiddleware.ts` checks subscription tier |
| **Content Safety** | Moderation service | `content-moderation.ts` filters harmful content |
| **Anti-Ban** | Velocity + cooldown rules | `anti-ban.ts` prevents WhatsApp account bans |

---

## 8. Deployment Topology

```
+-------------------+     +-------------------+     +-------------------+
|  Frontend         |     |  Backend          |     |  OpenClaw Gateway |
|  Next.js          |     |  Express API      |     |  Hono HTTP + WS   |
|  Port 3000        |     |  Port 3001        |     |  Port 18789       |
|  (Vercel/Docker)  |     |  Port 3002 (WS)   |     |  (Proxied via     |
|                   |     |                   |     |   /api/openclaw-ui)|
+--------+----------+     +--------+----------+     +--------+----------+
         |                         |                          |
         +-------------------------+--------------------------+
                                   |
                    +--------------+--------------+
                    |        Infrastructure       |
                    |                             |
                    |  Firestore  Redis  Stripe   |
                    |  Firebase   BullMQ          |
                    +-----------------------------+
```

---

## 9. Key Design Decisions

### 9.1 Why B2C, Not B2B2C?
The user IS the tenant. This eliminates team management complexity, role hierarchies, and org-level billing. Every resource is tagged by `userId`. This is the Spotify/CapCut model -- simple, scalable, and proven.

### 9.2 Why One Codebase, Not a Plugin?
OpenClaw's plugin SDK is designed for extensions (new channels, tools). DeXMart's needs (multi-tenancy, billing gates, cloud persistence) require touching core injection points (config loading, session persistence, model selection). A managed fork gives control over these touch points. But critically, the result is **one project** -- there is no runtime boundary between "OpenClaw code" and "DeXMart code". A developer working on the agent runtime and a developer working on billing are both working on DeXMart.

### 9.3 Why Zero Duplication?
Having `openclaw/src/`, `backend/src/`, and `src/` created import path chaos, duplicate implementations (geminiAI existed in 3 places), and bridges that added complexity without value. The fusion mandate: **every function exists exactly once, in one place**. No mirrors, no bridges, no wrappers. If something needs to change, you change it in one file.

### 9.4 Why Firestore Over Postgres?
- Real-time listeners (subscriptions) for live dashboard updates
- Hierarchical document model maps naturally to user -> agent -> channel
- Firebase Auth integration is seamless
- Serverless scaling without connection pooling
- Security rules enforce tenant isolation at the database level

### 9.5 Why Flatten Into src/?
One `src/` tree means one project. TypeScript path aliases (`@dexmart/*`, `@/*`) provide clean imports. No developer needs to ask "is this the OpenClaw version or the DeXMart version?" -- there is only one version.

### 9.6 Why DeXMart Frontend Dominates?
Every backend endpoint must be accessible from the DeXMart Next.js dashboard. If the engine supports an agent feature, the dashboard surfaces it. If the engine connects a channel, the dashboard shows its status. The frontend IS the product experience -- the backend (regardless of its upstream origin) serves it.

---

## 10. Module Dependency Map

```
tenancy/
  +-- context-resolver.ts     depends on: persistence/firebase, Redis
  +-- tenant-context.ts       depends on: (types only, no runtime deps)

billing/
  +-- auth-guard.ts           depends on: tenancy/tenant-context
  +-- usage-tracker.ts        depends on: persistence/firebase
  +-- billing-service.ts      depends on: Stripe SDK

persistence/
  +-- channel-auth-state.ts   depends on: persistence/firebase
  +-- firebase.ts             depends on: Firebase Admin SDK

config/
  +-- user-config.ts          depends on: persistence/firebase, Redis

ingress/
  +-- IngressService.ts       depends on: agents-management/, analytics/, tenancy/

agents-management/
  +-- AgentService.ts         depends on: persistence/, tenancy/

campaigns/
  +-- CampaignService.ts      depends on: safety/, persistence/, BullMQ

safety/
  +-- anti-ban.ts             depends on: Redis (rate tracking)
  +-- content-moderation.ts   depends on: (self-contained)

analytics/
  +-- mastermind-stream.ts    depends on: Socket.io, tenancy/
  +-- usage-tracker.ts        depends on: persistence/firebase

[The agent runtime, channel plugins, and tool system have their own
 internal dependency graph -- they are part of DeXMart, inherited
 from the OpenClaw upstream]
```

---

## 11. Subscription Tiers & Capabilities

| Capability | Free | Starter | Pro | Enterprise |
|-----------|------|---------|-----|------------|
| Channels | 1 | 3 | 10 | Unlimited |
| Agents | 1 | 3 | 10 | Unlimited |
| Messages/month | 500 | 5,000 | 50,000 | Unlimited |
| AI Models | Basic (1) | Standard (3) | Premium (8) | All (13+) |
| Campaigns | -- | Basic | Advanced | Full |
| Automations/Flows | -- | 5 | 50 | Unlimited |
| Mastermind Stream | -- | -- | Yes | Yes |
| Anti-Ban System | Basic | Standard | Advanced | Custom |
| Support | Community | Email | Priority | Dedicated |

Capabilities are defined in `PLAN_CAPABILITIES` (`src/tenancy/tenant-context.ts`) and enforced by `AuthGuard` (`src/billing/auth-guard.ts`).

---

## 12. Cross-References

| Document | Purpose |
|----------|---------|
| [SYSTEM_DIAGRAMS.md](./SYSTEM_DIAGRAMS.md) | All Mermaid diagrams (C4, sequence, data flow) |
| [FUSION_STRATEGY.md](./FUSION_STRATEGY.md) | Detailed True Fusion approach, phases, injection points |
| [DATA_MODEL.md](./DATA_MODEL.md) | Firestore schema, caching, session management |
| [SERVICE_CATALOG.md](./SERVICE_CATALOG.md) | Complete service reference with dependencies |
| [../TrueFusionPlan.md](../TrueFusionPlan.md) | Original fusion plan (canonical source) |
| [../../conductor/product.md](../../conductor/product.md) | Product vision and features |
| [../../conductor/tech-stack.md](../../conductor/tech-stack.md) | Technology choices |
| [../../conductor/workflow.md](../../conductor/workflow.md) | TDD workflow and quality gates |
