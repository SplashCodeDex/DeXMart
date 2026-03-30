---
description: Project coding standards and architectural rules for DeXMart
---

# DeXMart Project Rules (2026 Mastermind Edition)

See [ARCHITECTURE.md](file:///w:/CodeDeX/DeXMart/ARCHITECTURE.md) for system overview.
See [frontend/ARCHITECTURE.md](file:///w:/CodeDeX/DeXMart/frontend/ARCHITECTURE.md) for detailed frontend documentation.

## 0. The Fusion Principle (DeXMart ⊕ OpenClaw)

**FOUNDATIONAL RULE** — DeXMart and OpenClaw are being woven into a **single unified product**. Neither replaces the other. They merge, each contributing its strongest capabilities.

- **DeXMart = face + brain** — SaaS frontend, multi-tenant architecture, AI intelligence (intent detection, RAG, anti-ban), dashboard UI, Firestore persistence.
- **OpenClaw = engine + muscles** — Multi-channel gateway (WhatsApp, Telegram, Discord, Slack, Signal, iMessage), plugin system, agent framework, CLI/TUI developer tools.

### Fusion Rules

1. **Never subtract, always weave** — Don't rip out modules to "clean up." Bridge DeXMart services to consume OpenClaw's engine through adapters.
   - **CRITICAL IMPORT PATTERN (BACKEND)**: Never import directly from the `openclaw` package name in `backend/` files, as `tsx` will try to compile its source and fail on CJS interop for transitive dependencies. Instead, ALWAYS use the centralized `backend/src/utils/openclawImports.ts` utility (e.g., `const { sendMessageTelegram } = await getTelegramSend();`).
2. **Best-of-both wins** — When both stacks solve the same problem, pick the stronger implementation and adapt the other side to use it.
3. **Shared seams, not shared code** — Integrate through well-defined interfaces (`ChannelAdapter`, gateway API), not by merging internal code.
4. **Respect ownership** — Frontend, multi-tenancy, and AI live in DeXMart. Channel engines, gateway, and tooling live in OpenClaw.

### OpenClaw Source Integration (Direct Imports)

`openclaw/dist/` is **NOT required for development**. The backend imports OpenClaw
modules directly from their TypeScript source files via relative paths
(`../../../openclaw/src/...`), using the centralized `backend/src/utils/openclawImports.ts` utility.

**⚠️ NEVER import from the `openclaw` package name or its barrel `index.ts`.**
The barrel has side effects (loadDotEnv, normalizeEnv, buildProgram) that conflict
with DeXMart's own initialization, and it pulls in CJS-only transitive dependencies
that crash tsx's ESM interop.

**Import pattern:**
```typescript
// ✅ CORRECT — use openclawImports.ts utility (resolves to source)
import { getTelegramSend, getCreateOpenClawTools } from '@/utils/openclawImports.js';

// ✅ CORRECT — direct source import for gateway-level modules
await import('../../../openclaw/src/config/config.js');

// ❌ WRONG — triggers side effects + CJS crash
import { createOpenClawTools } from 'openclaw';
```

Building `dist/` is only needed when publishing openclaw as a standalone npm package.

---

## Tech Stack

- **Backend**: Node.js 24+, Express, Baileys (WhatsApp)
- **Runtime**: `tsx` (TypeScript Execute) - **STRICT: DO NOT use ts-node**
- **Frontend**: Next.js 16+ (App Router), React 19 (Compiler Enabled)
- **Styling**: Tailwind CSS v4 (Zero Config), Framer Motion (Animations)
- **State**: Server Actions (Mutations), URL State (Navigation), Zustand (Global)
- **Architecture**: Hybrid Feature-Sliced Design (FSD)
- **Database**: Firebase (Firestore) - **Subcollection Multi-Tenancy Pattern**
- **Validation**: Zod (Mandatory for all IO)
- **Observability**: OpenTelemetry (Tracing/Metrics)

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

- **Hierarchy**: `tenants/{tenantId}/{collectionName}/{docId}`
- **Security**: Rules must enforce `request.auth.uid` matches the tenant ownership.
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
- **Module Resolution**: Use `@/` alias for all internal source paths.

---

## 5. Performance & Automation

- **Memoization**: Cache AI responses and expensive Firestore reads using the `CacheService` (Redis/Memory).
- **Traces**: Every bot command must start an OpenTelemetry span.
- **Automation**: If a task is repeated 3 times (e.g., fixing imports), **write a script** in `backend/scripts/` to automate it.

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

### Directory Structure

```
src/
├── app/                  # Route Definitions (Thin Wrappers)
│   └── (dashboard)/      # Route Group
│       └── bots/
│           └── page.tsx  # Exports <BotsPage /> from features/
├── features/             # Business Domains (The Core)
│   ├── auth/             # Login, Register, Forgot Password
│   ├── bots/             # Bot Management, Connections
│   └── billing/          # Subscriptions, Invoices
│   │   ├── components/   # Domain-specific UI
│   │   ├── hooks/        # Domain logic
│   │   ├── actions.ts    # Server Actions
│   │   └── types.ts      # Domain schemas
├── components/           # Shared UI
│   ├── ui/               # Atomic Design System (Buttons, Inputs) - Pure & Dumb
│   └── layouts/          # Structural Components (Sidebar, Header)
├── lib/                  # Infrastructure (API Clients, Utils)
├── server/               # Shared Server Logic (DAL)
├── stores/               # Client State (Zustand)
└── types/                # Shared TypeScript Types
```

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
