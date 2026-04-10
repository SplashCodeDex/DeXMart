# DeXMart

**Enterprise-grade B2C omnichannel AI automation platform.**

DeXMart is a unified codebase that fuses the OpenClaw engine with a B2C multi-tenant platform layer. It gives individual users and businesses a self-service dashboard to connect messaging channels, deploy AI agents, run broadcast campaigns, and monitor agent reasoning in real time — all isolated per user via Firebase Auth and Firestore.

---

## Quick Start

```bash
# Install all workspace dependencies
pnpm install

# Start backend (port 3001)
pnpm dev:backend

# Start frontend (port 3000)
pnpm dev:frontend
```

> **Requires**: Node.js 24+, pnpm, Redis, and a Firebase project with credentials in `.env`.
> Copy `.env.example` to `.env` and fill in all required values before starting.

---

## Architecture

```
DeXMart/
├── src/                  # Unified codebase (OpenClaw engine + DeXMart platform)
│   ├── tenancy/          # B2C user isolation (UserContext, AuthGuard)
│   ├── billing/          # Stripe subscriptions + feature gating
│   ├── campaigns/        # Bulk messaging engine with anti-ban
│   ├── safety/           # Anti-ban + content moderation
│   ├── analytics/        # AI usage tracking + Mastermind stream
│   ├── ingress/          # Omnichannel message routing
│   ├── agents-management/# Multi-agent CRUD per user
│   ├── web/              # WhatsApp (Baileys) channel adapter
│   ├── telegram/         # Telegram (grammY) channel adapter
│   ├── discord/          # Discord.js channel adapter
│   ├── agents/           # AI agent runtime (pi-embedded-runner)
│   └── main.ts           # Single entry point
├── frontend/             # Next.js 16 dashboard (port 3000)
├── shared/               # Cross-package types and utilities
├── conductor/            # Project planning and track management
└── docs/                 # Architecture documentation
```

**Single entry point:** `src/main.ts`

**OpenClaw** is maintained as a managed fork within `src/` — its engine capabilities are
preserved and extended natively. Security patches are cherry-picked from the upstream remote.
See [`conductor/workflow.md`](./conductor/workflow.md) for the upstream sync strategy.

---

## Key Features

| Feature | Module |
|---|---|
| WhatsApp, Telegram, Discord, Slack + 35 more channels | `src/web/`, `src/telegram/`, `src/discord/`, ... |
| 13+ AI model providers (Gemini, Claude, GPT, Bedrock, Ollama, ...) | `src/agents/` |
| B2C user isolation (every resource scoped to `userId`) | `src/tenancy/` |
| Stripe subscription billing with per-plan feature gates | `src/billing/` |
| Broadcast campaigns with anti-ban throttling | `src/campaigns/`, `src/safety/` |
| Real-time AI reasoning stream (Mastermind Stream) | `src/analytics/mastermind-stream.ts` |
| Visual flow builder (no-code conversation automation) | `frontend/src/features/flows/` |
| Omnichannel unified inbox | `frontend/src/features/omnichannel/` |

---

## Development

```bash
pnpm test:all          # Run all tests (frontend + backend)
pnpm typecheck         # TypeScript strict check
pnpm lint:backend      # ESLint zero-warnings (backend)
pnpm lint:frontend     # ESLint zero-warnings (frontend)
pnpm build:backend     # Compile backend → dist/
pnpm build:frontend    # next build
```

---

## Documentation

- [`docs/architecture/BLUEPRINT.md`](./docs/architecture/BLUEPRINT.md) — System architecture and design principles
- [`docs/architecture/CORE_MODULES.md`](./docs/architecture/CORE_MODULES.md) — DeXMart-exclusive modules (tenancy, billing, safety, analytics)
- [`docs/architecture/SERVICE_CATALOG.md`](./docs/architecture/SERVICE_CATALOG.md) — Full service inventory
- [`docs/architecture/FUSION_STRATEGY.md`](./docs/architecture/FUSION_STRATEGY.md) — Why and how the OpenClaw+DeXMart fusion was achieved
- [`conductor/`](./conductor/) — Project planning, track management, and workflow

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16.1+, React 19, TypeScript 5.9, Tailwind CSS 4 |
| Backend | Node.js 24+, TypeScript 5.9, OpenClaw Gateway (Hono) |
| AI | 13+ providers via OpenClaw pi-embedded-runner |
| Database | Firebase Firestore (user-level isolation) |
| Auth | Firebase Auth + JWT |
| Queue | BullMQ 5 + Redis |
| WhatsApp | Baileys 7.0.0-rc.9 |
| Payments | Stripe 20.2 |
| Testing | Vitest 4.0.18 |
| Package Manager | pnpm (workspaces) |

---

## License

Private — all rights reserved.
