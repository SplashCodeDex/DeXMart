---
track_id: dashboard_controlui_parity_20260421
type: feature
---

# Spec: Dashboard ControlUI Parity — Full Frontend Replacement

> **Primary artifact:** [`artifacts/parity-matrix.json`](./artifacts/parity-matrix.json) — the evidence-based source of truth. All counts below derive from it. Do NOT hand-edit; regenerate via `pnpm tsx scripts/controlui-parity-discover.ts`.

## Overview

ControlUI is OpenClaw's native Lit/Vite SPA served under `src/gateway/control-ui*`, rendering from `ui/src/`. PROJECT_RULES.md §0 mandates the DeXMart Next.js dashboard as the sole UI. This track drives DeXMart to full ControlUI feature parity, flag-gates the cutover, soaks the flag, then permanently removes ControlUI.

## Strategy: Add / Subtract / Weave / Implement / Enhance

Each ControlUI feature in the matrix lands one of five strategy labels. Definitions match the Phase 0 discovery script and are enforced by `artifacts/overrides.json`:

| Strategy      | Meaning                                 | When                                |
| ------------- | --------------------------------------- | ----------------------------------- |
| **add**       | Net-new DeXMart route/component         | Feature has no DeXMart surface      |
| **implement** | DeXMart route stub exists, no logic     | Page file exists but empty          |
| **enhance**   | DeXMart feature partially present       | Feature dir exists with gaps        |
| **weave**     | Integrate into an existing DeXMart page | Better UX to fold, not split        |
| **subtract**  | Do NOT port                             | Self-hosted-only / B2C-incompatible |

## Evidence-Based Feature Inventory (from parity-matrix.json)

| Total                              | Count                                                   |
| ---------------------------------- | ------------------------------------------------------- |
| Gateway RPC methods                | **119**                                                 |
| Gateway RPC domains                | **28**                                                  |
| ControlUI views (Lit)              | **58**                                                  |
| ControlUI controllers              | **28**                                                  |
| DeXMart dashboard routes (current) | **17**                                                  |
| DeXMart feature dirs (current)     | **13**                                                  |
| Parity features tracked            | **22**                                                  |
| Starting coverage                  | **73%** (16/22 have a DeXMart surface, 6 fully missing) |
| Unmapped RPC methods               | **0** (enforced by `--check` in CI)                     |

> When this spec drifts from artifact counts, rerun the discovery script — the artifact wins.

## Feature Matrix Summary

See [`artifacts/parity-report.md`](./artifacts/parity-report.md) for the full table. Features by strategy:

- **add** (4): `chat`, `debug`, `setup-wizard`, `command-palette`
- **implement** (2): `sessions`, `logs`
- **enhance** (7): `agents`, `config`, `cron`, `skills`, `nodes`, `usage`, `overview`
- **weave** (8): `channels`, `devices`, `dreaming`, `tts`, `instances`, `exec-approvals`, `update-runner`, `message-actions`
- **subtract** (1): `connect-gate` — Firebase Auth + backend-injected Gateway URL replace manual connection entry

## Architecture Decisions (BEFORE Phase 1 code)

### A. Gateway Transport (Cloud → User's Gateway)

**Decision (to be confirmed in Phase 1 sub-track 1.A):** DeXMart frontend talks to Gateway via a tenant-scoped WebSocket multiplexer, not per-tenant pods. Options under evaluation:

1. **Direct WS to user's Gateway pod** — Gateway runs per-tenant as a managed pod. Frontend opens WS to `wss://gateway.dexmart.app/<tenantId>`. Cleanest multi-tenancy; highest ops cost.
2. **Relay proxy** — Single DeXMart API process opens one WS per tenant to their Gateway, relays frames to frontend via Socket.io. Lowest ops cost; requires relay resilience.
3. **Tenant-mux Gateway** — Single Gateway instance with tenant scoping injected at handler entry. Requires upstream fork or injection point — violates upstream leverage unless upstream accepts tenant middleware.

Track cannot proceed past Phase 1 without a written decision in `docs/architecture/GATEWAY_TRANSPORT.md`. Sub-track 1.A produces that doc.

### B. Tenant Injection Point

Every Gateway RPC call must carry the authenticated Firebase UID. The injection point is the **Gateway auth handshake**, NOT a wrapper around each call. This aligns with PROJECT_RULES §0.6 (centralized elevation — inject at foundation, not wrap).

### C. RPC Type Source

RPC parameter/result Zod schemas live in `src/gateway/server-methods/*.ts` (upstream). DeXMart frontend MUST import these directly via workspace alias, never redeclare. If upstream lacks an exported schema, the Phase 0 script emits a warning and a ticket to upstream rather than duplicating. Violates PROJECT_RULES §0.1 otherwise.

### D. Visual Language (Locked)

Codified in [`docs/DASHBOARD_STYLE_GUIDE.md`](../../../docs/DASHBOARD_STYLE_GUIDE.md). Summary:

- Primitives: `frontend/src/components/ui/` (shadcn/ui) only
- Tokens: OKLCH from `frontend/src/app/globals.css` (no new tokens without RFC)
- Icons: `lucide-react` or `frontend/src/components/ui/icons.tsx` (no emojis — PROJECT_RULES §8.7)
- Motion: `frontend/src/components/ui/motion.tsx`
- Data cards: glassmorphism `bg-card/60 backdrop-blur-sm border border-border/50`
- State pattern: Thin page (PROJECT_RULES §8.1), Server Components default, `useEffect` banned for data
- Screenshot-diff CI guards regressions (Phase 2.D)

## Acceptance Criteria

The track is complete when ALL are true:

1. **Matrix at 100% coverage** — every feature in `parity-matrix.json` has `status ∈ {"complete","subtract"}` and the CI script `pnpm tsx scripts/controlui-parity-discover.ts --check` exits 0.
2. **Playwright parity suite green** — `frontend/src/e2e/controlui-parity.spec.ts` covers every non-subtract feature with at least one assertion per RPC method group.
3. **Unit coverage ≥ 80%** on every new `lib/gateway/*`, `features/*/hooks/*`, `features/*/store.ts`, `components/shared/*`.
4. **`pnpm typecheck` exits 0** (frontend + backend).
5. **`pnpm test` exits 0** with 0 failures after flag soak.
6. **Feature flag soaked** — `DEXMART_DISABLE_CONTROLUI=true` shipped to production for at least one release cycle with zero P0/P1 regressions logged.
7. **Screenshot-diff CI clean** — `pnpm visual-diff` exits 0 for all tracked routes.
8. **ControlUI files deleted** — all paths matching `src/gateway/control-ui*`, `src/infra/control-ui-assets*`, `ui/**` removed; no import references remain (grep-enforced).
9. **Docs updated** — PROJECT_RULES §0, FUSION_STRATEGY, OPENCLAW_UPSTREAM_REPORT, tracks.md reflect removal.

## Upstream Leverage Guardrails (PROJECT_RULES §0.1)

- **No duplicate Zod schemas** — import from `src/gateway/server-methods/*`.
- **No parallel RPC client** — one typed client in `frontend/src/lib/gateway/`, reused everywhere.
- **Upstream watcher** — `scripts/controlui-parity-discover.ts --check` runs in the `openclaw_sync_*` CI track; new upstream RPC methods MUST land in the matrix before sync merges.

## Out of Scope

- i18n / multi-language (separate future track; matrix records `connect-gate.subtract` as the i18n-adjacent flow already removed)
- Mobile redesign (separate track)
- New AI model integrations (separate track)
- Stripe billing feature changes (separate track)
