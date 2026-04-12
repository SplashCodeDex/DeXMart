# DeXMart Tech Stack

## Runtime & Package Manager
- Node.js 24+ (Strict ESM) — `tsx` for dev — DO NOT use ts-node
- Package Manager: pnpm (workspaces)

## Backend
- Express 5.2 (DeXMart API, port 3001)
- Hono (Gateway HTTP/WS)
- TypeScript 5.9 (strict)

## Frontend
- Next.js 16.1 + React 19 (Compiler Enabled, Turbopack in dev, port 3000)
- Tailwind CSS v4 (CSS-first, zero config)
- Zustand 5 (global UI state), React Query 5 (server state)
- Radix UI 1.4, Lucide React, Framer Motion 12
- React Hook Form 7 + Zod 4

## AI & Channels
- pi-embedded-runner (13+ model providers: Gemini, Claude, GPT, Ollama, etc.)
- Baileys 7 (WhatsApp), grammY (Telegram), 40+ OpenClaw channel plugins

## Database & Auth
- Firestore (Firebase Admin SDK 13) — B2C: `users/{userId}/...`
- Firebase Auth (Gmail/email OAuth) + JWT
- Stripe (subscriptions, plan gating, usage tracking)

## Infrastructure
- Redis + ioredis (caching, queues)
- BullMQ 5 (background jobs)
- Socket.io 4.8 (real-time: Mastermind stream, QR codes)
- Winston 3.19 + Pino 10.2 (logging)
- OpenTelemetry + Prometheus (observability)

## Testing
- Vitest 4 (both frontend + backend)
- v8 coverage provider — 80% threshold

## Module Resolution
- `@dexmart/*` and `@/*` both resolve to `src/`
- All relative imports must use `.js` extension (Strict ESM)
