---
description: Project coding standards and architectural rules for DeXMart
---

# DeXMart Project Rules (2026 Mastermind Edition)

## 0. The Fusion Principle — One Project

**FOUNDATIONAL RULE** — DeXMart is **one project**. OpenClaw is the upstream heritage (the foundation it was built on), not a separate entity. After fusion, there is no "OpenClaw side" and "DeXMart side" — there is only DeXMart.

### Non-Negotiable Rules

1. **Zero duplication** — Every function, feature, and service exists exactly once, in one place. No mirrors, no copies.
2. **No bridges** — No wrappers, adapters, shims, or bridge files. Code calls code directly via `@dexmart/*` or `@/*` imports.
3. **Frontend dominates** — Every backend capability is accessible through the DeXMart Next.js dashboard. If the engine can do it, the dashboard surfaces it.
4. **Centralized elevation** — Monetization (Stripe), tenant auth (Firebase), cloud persistence (Firestore), and DeXMart-exclusive features apply to the **entire** project — they are core infrastructure, not plugins.
5. **One codebase** — Everything lives in `src/`. No `backend/src/` mirrors, no `openclaw/src/` references at runtime.

### Import Pattern (Post-Fusion)

All code lives in the unified `src/` tree. Use path aliases:

```typescript
// ✅ CORRECT — unified src/ imports
import { AgentService } from "@dexmart/services/AgentService.js";
import { useChannelAuthState } from "@dexmart/persistence/channel-auth-state.js";
import { filterModelsForUser } from "@dexmart/billing/auth-guard.js";

// ❌ WRONG — these are dead patterns from pre-fusion era
import { something } from "openclaw"; // Package doesn't exist at runtime
import { something } from "@/utils/openclawImports.js"; // Deleted in Phase 1
import { something } from "../../../openclaw/src/..."; // Relative paths to openclaw/
```

### Upstream Sync (Invisible to the Product)

OpenClaw upstream is tracked as a git remote for cherry-picking security patches. This is an implementation detail — no developer needs to know or care about it during normal work. See `docs/architecture/FUSION_STRATEGY.md` for the sync protocol.

### Upstream Leverage Mandate

> **Canonical reference**: `docs/architecture/UPSTREAM_LEVERAGE_POLICY.md`

**CRITICAL**: DeXMart MUST NOT duplicate logic, features, code, or capabilities that OpenClaw upstream already provides. Instead, **leverage and utilize** what upstream offers. This ensures automatic adaptation to OpenClaw's changelogs — bug fixes, security patches, new features, and performance improvements are inherited through the sync process with zero rework.

Before implementing ANY new module/service/utility:

1. Search `src/` and `extensions/` for existing upstream implementation
2. Check `CHANGELOG.md` and `docs/OPENCLAW_UPSTREAM_REPORT.md` for upstream capabilities
3. If upstream provides it → **STOP and leverage it**. Do NOT create a parallel implementation.
4. If upstream partially provides it → Extend via injection points. Do NOT fork or wrap.

### DeXMart-Exclusive Feature Embedding

Since OpenClaw and DeXMart are **one project**, features confirmed (via critical investigation) to be truly DeXMart-exclusive MUST be embedded natively in `src/` as first-class modules — not plugins, sidecars, or secondary citizens. A feature is DeXMart-exclusive ONLY if it does NOT exist upstream AND is fundamentally a B2C/SaaS concern AND would NOT make sense in single-user mode. Follow the investigation protocol in `docs/architecture/UPSTREAM_LEVERAGE_POLICY.md` §2.

---

## Tech Stack

- **Runtime**: Node.js 24+ (Strict ESM) — `tsx` for dev — **STRICT: DO NOT use ts-node**
- **Backend**: Express 5 (DeXMart API) + Hono (Gateway HTTP/WS) — unified in `src/`
- **AI Runtime**: pi-embedded-runner (13+ model providers: Gemini, Claude, GPT, Ollama, etc.)
- **Channels**: 40+ plugins (WhatsApp via Baileys 7, Telegram via grammY, Discord, Slack, Signal, etc.)
- **Frontend**: Next.js 16+ (App Router, Turbopack, PPR), React 19 (Compiler Enabled)
- **Styling**: Tailwind CSS v4 (Zero Config), Framer Motion 12 (Animations)
- **State**: Server Actions (Mutations), URL State (Navigation), Zustand 5 (Global)
- **Architecture**: Hybrid Feature-Sliced Design (FSD)
- **Database**: Firebase Firestore — **B2C user-scoped: `users/{userId}/...`**
- **Auth**: Firebase Auth (Gmail/email OAuth) + JWT
- **Billing**: Stripe (plan-gated features, usage tracking)
- **Validation**: Zod 4 (Mandatory for all IO)
- **Caching**: Redis (ioredis) with node-cache fallback
- **Jobs**: BullMQ (background processing)
- **Real-time**: Socket.io (Mastermind Stream, channel status, QR codes)
- **Observability**: OpenTelemetry (Tracing/Metrics), Pino (structured logging)

---

## 1. Zero-Trust Data Layer (Zod-First)

**CRITICAL**: Every interaction with external data (Firestore, API, User Input) MUST be validated via Zod.

- **Firestore Contracts**: Define a Zod schema for every collection. Use `schema.parse(doc.data())` on read.
- **API Contracts**: Use Zod for `req.body` and `req.query`.
- **Type Casting**: NEVER use `as Type`. Use `schema.parse()` to guarantee the type at runtime.

---

## 2. Code Quality & Logic

### Robust Error Handling (The Result Pattern)

- **Prefer Results over Throws**: Service methods should return `{ success: true, data: T } | { success: false, error: AppError }`.
- **Catch Policy**: In `catch` blocks, use `if (error instanceof Error)` or `const err = ZodError.from(error)`.
- **Global Handler**: The `errorHandler.ts` must log via `logger.security()` or `logger.performance()` depending on context.

### Specific Error Messaging

- **User-Facing Specificity**: Always prefer specific error messages (e.g., "Invalid email format" or "Credentials mismatch") over generic fallback messages (e.g., "An unexpected error occurred").
- **Frontend Propagation**: The frontend must prioritize the specific `error` message returned by the backend over generic fallbacks. Generic errors should only be used as a last resort for truly unhandled exceptions (500s).

### Type Safety

- **No `any` or `unknown` leakage**: `unknown` is only for the entry point of a catch block. It must be narrowed immediately.
- **Explicit Returns**: All exported functions and service methods MUST have an explicit return type.
- **Const Everything**: Use `readonly` for interfaces and `as const` for literals.

---

## 3. Data Layer (Firestore Native)

**Mandate**: Use the **Subcollection Pattern** for multi-tenancy.

- **Hierarchy (B2C)**: `users/{userId}/{collectionName}/{docId}` — user IS the tenant
- **Legacy paths**: `tenants/{tenantId}/...` still exist (migrating to `users/` in Phase 4)
- **Security**: Firestore rules enforce `request.auth.uid == userId`. No cross-user access.
- **Atomic Operations**: Use `writeBatch` for multi-document updates.

---

## 4. File Structure & Naming (Strict ESM)

### Naming Conventions

- **Components**: PascalCase (`UserProfile.tsx`)
- **Services/Utils**: camelCase (`userService.ts`, `logger.ts`)
- **Classes**: PascalCase (`UserService`)
- **Folders**: kebab-case (`ai-chat`, `group-management`)

### ESM Integrity (Rule 16)

- **Mandatory Extensions**: All relative imports MUST include the `.js` extension.
- **Module Resolution**: Use `@dexmart/*` or `@/*` aliases for all internal source paths (both resolve to `src/`).

---

## 5. Performance & Automation

- **Memoization**: Cache AI responses and expensive Firestore reads using the `CacheService` (Redis/Memory).
- **Traces**: Every bot command must start an OpenTelemetry span.
- **Automation**: If a task is repeated 3 times (e.g., fixing imports), **write a script** in `scripts/` to automate it.

---

## 6. Continuous Evolution & Standards

**Mandate**: New practices must be codified before widespread adoption.

- **Documentation First**: Any well-researched best practice, logic, or feature pattern (2026 standards) introduced into this project MUST be clearly stated in these rules to guide and shape all future work.
- **Foundation Solidity**: We do not implement "hidden" patterns. If it's a standard, it belongs here.

---

## 7. Testing Strategy (Confidence-First)

**Mandate**: All logic must be verifiable without starting the full bot.

- **Coverage Minimum**: The project targets **80%+ test coverage**. Every new utility, service, or business-logic module MUST ship with co-located tests that meet or exceed this threshold. Run `npm run test:coverage` to verify.
- **Co-location**: Unit tests (`*.test.ts`) MUST reside next to the source file they test. `__tests__/` is reserved for integration/E2E suites only.
- **The "Confidence Gate"**: Type-checking (`npm run typecheck`) and unit tests (`npm run test:run`) MUST pass before code is considered "commit-ready".
- **Mocking Policy**:
  - Mock external I/O (Firebase, Baileys, Stripe, Redis).
  - NEVER mock internal logic or utility functions. Test with real data structures.
- **Zero-Error Policy**: Tests must not only pass but must not emit console warnings (e.g., unhandled rejections).
- **Critical Path Coverage**: Auth, Payments, and Multi-Tenant routing require mandatory coverage of all logical branches.

### Test Failure Interpretation (The "Question Both Sides" Rule)

**A failing test does NOT always mean the code is broken.** Before changing production code to fix a test, always investigate whether the **test itself** is the problem:

- **Stale Tests**: When a strategy, config, or dependency changes, existing tests may still assert old behavior. The test is the bug, not the code.
- **Wrong Abstraction**: Tests should verify **contracts** (what), not **implementation details** (how). Example: testing that failover works (contract) rather than that a specific key is returned second (implementation).
- **Strategy Mismatch**: If code uses `LatencyStrategy` but a test expects `LRU` behavior, **fix the test** — don't change the production strategy to satisfy the test.
- **Decision Flow**: `Test fails → Verify prod code intent → If prod is correct, update the test → If prod is wrong, fix the prod code.`

---

## 8. Frontend Architecture Standards (2026 "Pixel Perfect")

**Mandate**: We follow a **Hybrid Feature-Sliced Design**. Code is organized by **Domain**, not by Technology.

### Strict Rules

1.  **"Thin Page" Pattern**: `app/**/page.tsx` should ONLY fetch initial data and render a Feature Component. No logic allowed in `page.tsx`.
2.  **No Middleware Files**: `middleware.ts` is DEPRECATED.
    - **Proxy**: Use `next.config.ts` rewrites for API proxying.
    - **Guards**: Use Server Component layouts (`layout.tsx`) for route protection.
3.  **Server Components Default**: All components are RSC by default. Use `'use client'` ONLY for interactivity (leaves of the tree).
4.  **Atomic Design System**:
    - **Primitives**: `components/ui` must be pure, stateless, and style-agnostic.
    - **Composition**: Build complex UIs by composing primitives, not by adding props.
5.  **No `useEffect` for Data**: Use Server Components or Server Actions for data fetching. `useEffect` is strictly for synchronization (e.g., window events).
6.  **Pixel Perfection**:
    - Use strict Tailwind spacing tokens (e.g., `gap-4` not `gap-[15px]`).
    - All interactive elements must have: Hover, Active, and Focus-Visible states.
7.  **No Emojis in UI**: NEVER use emojis in the UI. Always use proper SVG icons from `lucide-react` or custom icons from `components/ui/icons.tsx`. Emojis are only permitted if explicitly requested by the user.
8.  NO ASSUMPTIONS, NO GUESSING, JUST PURE INVESTIGATIONS

### State Management Hierarchy

| State Type   | Solution          | Example             |
| ------------ | ----------------- | ------------------- |
| Server State | Server Components | User data, bot list |
| Form State   | `useActionState`  | Form validation     |
| URL State    | `searchParams`    | Filters, pagination |
| UI State     | Zustand           | Modals, sidebar     |
| Optimistic   | `useOptimistic`   | Pending mutations   |

---

## 9. Agentic Workflow Patterns (2026 Mastermind)

**Mandate**: All autonomous agents must follow iterative reasoning and self-correction loops.

### Core Patterns

1.  **Reflection**: After completing a complex task (e.g., refactoring or feature logic), the agent MUST perform a "Critic" phase to identify flaws in its own implementation before reporting to the user.
2.  **Tool-Based Verification**: Whenever possible, use specialized tools (linters, test runners, custom scripts) to verify the output of a thought process rather than relying on LLM intuition alone.
3.  **Dynamic Planning**: For ambiguous requests, the agent MUST generate a multi-step plan, present it to the user, and update the plan dynamically as new information is gathered during tool execution.

### Error Handling & Self-Correction

- **Generator-Critic Loop**: If a command fails, the agent must analyze the error, hypothesize a fix, and retry WITH a modified approach.
- **Structured Failure**: If an agent cannot resolve an error after 2 attempts, it MUST halt and provide a structured report of what it tried, what failed, and why it's stuck.
