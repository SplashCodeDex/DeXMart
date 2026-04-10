# DeXMart Technology Stack (2026 TRUE Fusion Edition)

## Architecture

- **Pattern:** Unified Codebase — OpenClaw engine + DeXMart platform modules in one `src/` tree
- **Multi-Tenancy:** B2C user-level isolation (Spotify/CapCut pattern) — `userId` tags every resource
- **Upstream Strategy:** Managed fork of OpenClaw — security patches cherry-picked, features manually adapted

## 1. Frontend

- **Framework:** Next.js 16.1.4+ (App Router, Turbopack, PPR Stable)
- **Library:** React 19.2.3 (Server Components, Server Actions, React Compiler Enabled)
- **Language:** TypeScript 5.9.3 (Strict Mode)
- **Styling:** Tailwind CSS 4.1.18 (CSS-first `@theme` configuration, Zero Config)
- **Dynamic Forms:** JSON Schema-based form generation for AI Skill parameters
- **Visual Reasoning:** Recursive Tree-view components for real-time Agent Spawning Trace
- **Animations:** Framer Motion 12.26.2 (GPU-accelerated)
- **State Management:**
  - **Server State:** Server Components & Actions (Result Pattern)
  - **Mutation State:** `useActionState` (replacing manual loading states)
  - **Client UI State:** Zustand 5.0.10
  - **URL State:** Next.js Navigation Hooks
- **Validation:** Zod 4.3.6 (Mandatory for all I/O)
- **Icons:** Lucide React 0.562.0
- **API Communication:** REST for CRUD + WebSocket for real-time (hybrid, industry best practice)

## 2. Backend (Unified — OpenClaw Engine + DeXMart Platform)

- **Runtime:** Node.js 24+ (Strict ESM, Permission Model Enabled)
- **Server:** OpenClaw Gateway (Hono-based HTTP + WebSocket server)
- **Language:** TypeScript 5.9.3
- **Execution:** `tsx watch` (with isolated ignore patterns) - **STRICT: DO NOT use ts-node**

### OpenClaw Engine (as-is, untouched)
- **Agent Runtime:** pi-embedded-runner (13+ model providers, fallback chains, context window guards)
- **Model Providers:** Google Gemini, Anthropic Claude, OpenAI GPT, AWS Bedrock, Ollama, HuggingFace, Groq, Together, Replicate, Fireworks, DeepSeek, Mistral, LM Studio
- **Channel System:** 40+ channel plugins (WhatsApp, Telegram, Discord, Slack, Signal, iMessage, Line, Matrix, MS Teams, Twitch, etc.)
- **WhatsApp API:** Baileys 7.0.0-rc.9 (via OpenClaw web/ module)
- **Telegram API:** grammY 1.41.0 (via OpenClaw telegram/ module)
- **Discord API:** discord.js 14.25.1 (via OpenClaw discord/ module)
- **Tool System:** OpenClaw native tools + plugin-resolved tools
- **Memory:** OpenClaw memory system (sqlite-vec, vector store)
- **Health Monitor:** Stale socket detection, restart cooldowns, max-restarts-per-hour
- **Access Control:** DM/Group policies, allowlist/blocklist
- **Inbound Processing:** Message deduplication, format extraction, media pipelines

### DeXMart Platform (core infrastructure — NOT plugins)
- **User Context:** `UserContext` + `AuthGuard` for B2C isolation (`src/tenancy/`)
- **Billing Gate:** `assertCan()` / `assertCanWithGrace()` (grace zone, 90–99%) + `UsageTracker` (batched Firestore flush) + Stripe integration (`src/billing/`) — pure functions on `UserContext`, replaces B2B-era `SystemAuthorityService`
- **Persistence:** Firebase/Firestore for user data, sessions, config (`src/persistence/`)
- **Campaigns:** Bulk messaging engine with anti-ban throttling (`src/campaigns/`)
- **Safety:** Anti-ban system + content moderation (`src/safety/`)
- **Analytics:** AI usage tracking, audit trail, Mastermind stream (`src/analytics/`)
- **Ingress:** Omnichannel message routing (`src/ingress/`)
- **Agent Management:** Multi-agent CRUD per user (`src/agents-management/`)

### Shared Infrastructure
- **Job Queues:** BullMQ / BullMQ Pro (Group Isolation for user-scoped jobs)
- **Real-time:** WebSockets (Socket.io 4.8.3) for Mastermind stream, channel status push, QR codes, billing warnings (`billing_warning` event)
- **Observability:** OpenTelemetry (Tracing & Metrics, Low-overhead auto-instrumentation)
- **Logging:** Pino (High-performance, JSON structured)
- **Testing:** Vitest 4.0.18 (Unified — both backend and frontend)

## 3. Infrastructure & Services

- **Database:** Firebase Firestore (User-level subcollection pattern: `/users/{userId}/...`)
- **Authentication:** Firebase Admin / Client SDK 13.6.0
- **Payments:** Stripe 20.2.0
- **Caching:** Redis (ioredis 5.9.2) with Node-Cache fallback for development
- **AI Integration:** Multi-provider via OpenClaw (Gemini, Claude, GPT, etc.)
- **File Storage:** Firebase Storage / Google Drive API

## 4. Development & Tooling

- **Testing:** Vitest 4.0.18 (Unified)
- **Linting:** ESLint 9+ (Flat Config), Prettier
- **Git Hooks:** Husky, Lint-staged
- **API Validation:** Zod (Mandatory for all contracts)
- **Upstream Tracking:** `git remote openclaw-upstream` for managed fork sync
