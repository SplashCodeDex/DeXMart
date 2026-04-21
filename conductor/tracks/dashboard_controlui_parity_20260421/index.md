---
track_id: dashboard_controlui_parity_20260421
type: feature
status: in_progress
---

# Track: Dashboard ControlUI Parity — Full Frontend Replacement

Drive DeXMart Next.js dashboard to 100% ControlUI feature parity (22 features, 119 RPC methods, 58 views), soak behind `DEXMART_DISABLE_CONTROLUI` flag, then permanently delete ControlUI (`ui/`, `src/gateway/control-ui*`, `src/infra/control-ui-assets*`).

Execution is evidence-based: every sub-track ties to a row in `artifacts/parity-matrix.json`. CI gate (`pnpm parity:check`) blocks merges that add upstream RPC without matrix coverage.

---

## Primary Artifacts

- **Matrix (source of truth):** [artifacts/parity-matrix.json](./artifacts/parity-matrix.json) — regenerate via `pnpm tsx scripts/controlui-parity-discover.ts`; never hand-edit.
- **Report (human-readable):** [artifacts/parity-report.md](./artifacts/parity-report.md) — summary table + gaps, regenerated alongside the matrix.
- **Overrides (subtract list, weave targets, DeXMart-exclusive allowlist):** [artifacts/overrides.json](./artifacts/overrides.json)
- **Discovery script:** [`scripts/controlui-parity-discover.ts`](../../../scripts/controlui-parity-discover.ts) — extractor + CI gate.

## Execution Docs

- **Spec:** [spec.md](./spec.md) — architecture decisions, acceptance criteria, upstream leverage guardrails.
- **Plan:** [plan.md](./plan.md) — 16 phases × 22 parity sub-tracks × 4-level nesting (Phase → Sub-Track → Task Group → Task). Primary execution reference.
- **Metadata:** [metadata.json](./metadata.json)

## Matrix Snapshot (from artifact)

|                         |     |
| ----------------------- | --- |
| RPC methods             | 119 |
| RPC domains             | 28  |
| ControlUI views         | 58  |
| ControlUI controllers   | 28  |
| DeXMart routes          | 17  |
| Parity features tracked | 22  |
| Starting coverage       | 73% |
| Unmapped RPC methods    | 0   |

Features by strategy: **add** 4 · **implement** 2 · **enhance** 7 · **weave** 8 · **subtract** 1.

## Phase Map

- Phase 0 — Discovery & matrix CI gate
- Phase 1 — Gateway RPC foundation (transport decision BLOCKS all downstream)
- Phase 2 — Shared primitives, style guide, visual-diff CI
- Phases 3–12 — Feature sub-tracks (one per parity-matrix row)
- Phase 13 — Rolling parity gate final assertion
- Phase 14 — `DEXMART_DISABLE_CONTROLUI` flag + soak period
- Phase 15 — ControlUI deletion (one-way door — only after Phase 14 sign-off)
