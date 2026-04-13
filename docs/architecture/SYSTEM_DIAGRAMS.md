# DeXMart System Diagrams

> All diagrams use [Mermaid](https://mermaid.js.org/) syntax and render natively on GitHub, GitLab, and most Markdown viewers.
>
> **Last verified**: 2026-04-03 | **Branch**: `fusion/phase-4-backend-dissolution`

---

## Table of Contents

1. [C4 Context Diagram](#1-c4-context-diagram)
2. [C4 Container Diagram](#2-c4-container-diagram)
3. [Component Diagram -- DeXMart src/](#3-component-diagram--dexmart-src)
4. [Request Authorization Flow](#4-request-authorization-flow)
5. [Message Processing Pipeline](#5-message-processing-pipeline)
6. [Channel Lifecycle Sequence](#6-channel-lifecycle-sequence)
7. [Billing Gate Flow](#7-billing-gate-flow)
8. [Config Resolution Flow](#8-config-resolution-flow)
9. [Session Persistence Flow](#9-session-persistence-flow)
10. [Frontend Data Flow](#10-frontend-data-flow)
11. [Backend Startup Sequence](#11-backend-startup-sequence)
12. [Deployment Topology](#12-deployment-topology)
13. [Monorepo Package Dependencies](#13-monorepo-package-dependencies)
14. [Firestore Data Hierarchy](#14-firestore-data-hierarchy)
15. [Fusion Phase Roadmap](#15-fusion-phase-roadmap)

---

## 1. C4 Context Diagram

The highest-level view: DeXMart and its external actors.

```mermaid
C4Context
    title DeXMart System Context

    Person(user, "End User", "Business owner or marketer managing AI chatbots")
    Person(customer, "End Customer", "Person chatting with the bot on WhatsApp/Telegram/etc.")

    System(dexmart, "DeXMart Platform", "B2C omnichannel AI automation SaaS")

    System_Ext(whatsapp, "WhatsApp", "Meta WhatsApp Web protocol via Baileys")
    System_Ext(telegram, "Telegram", "Telegram Bot API via grammY")
    System_Ext(discord, "Discord", "Discord Gateway via discord.js")
    System_Ext(slack, "Slack", "Slack Events API via @slack/bolt")
    System_Ext(signal, "Signal", "Signal protocol")
    System_Ext(other_channels, "35+ Other Channels", "iMessage, LINE, Matrix, MS Teams, etc.")

    System_Ext(firebase, "Firebase/Firestore", "Authentication, database, storage")
    System_Ext(stripe, "Stripe", "Payment processing, subscriptions")
    System_Ext(redis, "Redis", "Caching, rate limiting, job queues")
    System_Ext(ai_providers, "AI Providers", "Gemini, Claude, GPT, Ollama, Bedrock, etc.")

    Rel(user, dexmart, "Manages bots, agents, campaigns via dashboard")
    Rel(customer, whatsapp, "Sends messages")
    Rel(customer, telegram, "Sends messages")
    Rel(customer, discord, "Sends messages")

    Rel(dexmart, whatsapp, "Connects via Baileys WebSocket")
    Rel(dexmart, telegram, "Connects via Bot API")
    Rel(dexmart, discord, "Connects via Gateway")
    Rel(dexmart, slack, "Connects via Events API")
    Rel(dexmart, signal, "Connects via protocol bridge")
    Rel(dexmart, other_channels, "Connects via OpenClaw plugins")

    Rel(dexmart, firebase, "User data, sessions, config")
    Rel(dexmart, stripe, "Billing, subscriptions")
    Rel(dexmart, redis, "Cache, queues, rate limits")
    Rel(dexmart, ai_providers, "LLM inference requests")
```

---

## 2. C4 Container Diagram

The major runtime containers within DeXMart.

```mermaid
C4Container
    title DeXMart Container Diagram

    Person(user, "End User")
    Person(customer, "End Customer")

    Container_Boundary(dexmart, "DeXMart Platform") {
        Container(frontend, "Frontend", "Next.js 16, React 19", "Dashboard UI with SSR/RSC")
        Container(backend, "Unified Backend Engine", "Express 5 + Hono, Node.js 24+", "REST API, WebSocket, and Channel Gateway")
        Container(workers, "Job Workers", "BullMQ, Node.js", "Campaign processing, media, analytics")
    }

    ContainerDb(firestore, "Firestore", "Firebase", "Primary data store")
    ContainerDb(redis, "Redis", "ioredis", "Cache + job queue backing")
    System_Ext(stripe, "Stripe", "Payments")
    System_Ext(channels, "External Channels", "WhatsApp, Telegram, Discord, etc.")
    System_Ext(ai, "AI Providers", "Gemini, Claude, GPT, etc.")

    Rel(user, frontend, "HTTPS", "Manages bots and campaigns")
    Rel(frontend, backend, "REST + WebSocket", "API calls + real-time updates")
    Rel(backend, firestore, "gRPC", "User data CRUD")
    Rel(backend, redis, "TCP", "Cache reads/writes + job enqueue")
    Rel(backend, stripe, "HTTPS", "Payment operations")
    Rel(backend, ai, "HTTPS", "LLM inference")
    Rel(backend, channels, "WebSocket/HTTPS", "Channel connections via extensions/")
    Rel(workers, redis, "TCP", "Dequeue + process jobs")
    Rel(workers, firestore, "gRPC", "Read/write campaign data")
    Rel(customer, channels, "Native protocol", "Sends/receives messages")
    Rel(channels, backend, "Webhook/WS", "Inbound messages")
```

---

## 3. Component Diagram -- DeXMart src/

How the modules inside `src/` relate to each other. There is no "OpenClaw layer" vs "DeXMart layer" -- it is one project.

```mermaid
graph TB
    subgraph "DeXMart -- AI & Agents"
        AG[agents/<br/>Agent Runtime]
        PR[providers/<br/>13+ AI Model Providers]
        TL[tools/<br/>Tool & Skill Registry]
        MM[memory/<br/>Vector Memory]
        CM[commands/<br/>Bot Commands]
    end

    subgraph "DeXMart -- Channels"
        CH[web/ telegram/ discord/ ...<br/>40+ Channel Plugins]
        RT[routing/<br/>Message Routing]
        GW[gateway/<br/>HTTP + WebSocket Gateway]
    end

    subgraph "DeXMart -- Tenant & Billing"
        TC[tenancy/<br/>UserContext + AuthGuard]
        BL[billing/<br/>BillingGate + Stripe + UsageTracker]
        AU[auth/<br/>Firebase Auth + JWT]
    end

    subgraph "DeXMart -- Business Features"
        IG[ingress/<br/>Omnichannel Message Routing]
        AM[agents-management/<br/>Agent CRUD per User]
        CA[campaigns/<br/>Bulk Messaging]
        SF[safety/<br/>Anti-Ban + Moderation]
        AN[analytics/<br/>Usage Tracking + Mastermind Stream]
    end

    subgraph "DeXMart -- Persistence & Config"
        PS[persistence/<br/>Firebase + Channel Auth State]
        CF[config/<br/>User-Scoped Config Resolution]
    end

    subgraph "DeXMart -- Server Infrastructure"
        SV[server/<br/>Express App Bootstrap]
        MW[middleware/<br/>Auth, Security, Rate Limit]
        RO[routes/<br/>API Route Handlers]
        JB[jobs/<br/>BullMQ Workers]
        LB[lib/<br/>Context Init, Firebase, Logger]
        CN[dexmart-config/<br/>ConfigManager, Env Validation]
    end

    %% Authorization wraps capabilities
    TC -->|authorizes| AG
    TC -->|authorizes| CH
    BL -->|gates| AG
    BL -->|gates| CH
    BL -->|gates| TL
    CF -->|configures| AG
    PS -->|persists sessions for| CH
    IG -->|routes messages to| AG
    IG -->|routes messages to| RT
    AM -->|manages| AG

    %% Business feature deps
    BL --> TC
    IG --> AM
    IG --> AN
    CA --> SF
    AN --> PS

    %% Server infrastructure
    SV --> RO
    RO --> MW
    MW --> AU
    MW --> TC
    RO --> IG
    RO --> AM
    RO --> CA
    RO --> BL
    JB --> CA
    LB --> PS
    LB --> CN

    %% Core engine deps
    AG --> PR
    AG --> TL
    AG --> MM
    GW --> CH
    CH --> RT
```

---

## 4. Request Authorization Flow

How every request is authorized before reaching DeXMart capabilities.

```mermaid
flowchart TD
    REQ[Incoming Request] --> CTX{UserContext<br/>Resolver}

    CTX -->|JWT Token| FW[Firebase Auth<br/>Verify Token]
    CTX -->|Channel ID| CL[Channel Lookup<br/>userId from channelId]
    CTX -->|User ID direct| FS[Firestore Lookup<br/>User Profile + Plan]

    FW --> UC[UserContext Created<br/>userId, plan, capabilities]
    CL --> UC
    FS --> UC

    UC --> GATE{AuthGuard +<br/>BillingGate}

    GATE -->|Model Selection| FM[filterModelsForUser<br/>Intersect with plan capabilities]
    GATE -->|Channel Start| CC[assertCan 'startChannel'<br/>Check maxChannels limit]
    GATE -->|Message Send| MS[assertCan 'sendMessage'<br/>Check monthly quota]
    GATE -->|Feature Access| FA[assertCan 'feature:X'<br/>Check feature flags]

    FM -->|Allowed models only| OC[DeXMart Core<br/>Proceeds with authorized context]
    CC -->|Under limit| OC
    MS -->|Under quota| OC
    FA -->|Feature enabled| OC

    CC -->|Over limit| DENY[HTTP 402<br/>Upgrade Required]
    MS -->|Over quota| DENY
    FA -->|Not in plan| DENY

    style UC fill:#2d6a4f,color:#fff
    style GATE fill:#e76f51,color:#fff
    style OC fill:#264653,color:#fff
    style DENY fill:#d62828,color:#fff
```

---

## 5. Message Processing Pipeline

End-to-end flow of an inbound message from any channel.

```mermaid
sequenceDiagram
    participant Customer
    participant Channel as External Channel<br/>(WhatsApp/Telegram/etc.)
    participant Webhook as Channel Webhook Route
    participant Norm as Message Normalizer
    participant Ingress as IngressService
    participant Dedup as Deduplication
    participant Auto as Automations
    participant Flow as FlowEngine
    participant Agent as AI Agent<br/>(pi-embedded-runner)
    participant Hook as Webhook Forwarder
    participant Analytics as Analytics

    Customer->>Channel: Send message
    Channel->>Webhook: POST /api/webhook/{channelId}
    Webhook->>Norm: Raw message payload
    Norm->>Ingress: CommonMessage format

    Ingress->>Dedup: Check message hash
    alt Duplicate
        Dedup-->>Ingress: Skip (already processed)
    else New message
        Dedup-->>Ingress: Proceed
    end

    Ingress->>Ingress: Resolve Agent (from channelId)

    Note over Ingress: Priority-Based Routing

    Ingress->>Auto: 1. Check automation triggers
    alt Automation matched
        Auto-->>Ingress: Handled
    else No match
        Ingress->>Flow: 2. Check visual flows
        alt Flow matched
            Flow-->>Ingress: Handled
        else No match
            Ingress->>Agent: 3. AI Agent processing
            alt Agent active
                Agent-->>Ingress: AI response
            else No agent
                Ingress->>Hook: 4. Forward to webhook
                Hook-->>Ingress: Delivered
            end
        end
    end

    Ingress->>Analytics: Track message event
    Ingress->>Channel: Send response
    Channel->>Customer: Deliver reply
```

---

## 6. Native Extension Plugin Lifecycle

How a user connects a new channel (e.g., WhatsApp) through the grounded engine (Phase 5).

```mermaid
sequenceDiagram
    participant User
    participant Dashboard as DeXMart Dashboard
    participant API as Backend API
    participant Engine as Gateway (server-channels.ts)
    participant Registry as PluginRegistry
    participant Plugin as extensions/whatsapp
    participant Firebase as Firestore

    User->>Dashboard: Click "Add WhatsApp Channel"
    Dashboard->>API: POST /api/internal/channels
    API->>Engine: startChannelInternal(channelId, platform, userId)

    Note over Engine: Phase 5 Injection Point:<br/>Billing Gate (assertCan)

    Engine->>Registry: getPlugin('whatsapp')
    Registry-->>Engine: WhatsappPlugin

    Engine->>Plugin: startAccount({ channelId, userId, authStateFactory })

    Note over Plugin: Pluggable Firestore auth<br/>injected at engine level

    Plugin-->>Dashboard: QR Code (via WebSocket)
    User->>Plugin: Scan QR with phone
    Plugin->>Firebase: Save auth state
    Plugin-->>Dashboard: Connection established
    Dashboard->>User: Channel connected!
```

---

## 7. Billing Gate Flow

How the billing system gates operations.

```mermaid
flowchart LR
    OP[Operation Request] --> GT{BillingGate<br/>Check}

    GT --> MC{Check Type}

    MC -->|Model Selection| MS[filterModelsForUser]
    MC -->|Channel Start| CS[ctx.capabilities.maxChannels]
    MC -->|Message Send| MSG[ctx.capabilities.messagesPerMonth]
    MC -->|Feature Access| FA[ctx.capabilities.features]
    MC -->|Agent Create| AC[ctx.capabilities.maxAgents]

    MS --> MR{Models<br/>remaining?}
    CS --> CR{Under<br/>limit?}
    MSG --> QR{Under<br/>quota?}
    FA --> FR{Feature<br/>enabled?}
    AC --> AR{Under<br/>limit?}

    MR -->|Yes| PASS[Proceed]
    CR -->|Yes| PASS
    QR -->|Yes| PASS
    FR -->|Yes| PASS
    AR -->|Yes| PASS

    MR -->|No models| DENY[402 Upgrade Required]
    CR -->|No| DENY
    QR -->|10% grace then| DENY
    FR -->|No| DENY
    AR -->|No| DENY

    PASS --> TRACK[UsageTracker<br/>Increment Counter]
    TRACK --> FLUSH[Batched Firestore Flush<br/>Every 10s or threshold 50]

    style PASS fill:#2d6a4f,color:#fff
    style DENY fill:#d62828,color:#fff
    style TRACK fill:#264653,color:#fff
```

---

## 8. Config Resolution Flow

How user-scoped configuration is resolved with three-layer caching.

```mermaid
flowchart TD
    REQ[Config Request<br/>with userId] --> MEM{In-Memory<br/>Cache?}

    MEM -->|Hit| RET[Return Config]
    MEM -->|Miss| RED{Redis Cache?<br/>TTL: 5 min}

    RED -->|Hit| MEMW[Write to Memory Cache]
    MEMW --> RET
    RED -->|Miss| FS[Firestore Lookup<br/>/users/userId/config]

    FS --> FOUND{Document<br/>Exists?}

    FOUND -->|Yes| REDW[Write to Redis<br/>TTL: 5 min]
    FOUND -->|No| FALL[Use Platform Defaults<br/>ConfigManager]

    REDW --> MEMW2[Write to Memory Cache]
    MEMW2 --> RET
    FALL --> RET

    style RET fill:#2d6a4f,color:#fff
    style FALL fill:#e9c46a,color:#000
```

---

## 9. Session Persistence Flow

How channel auth state is persisted universally to Firestore (replacing file-based).

```mermaid
flowchart LR
    subgraph "Old (OpenClaw Default)"
        OF[useMultiFileAuthState]
        OF --> FS1[Local Filesystem<br/>authDir/creds.json]
    end

    subgraph "New (DeXMart Fusion)"
        NF[useFirestoreChannelAuthState]
        NF --> FS2[Firestore<br/>/users/userId/channels/channelId/auth]
    end

    subgraph "Injection Point"
        SS[src/web/session.ts<br/>createWaSocket]
        SS -->|authStateFactory option| NF
        SS -->|default fallback| OF
    end

    subgraph "Applies To All Channels"
        WA[WhatsApp - Baileys]
        TG[Telegram - grammY]
        DC[Discord - discord.js]
        SL[Slack - Bolt]
        SG[Signal]
        OT[35+ Others]
    end

    NF --> WA
    NF --> TG
    NF --> DC
    NF --> SL
    NF --> SG
    NF --> OT

    style NF fill:#2d6a4f,color:#fff
    style OF fill:#6c757d,color:#fff
```

---

## 10. Frontend Data Flow

How data moves through the Next.js 16 frontend.

```mermaid
flowchart TD
    subgraph "Next.js 16 App Router"
        PAGE[Page Route<br/>app/(dashboard)/agents/page.tsx]
        PAGE --> RSC{Server<br/>Component?}

        RSC -->|Yes| DAL[Data Access Layer<br/>server/dal/]
        DAL --> FSQ[Firestore Query<br/>Direct server-side]
        FSQ --> HTML[Pre-rendered HTML<br/>Streamed to client]

        RSC -->|No - Client| CC[Client Component<br/>'use client']
        CC --> RQ[React Query<br/>useQuery / useMutation]
        RQ --> API[REST API<br/>fetch /api/*]
        API --> BE[Backend Express<br/>Port 3001]

        CC --> WS[WebSocket<br/>Socket.io Client]
        WS --> RT[Real-time Events<br/>Mastermind Stream,<br/>Channel Status,<br/>QR Codes]
    end

    subgraph "Client State"
        ZU[Zustand Stores]
        ZU --> BS[useBillingStore<br/>Plan, usage]
        ZU --> US[useUIStore<br/>Sidebar, theme]
        ZU --> OS[useOmnichannelStore<br/>Active channels]
        ZU --> MS[useMastermindStore<br/>Agent reasoning]
    end

    CC --> ZU

    style DAL fill:#264653,color:#fff
    style RQ fill:#2a9d8f,color:#fff
    style ZU fill:#e76f51,color:#fff
```

---

## 11. Backend Startup Sequence

The order of initialization when the backend starts.

```mermaid
sequenceDiagram
    participant Main as main.ts
    participant Env as Environment
    participant Config as ConfigService
    participant Context as Global Context
    participant Jobs as JobRegistry
    participant App as MultiTenantApp
    participant WS as WebSocket
    participant Bots as Active Bots

    Main->>Env: validateEnvironmentOrThrow()
    Note over Env: Zod validates ~100 env vars

    Main->>Config: ConfigService.getInstance()
    Note over Config: Singleton initialization

    Main->>Context: initializeContext()
    activate Context
    Context->>Context: Build base context (db, logger, tools)
    Context->>Context: Load CommandSystem (bot commands)
    Context->>Context: Initialize GeminiAI (unified brain)
    Context->>Context: DeXMartToolBridge.registerCommands()
    Context->>Context: MastermindSkillBridge.registerSkills()
    deactivate Context

    Main->>Jobs: JobRegistry.initialize()
    Note over Jobs: Register AI, media, campaign processors

    Main->>App: MultiTenantApp.initialize()
    activate App
    App->>App: Setup middleware (CORS, helmet, rate-limit)
    App->>App: Setup routes (23 route modules)
    App->>App: AnalyticsService.initialize(port+1)
    App->>WS: socketService.initialize()
    App->>App: initializeServices (Stripe, etc.)
    deactivate App

    Main->>Bots: startActiveTenantBots()
    Note over Bots: Resume connections for active users

    Main->>Main: channelWatchdog.start(60s)
    Note over Main: Auto-heal stale connections
```

---

## 12. Deployment Topology

Runtime infrastructure layout.

```mermaid
graph TB
    subgraph "Client Tier"
        BR[Browser<br/>Next.js SSR/CSR]
        PH[Phone<br/>WhatsApp/Telegram/etc.]
    end

    subgraph "Application Tier"
        FE[Frontend Server<br/>Next.js 16<br/>Port 3000]
        BE[Unified Engine API<br/>Express + Hono<br/>Port 3001]
        WS[WebSocket Server<br/>Socket.io<br/>Port 3002]
        WK[BullMQ Workers<br/>Background Jobs]
    end

    subgraph "Data Tier"
        FS[(Firestore<br/>Primary DB)]
        RD[(Redis<br/>Cache + Queues)]
    end

    subgraph "External Services"
        ST[Stripe<br/>Payments]
        FB[Firebase Auth<br/>Identity]
        AI[AI Providers<br/>Gemini/Claude/GPT]
        CH[Channel APIs<br/>WhatsApp/Telegram/etc.]
    end

    BR --> FE
    BR --> BE
    BR --> WS
    PH --> CH
    CH --> BE

    FE --> BE
    BE --> FS
    BE --> RD
    BE --> ST
    BE --> FB
    BE --> AI
    BE --> CH
    WK --> RD
    WK --> FS
    WS --> RD

    style FE fill:#264653,color:#fff
    style BE fill:#2a9d8f,color:#fff
    style WK fill:#e76f51,color:#fff
```

---

## 13. Monorepo Package Dependencies

How the pnpm workspace packages relate post-fusion.

```mermaid
graph LR
    ROOT[src/<br/>DeXMart Unified Engine]

    FE[frontend/<br/>Next.js 16<br/>Dashboard UI]
    OC[openclaw/<br/>Upstream reference<br/>for sync only]
    SH[shared/<br/>Zod Schemas]
    EXT[extensions/<br/>Canonical Channel Plugins]

    FE -->|imports types| SH
    FE -->|REST + WS| ROOT
    OC -->|upstream patches<br/>cherry-picked into| ROOT
    ROOT -->|uses| EXT
    ROOT -->|validates with| SH

    style ROOT fill:#2d6a4f,color:#fff
    style FE fill:#264653,color:#fff
    style OC fill:#6c757d,color:#fff
```

---

## 14. Firestore Data Hierarchy

The document/subcollection structure in Firestore.

```mermaid
graph TD
    ROOT[(Firestore Root)]

    ROOT --> USERS[users/]
    USERS --> UID["{userId}"]

    UID --> AGENTS["agents/{agentId}"]
    UID --> CHANNELS["channels/{channelId}"]
    UID --> SUBS["subscriptions/{subId}"]
    UID --> CAMPAIGNS["campaigns/{campaignId}"]
    UID --> CONTACTS["contacts/{contactId}"]
    UID --> TEMPLATES["templates/{templateId}"]
    UID --> WEBHOOKS["webhooks/{webhookId}"]
    UID --> ANALYTICS["analytics/{period}"]
    UID --> USAGE["usage/current"]
    UID --> CONFIG["config/settings"]
    UID --> LEARNING["learning/{topicId}"]

    AGENTS --> AGENT_CHANNELS["channels/{channelId}"]
    CHANNELS --> AUTH["auth/{docId}<br/>Session credentials"]

    AGENT_CHANNELS --> MSGS["messages/{messageId}"]

    ROOT --> GLOBAL[Global Collections]
    GLOBAL --> GUSERS["users/{userId}<br/>Global user lookup<br/>userId -> profile + plan"]

    style ROOT fill:#264653,color:#fff
    style UID fill:#2d6a4f,color:#fff
    style AUTH fill:#e76f51,color:#fff
    style USAGE fill:#e9c46a,color:#000
```

> **Note**: The B2C model uses `users/{userId}` as the top-level scope (equivalent to `tenants/{tenantId}` in B2B). The codebase is transitioning terminology from "tenant" to "user" throughout.

---

## 15. Fusion Phase Roadmap

Timeline and status of the True Fusion phases.

```mermaid
gantt
    title True Fusion Phases
    dateFormat YYYY-MM-DD

    section Phase 1: Restructure
    Flatten OpenClaw into src/         :done, p1a, 2026-03-15, 2026-03-20
    Delete duplicate logic             :done, p1b, 2026-03-20, 2026-03-25

    section Phase 2: Injection
    User-scoped config (FR-1)          :done, p2a, 2026-03-25, 2026-03-28
    Auth + Billing gates (FR-2/3)      :done, p2b, 2026-03-28, 2026-04-02

    section Phase 3: AI Fusion
    Wire Mastermind Stream             :done, p3a, 2026-04-02, 2026-04-08
    Hybrid Firestore Memory            :done, p3b, 2026-04-08, 2026-04-10

    section Phase 4: backend/ Dissolve
    Migrate route/service source       :done, p4a, 2026-04-02, 2026-04-03
    Create dead-end parallel channels  :crit, done, p4b, 2026-04-03, 2026-04-03

    section Phase 5: Grounding
    Inject B2C into gateway/           :active, p5a, 2026-04-10, 2026-04-15
    Delete parallel adapters           :p5b, 2026-04-15, 2026-04-17
    Wire memoryManager into engine     :p5c, 2026-04-17, 2026-04-20

    section Phase 6: ControlUI
    DeXMart dashboard channel mgmt     :p6a, 2026-04-20, 2026-04-25
    Remove openclaw-ui proxy           :p6b, 2026-04-25, 2026-04-26
```

---

## Diagram Conventions

| Symbol | Meaning |
|--------|---------|
| Green fill (`#2d6a4f`) | DeXMart core component |
| Dark blue fill (`#264653`) | DeXMart frontend / infrastructure |
| Orange fill (`#e76f51`) | Critical/security component |
| Yellow fill (`#e9c46a`) | Transitional/legacy (being dissolved) |
| Gray fill (`#6c757d`) | Upstream reference only (not runtime) |
