# DeXMart Product Guidelines

## The Fusion Principle — One Project
- Zero duplication: every function exists exactly once
- No bridges: no wrappers, adapters, or shims — code calls code directly via `@dexmart/*`
- Extensions are canonical: channel features live in `extensions/`, never duplicated
- One channel engine: OpenClaw's `createChannelManager()` + `PluginRegistry`
- Frontend dominates: Next.js dashboard is THE UI; ControlUI is dev-only

## Code Quality
- TypeScript strict mode — no `any` without justification
- ESLint zero-warnings policy (`--max-warnings 0`)
- Result pattern: `{ success: true; data: T } | { success: false; error: AppError }`
- Zod validation at every system boundary (Firestore, API, user input)
- Strict ESM: all relative imports must include `.js` extension

## Frontend Standards
- Server Components by default; `'use client'` only at interaction leaves
- Thin page pattern: `app/**/page.tsx` renders feature components only, no logic
- No `useEffect` for data fetching — use Server Components or React Query
- Pixel perfection: Tailwind spacing tokens only, all interactive states (hover/active/focus)
- No emojis in UI — SVG icons from `lucide-react` only

## Testing Strategy
- TDD mandate: Red → Green → Refactor
- 80%+ coverage minimum; co-located test files (`*.test.ts` next to source)
- Mock external I/O (Firebase, Baileys, Stripe, Redis); never mock internal logic
- Zero-error policy: no console warnings in passing tests
