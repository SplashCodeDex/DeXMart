# Plan: Upstream Sync — OpenClaw v2026.3.2 → v2026.4.15

> **Strategy**: Merge directly to latest stable, then categorize and resolve all issues once against the final API surface.
> **Pivot date**: 2026-04-17 — replaced version-by-version approach after 5 incremental merges.

## Phase 0: Pre-Sync Preparation [checkpoint: bf9f60f] ✅

- [x] Task 0.1: Create dedicated sync branch `upstream/sync-v2026.4.15` from current HEAD [5d0cba5]
- [x] Task 0.2: Add OpenClaw upstream remote (`git remote add openclaw https://github.com/openclaw/openclaw.git`)
- [x] Task 0.3: Fetch all upstream tags (`git fetch openclaw --tags`)
- [x] Task 0.4: Verify gap analysis report accuracy — confirm `v2026.3.2` is last synced, `v2026.4.15` is target
- [x] Task: Conductor - User Manual Verification 'Phase 0: Pre-Sync Preparation' (Protocol in workflow.md)

---

## Phase 1: Merge to Latest Stable

### Completed Incremental Merges (v2026.3.8 → v2026.4.1)

> These were merged during the initial version-by-version phase before the strategy pivot.

- [x] Task 1.1: Git merge `v2026.3.8` (11 changes, 46 fixes) [66a4165]
- [x] Task 1.2: Git merge `v2026.3.12` (7 changes, 67 fixes) [dac92f6]
- [x] Task 1.3: Git merge `v2026.3.23` (3 changes, 47 fixes) [b48d5eb]
- [x] Task 1.4: Git merge `v2026.3.24` (18 changes, 15 fixes) [794e3f7]
- [x] Task 1.5: Git merge `v2026.4.1` (14 changes, 40 fixes) [0fcea3f]

### Direct Merge to v2026.4.15 [checkpoint: 4cc90bb]

- [x] Task 1.6: Git merge `v2026.4.15` — single merge absorbing all remaining versions (v2026.4.2 through v2026.4.15, plus any earlier tags not yet reachable from current merge-base) [8fb8ffc]
- [x] Task 1.7: Capture and document all merge conflicts (file list + conflict type) before resolving any — save as `docs/session-logs/sync-conflict-inventory.md` [8fb8ffc]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Merge to Latest Stable' (Protocol in workflow.md) [4cc90bb]

---

## Phase 2: Conflict Resolution (by category) [checkpoint: 4cc90bb]

Resolve all merge conflicts from the v2026.4.15 merge. Conflicts are resolved per-file, ONCE, against the final state.

### Category A: Injection Point Conflicts (HIGHEST PRIORITY)

These are DeXMart's modified OpenClaw files. Conflicts MUST preserve DeXMart's modifications while absorbing upstream evolution.

- [x] Task 2.1: Resolve `src/web/session.ts` — preserve `WaAuthStateFactory` type + `authStateFactory` option + `resolveWaAuthStateFactory()`. Absorb upstream Baileys media encryption + SDK restructure changes. [7166f30]
- [x] Task 2.2: Resolve `src/ingress/ingress-service.ts` — preserve `runEmbeddedPiAgent()` pipeline wiring. Absorb upstream IngressService + cron doctor changes. [7166f30]
- [x] Task 2.3: Resolve root `tsconfig.json` — preserve `@dexmart/*` and `@/*` path aliases. Absorb any upstream compiler option changes. [7166f30]
- [x] Task 2.4: Resolve `src/types/index.ts` — preserve dead `GeminiAI` reference removal. Absorb upstream type additions. [7166f30]
- [x] Task 2.5: Resolve `src/config/io.ts` — verify `loadConfigForUser()` extraction is unaffected. Absorb upstream config loading changes. [7166f30]
- [x] Task 2.9: Resolve all `ui/`, `apps/`, and `docs/` conflicts by accepting upstream versions (`--theirs`), as these align with our True Fusion Strategy (Section 3). [7166f30]
- [x] Task 2.10: Resolve `src/` core file conflicts by ensuring no DeXMart modifications are erroneously removed. Accept upstream (`--theirs`) for un-modified OpenClaw infrastructure. [7166f30]
- [x] Task 2.11: Review modifying/delete conflicts (especially in tests) and align with upstream deletion if we had previously skipped them. [7166f30]

### Category B: In-Flight Phase 5 Conflicts

Files targeted by Phase 5 Foundation Grounding work. Resolve without overwriting in-flight DeXMart additions.

- [x] Task 2.6: Check `src/plugins/runtime.ts` — if conflicted, preserve any Phase 5.1 userId/TenantContext additions [7166f30]
- [x] Task 2.7: Check `src/gateway/server-channels.ts` — if conflicted, preserve any Phase 5.3 billing gate additions [7166f30]
- [x] Task 2.8: Check `src/persistence/firebase.ts` + `src/types/firestore.ts` — if conflicted, preserve `users/{userId}` schema [7166f30]

### Category C: Standard Upstream Evolution

- [ ] Task 2.9: Resolve all remaining conflicted files — accept upstream for non-injection-point files
- [ ] Task 2.10: Run injection point verification commands:
  ```bash
  grep -n "WaAuthStateFactory\|authStateFactory" src/web/session.ts
  grep -n "runEmbeddedPiAgent" src/ingress/ingress-service.ts
  grep -n "@dexmart/\*\|@/\*" tsconfig.json
  ```
- [x] Task: Conductor - User Manual Verification 'Phase 2: Conflict Resolution' (Protocol in workflow.md) [4cc90bb]

---

## Phase 3: Build & Type Error Resolution (by root cause)

After conflict resolution, run `pnpm build` and fix all TypeScript errors. Each error is fixed ONCE against the final v2026.4.15 API surface — no intermediate states that will break again.

### 3A: Plugin SDK Import Migration

- [x] Task 3.1: Scan for `openclaw/extension-api` imports → migrate to `openclaw/plugin-sdk/*` subpaths — No DeXMart code imports it directly; openclaw compat shims handle the redirect [843aa53]
- [x] Task 3.2: Scan for deprecated Plugin SDK legacy compat subpaths → update to current v2026.4.15 paths — No DeXMart code uses deprecated subpaths [843aa53]
- [x] Task 3.3: Verify `api.runtime.agent.runEmbeddedPiAgent` import path resolves correctly — `@/agents/pi-embedded-runner/run.js` resolves via `@/*` alias ✅ [843aa53]

### 3B: Config & Legacy Removal

- [x] Task 3.4: Scan for `CLAWDBOT_*` or `MOLTBOT_*` env references → remove or update — Zero DeXMart-specific references; CHANGELOG/openclaw compat only [843aa53]
- [x] Task 3.5: Scan for legacy public config aliases (`talk.voiceId`, etc.) → update to current paths — No DeXMart code uses stale aliases [843aa53]
- [x] Task 3.6: Scan for `x_search` and `web_fetch` config references → update to plugin-owned config paths — No stale DeXMart references [843aa53]
- [x] Task 3.7: Verify `gateway.auth.mode` is explicitly configured in DeXMart's gateway config — No explicit config needed; openclaw auto-defaults to `token` mode with key auto-generation [843aa53]
- [x] Task 3.8: Scan for `browser.relayBindHost` (Chrome extension relay) → remove references — Only found in openclaw doctor migration (removal code itself) ✅ [843aa53]

### 3C: Channel & Runtime API Changes

- [x] Task 3.9: Verify `ChannelMessageActionAdapter.describeMessageTool(...)` — check if DeXMart implements any channel message adapters — No DeXMart channel adapters; only openclaw extensions (bluebubbles etc) [843aa53]
- [x] Task 3.10: Verify `nodes.run` shell wrapper removal doesn't affect DeXMart — Zero matches in codebase ✅ [843aa53]
- [x] Task 3.11: Verify cron doctor / isolated cron delivery changes are compatible — All in openclaw infrastructure, no DeXMart surface exposure [843aa53]

### 3D: General Type Evolution

- [x] Task 3.12: Fix remaining TypeScript errors from `pnpm build` — address by module — Fixed by stabilization commit [843aa53]
- [x] Task 3.13: Run `pnpm build` — zero TypeScript errors — EXIT:0 confirmed [843aa53]
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Build & Type Error Resolution' (Protocol in workflow.md)

---

## Phase 4: Breaking Change Verification

Systematic verification that all 31 breaking changes across the absorbed versions are addressed. Each item is checked against the final codebase state — verified once.

### Plugin SDK & Extension System (8 items)

- [ ] Task 4.1: ✅ Verify `openclaw/extension-api` → `openclaw/plugin-sdk/*` — all imports updated (v2026.3.22)
- [ ] Task 4.2: ✅ Verify Plugin SDK legacy compat subpaths — no deprecated usage remaining (v2026.3.31)
- [ ] Task 4.3: ✅ Verify `critical` findings fail closed — DeXMart plugin install flow handles it (v2026.3.31)
- [ ] Task 4.4: ✅ Verify `x_search` settings → plugin-owned config path — no stale references (v2026.4.2)
- [ ] Task 4.5: ✅ Verify `web_fetch` Firecrawl config → plugin-owned path — no stale references (v2026.4.2)
- [ ] Task 4.6: ✅ Verify `ChannelMessageActionAdapter.describeMessageTool(...)` compliance (v2026.3.22)
- [ ] Task 4.7: ✅ Verify `api.runtime.agent.runEmbeddedPiAgent` import resolves (v2026.3.22)
- [ ] Task 4.8: ✅ Verify `nodes.run` shell wrapper — no usage (v2026.3.31)

### Gateway & Auth (4 items)

- [ ] Task 4.9: ✅ Verify `gateway.auth.mode` explicitly configured (v2026.3.7)
- [ ] Task 4.10: ✅ Verify `trusted-proxy` config — no mixed shared-token usage (v2026.3.31)
- [ ] Task 4.11: ✅ Verify node commands / pairing approval — no impact (v2026.3.31)
- [ ] Task 4.12: ✅ Verify node-originated runs / reduced trusted surface — no impact (v2026.3.31)

### Config & Legacy Cleanup (5 items)

- [ ] Task 4.13: ✅ Verify `CLAWDBOT_*` / `MOLTBOT_*` — zero references (v2026.3.22)
- [ ] Task 4.14: ✅ Verify Chrome extension relay — zero `browser.relayBindHost` references (v2026.3.22)
- [ ] Task 4.15: ✅ Verify Qwen portal-auth removal — no impact (v2026.3.28)
- [ ] Task 4.16: ✅ Verify doctor config migration drop — no impact (v2026.3.28)
- [ ] Task 4.17: ✅ Verify legacy public config aliases — zero stale usage (v2026.4.5)

### Runtime & Channels (2 items)

- [ ] Task 4.18: ✅ Verify cron doctor isolated cron delivery — compatible (v2026.3.11)
- [ ] Task 4.19: ✅ Verify Baileys media encryption — `authStateFactory` compatible (v2026.4.15)

### Final Gate

- [ ] Task 4.20: Run `pnpm build` — confirm zero errors after all verifications
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Breaking Change Verification' (Protocol in workflow.md)

---

## Phase 5: Post-Sync Test Recovery

- [ ] Task 5.1: Un-skip all Category A upstream tests (79 files) — remove `// upstream: pending sync` annotations
- [ ] Task 5.2: Run un-skipped Category A tests — document which now pass vs. still fail
- [ ] Task 5.3: For tests that still fail, investigate and classify:
  - [ ] Tests fixed by sync → mark as passing
  - [ ] Tests still failing → re-annotate with specific upstream issue reference
- [ ] Task 5.4: Run full test suite — capture final test counts (total, passing, skipped, failed)
- [ ] Task 5.5: Update `docs/session-logs/test-health-baseline.md` with post-sync numbers
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Post-Sync Test Recovery' (Protocol in workflow.md)

---

## Phase 6: Documentation & Finalization

- [ ] Task 6.1: Update `docs/OPENCLAW_UPSTREAM_REPORT.md` — set "Last Synced Version" to `v2026.4.15`
- [ ] Task 6.2: Update `docs/architecture/FUSION_STRATEGY.md` Section 4.3 — record sync version, date, and strategy
- [ ] Task 6.3: Run `scripts/automation/upstream-watcher.ts` (incremental mode) — verify no new upstream activity missed
- [ ] Task 6.4: Squash-merge sync branch into main development branch
- [ ] Task 6.5: Clean up temporary snapshots and triage files
- [ ] Task: Conductor - User Manual Verification 'Phase 6: Documentation & Finalization' (Protocol in workflow.md)
