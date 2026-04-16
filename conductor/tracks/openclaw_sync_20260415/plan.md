# Plan: Upstream Sync — OpenClaw v2026.3.2 → v2026.4.14

## Phase 0: Pre-Sync Preparation [checkpoint: bf9f60f]

- [x] Task 0.1: Create dedicated sync branch `upstream/sync-v2026.4.14` from current HEAD [5d0cba5]
- [x] Task 0.2: Add OpenClaw upstream remote (`git remote add openclaw https://github.com/openclaw/openclaw.git`)
- [x] Task 0.3: Fetch all upstream tags (`git fetch openclaw --tags`)
- [x] Task 0.4: Verify gap analysis report accuracy — confirm `v2026.3.2` is last synced, `v2026.4.14` is target
- [ ] Task: Conductor - User Manual Verification 'Phase 0: Pre-Sync Preparation' (Protocol in workflow.md)

---

## Phase 1: Low-Risk Versions (No Breaking Changes, No Injection Conflicts)

These versions contain only features and fixes with zero breaking changes and no injection point conflicts. They should merge cleanly.

**Versions:** v2026.3.8, v2026.3.12, v2026.3.23, v2026.3.24, v2026.4.1, v2026.4.7, v2026.4.8, v2026.4.9, v2026.4.10, v2026.4.11, v2026.4.12

- [x] Task 1.1: Git merge `v2026.3.8` (11 changes, 46 fixes) — resolve conflicts (ACCEPT upstream additions for `ui/` and `apps/` to restore them for Phase 6 comparison), run `pnpm build` [66a4165]
- [x] Task 1.2: Git merge `v2026.3.12` (7 changes, 67 fixes) — resolve conflicts, run `pnpm build` [dac92f6]
- [ ] Task 1.3: Git merge `v2026.3.23` (3 changes, 47 fixes) — resolve conflicts, run `pnpm build`
- [ ] Task 1.4: Git merge `v2026.3.24` (18 changes, 15 fixes) — resolve conflicts, run `pnpm build`
- [ ] Task 1.5: Git merge `v2026.4.1` (14 changes, 40 fixes) — resolve conflicts, run `pnpm build`
- [ ] Task 1.6: Git merge `v2026.4.7` (18 changes, 71 fixes) — resolve conflicts, run `pnpm build`
- [ ] Task 1.7: Git merge `v2026.4.8` (0 changes, 8 fixes) — resolve conflicts, run `pnpm build`
- [ ] Task 1.8: Git merge `v2026.4.9` (5 changes, 34 fixes) — resolve conflicts, run `pnpm build`
- [ ] Task 1.9: Git merge `v2026.4.10` (17 changes, 99 fixes) — resolve conflicts, run `pnpm build`
- [ ] Task 1.10: Git merge `v2026.4.11` (9 changes, 16 fixes) — resolve conflicts, run `pnpm build`
- [ ] Task 1.11: Git merge `v2026.4.12` (broad quality release) — resolve conflicts, run `pnpm build`
- [ ] Task 1.12: Run full test suite (`CI=true pnpm test`) — document baseline after Phase 1
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Low-Risk Versions' (Protocol in workflow.md)

---

## Phase 2: Medium-Risk Breaking Versions (Breaking Changes, No Injection Conflicts)

These versions have breaking changes but do NOT directly touch DeXMart's injection points. They require careful review of breaking change impact.

### v2026.3.7 — Gateway Auth + Config Loading (1 BREAKING, Injection: `src/config/io.ts`)

- [ ] Task 2.1: Review breaking change: `gateway.auth.mode` now required — verify DeXMart's gateway config
- [ ] Task 2.2: Review injection alert: `loadConfig` keyword in changelog — verify `src/config/io.ts` and `src/config/user-config.ts` are unaffected
- [ ] Task 2.3: Review injection alert: `registerPlugin` keyword — verify `src/plugins/registry.ts` compatibility
- [ ] Task 2.4: Git merge `v2026.3.7` (27 changes, 313 fixes) — resolve conflicts at injection points
- [ ] Task 2.5: Run `pnpm build` — verify zero TypeScript errors
- [ ] Task 2.6: Run DeXMart-specific tests (`pnpm test -- src/config/ src/web/ src/ingress/`)

### v2026.3.28 — Qwen Provider + Doctor (2 BREAKING)

- [ ] Task 2.7: Review breaking changes: Qwen portal-auth removed, old config migrations dropped
- [ ] Task 2.8: Git merge `v2026.3.28` (21 changes, 97 fixes) — resolve any conflicts, run `pnpm build`

### v2026.3.31 — Plugin SDK + Exec Policy (6 BREAKING)

- [ ] Task 2.9: Review 6 breaking changes — assess impact on DeXMart plugin integration layer
    - [ ] `nodes.run` shell wrapper removal
    - [ ] Plugin SDK legacy compat subpaths deprecated
    - [ ] `critical` findings fail closed on plugin installs
    - [ ] `trusted-proxy` auth rejects mixed shared-token configs
    - [ ] Node commands disabled until pairing approved
    - [ ] Node-originated runs on reduced trusted surface
- [ ] Task 2.10: Git merge `v2026.3.31` (29 changes, 60 fixes) — resolve any conflicts
- [ ] Task 2.11: Run `pnpm build` — verify zero TypeScript errors

### v2026.4.2 — Plugin Config Migration (2 BREAKING)

- [ ] Task 2.12: Review breaking changes: `x_search` + `web_fetch` config path moves — check if DeXMart references either
- [ ] Task 2.13: Git merge `v2026.4.2` (15 changes, 50 fixes) — resolve any conflicts, run `pnpm build`

### v2026.4.5 — Legacy Config Aliases Removed (1 BREAKING)

- [ ] Task 2.14: Review breaking change: legacy public config aliases removed — scan DeXMart code for any usage
- [ ] Task 2.15: Git merge `v2026.4.5` (38 changes, 188 fixes) — resolve any conflicts, run `pnpm build`

- [ ] Task 2.16: Run full test suite (`CI=true pnpm test`) — document baseline after Phase 2
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Medium-Risk Breaking Versions' (Protocol in workflow.md)

---

## Phase 3: High-Risk Injection Point Versions

These versions directly touch DeXMart's modified files. **Manual conflict resolution is mandatory.**

### v2026.3.11 — IngressService + Cron Doctor (1 BREAKING, Injection: `ingress-service.ts`)

- [ ] Task 3.1: Pre-merge: snapshot current `src/ingress/ingress-service.ts` for diff comparison
- [ ] Task 3.2: Review changelog for `runEmbeddedPiAgent` context — determine if upstream changed the function signature or just referenced it
- [ ] Task 3.3: Git merge `v2026.3.11` (15 changes, 92 fixes) — manually resolve `ingress-service.ts` conflicts
- [ ] Task 3.4: Verify `runEmbeddedPiAgent()` call in DeXMart's ingress pipeline still compiles and works
- [ ] Task 3.5: Run `pnpm build` + DeXMart ingress tests

### v2026.3.22 — Plugin SDK + Baileys + IngressService (18 BREAKING, Injection: `session.ts` + `ingress-service.ts`)

> ⚠️ **HIGHEST RISK VERSION** — This is the single most dangerous sync step.

- [ ] Task 3.6: Pre-merge: snapshot `src/web/session.ts` and `src/ingress/ingress-service.ts`
- [ ] Task 3.7: Deep-review all 18 breaking changes against DeXMart codebase:
    - [ ] Plugin SDK migration: `openclaw/extension-api` → `openclaw/plugin-sdk/*` — scan all imports
    - [ ] `api.runtime.agent.runEmbeddedPiAgent` — verify DeXMart's direct import path still resolves
    - [ ] `ChannelMessageActionAdapter.describeMessageTool(...)` — check if DeXMart implements any channel message adapters
    - [ ] Legacy env name removal (`CLAWDBOT_*`, `MOLTBOT_*`) — scan `.env` files and config loaders
    - [ ] Chrome extension relay removed — verify DeXMart doesn't reference `browser.relayBindHost`
- [ ] Task 3.8: Git merge `v2026.3.22` (74 changes, 220 fixes) — manually resolve conflicts at BOTH injection points
- [ ] Task 3.9: Verify `src/web/session.ts` preserves `WaAuthStateFactory` type and `authStateFactory` option
- [ ] Task 3.10: Verify `src/ingress/ingress-service.ts` preserves `runEmbeddedPiAgent()` pipeline wiring
- [ ] Task 3.11: Run `pnpm build` — fix any TypeScript errors from Plugin SDK restructure
- [ ] Task 3.12: Run full test suite — document Phase 3 checkpoint

### v2026.4.14 — Baileys Media Encryption (Injection: `session.ts`)

- [ ] Task 3.13: Pre-merge: snapshot `src/web/session.ts`
- [ ] Task 3.14: Review Baileys media encryption patch — determine if it conflicts with `authStateFactory`
- [ ] Task 3.15: Git merge `v2026.4.14` (latest) — resolve `session.ts` conflicts
- [ ] Task 3.16: Verify `src/web/session.ts` preserves DeXMart's `WaAuthStateFactory` + `authStateFactory`
- [ ] Task 3.17: Run `pnpm build` — zero TypeScript errors

- [ ] Task 3.18: Run full test suite (`CI=true pnpm test`) — document comprehensive baseline
- [ ] Task: Conductor - User Manual Verification 'Phase 3: High-Risk Injection Point Versions' (Protocol in workflow.md)

---

## Phase 4: Post-Sync Validation & Category A Test Recovery

- [ ] Task 4.1: Un-skip all Category A upstream tests (79 files) — remove `// upstream: pending sync` annotations
- [ ] Task 4.2: Run un-skipped Category A tests — document which now pass vs. still fail
- [ ] Task 4.3: For tests that still fail, investigate and classify:
    - [ ] Tests fixed by sync → mark as passing
    - [ ] Tests still failing → re-annotate with specific upstream issue reference
- [ ] Task 4.4: Run full test suite — capture final test counts (total, passing, skipped, failed)
- [ ] Task 4.5: Update `docs/session-logs/test-health-baseline.md` with post-sync numbers
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Post-Sync Validation' (Protocol in workflow.md)

---

## Phase 5: Documentation & Finalization

- [ ] Task 5.1: Update `docs/OPENCLAW_UPSTREAM_REPORT.md` — set "Last Synced Version" to `v2026.4.14`
- [ ] Task 5.2: Update `docs/architecture/FUSION_STRATEGY.md` Section 4.3 — record sync version and date
- [ ] Task 5.3: Run `scripts/automation/upstream-watcher.ts` (incremental mode) — verify no new upstream activity missed
- [ ] Task 5.4: Squash-merge sync branch into main development branch
- [ ] Task 5.5: Clean up temporary snapshots and triage files
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Documentation & Finalization' (Protocol in workflow.md)
