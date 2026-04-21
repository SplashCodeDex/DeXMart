# Handoff Addendum — ControlUI Parity Gate

**Added:** 2026-04-21  
**Context:** Dashboard ControlUI Parity track (Phase 0.2) wired `pnpm parity:check` into the CI `check` job and this track's pre-merge gate.

## When Upstream Adds RPC Methods

Every upstream sync must check whether new methods landed in `src/gateway/server-methods/*`. If they did, `pnpm parity:check` will exit 1 with a drift error listing unmapped methods.

**Fix:**

1. Open `scripts/controlui-parity-discover.ts`
2. Find `FEATURE_SEEDS` array
3. Add the new method(s) to the appropriate feature's `domains` array, or create a new seed entry if the method belongs to a new feature area
4. Run `pnpm parity:generate` — regenerates `conductor/tracks/dashboard_controlui_parity_20260421/artifacts/parity-matrix.json` and `parity-report.md`
5. Run `pnpm parity:check` — must exit 0 before merge is allowed

## Gate Location in This Plan

Task 6.3b in Phase 6 is the mandatory pre-merge parity gate. It must pass before Task 6.4 (squash-merge).
