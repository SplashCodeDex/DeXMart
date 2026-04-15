# Plan: Test Suite Health — Triage & Fix 199 Pre-existing Failures

## Phase 1: Triage & Documentation [checkpoint: 67a9359]

- [x] Task 1.1: Run full test suite and capture all 131 failing test file paths with error summaries [1bae813]
- [x] Task 1.2: Categorize every failing file into Categories A–F, creating a triage document at `docs/session-logs/test-triage-report.md` [1bae813]
- [x] Task 1.3: For each category, document the exact root cause and specific remediation action [1bae813]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Triage & Documentation' (Protocol in workflow.md) [67a9359]

---

## Phase 2: Fix DeXMart-Relevant Tests (Categories C & D) [checkpoint: b284ae7]

- [x] Task 2.1: Fix `test/mocks/baileys.ts` — use real EventEmitter for `ev` so session.ts event handlers fire + update `getLastSocket()` to handle object-type socket [dc53b0e]
- [x] Task 2.2: Fix `src/web/session.test.ts` — all 8 tests pass after baileys mock fix [dc53b0e]
- [x] Task 2.3: Fix `src/services/IngressService.test.ts` — updated mock expectation to use `handleCommonMessage` properly [389d8be]
- [x] Task 2.4: Fix `src/services/IngressService.hierarchy.test.ts` and `IngressService.path.test.ts` — align with current routing behavior [2370a1e]
- [x] Task 2.5: Fix `src/middleware/authMiddleware.test.ts` — update expected status code (403 → 401) if prod code is correct, or fix prod code if 403 is intended [6d58140]
- [x] Task 2.6: Fix `src/jobs/index.test.ts` — resolve `vi.mock` hoisting issue (`Cannot access 'mockJobQueueService' before initialization`) [2f8880b]
- [x] Task 2.7: Fix `src/services/flowEngine.skill.test.ts` — update skill interface expectations [9830fe1]
- [x] Task 2.8: Fix `src/routes/channelLifecycle.test.ts` — update `deleteChannel` parameter expectations [84a54b4]
- [x] Task 2.9: Fix `src/controllers/` test files — update authController test expectations [1b73603]
- [x] Task 2.10: Run Category C+D tests (green) + verify no regressions [b284ae7]
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Fix DeXMart-Relevant Tests' (Protocol in workflow.md)

---

## Phase 3: Fix Telegram Module Tests (Category B) [checkpoint: 5081cd1]

- [x] Task 3.1: Diagnose `src/telegram/webhook.test.ts` — identify why all 8 tests timeout (likely async mock that never resolves)
- [x] Task 3.2: Fix webhook test async flow — update mock to properly resolve/reject
- [~] Task 3.3: Fix `src/telegram/bot.test.ts` and `bot.create-telegram-bot.test.ts` — update `createTelegramBot` mock shape
- [x] Task 3.4: Fix `src/telegram/fetch.test.ts` — update `resolveTelegramFetch` undici dispatcher expectations
- [x] Task 3.5: Fix `src/telegram/bot.media.downloads-media-file-path-no-file-download.test.ts` — update forwarded burst / media group expectations
- [x] Task 3.6: Run all Telegram tests (green) + verify no regressions
- [x] Task: Conductor - User Manual Verification 'Phase 3: Fix Telegram Module Tests' (Protocol in workflow.md)

---

## Phase 4: Skip/Annotate OpenClaw Engine Tests (Categories A, E, F)

- [x] Task 4.1: Write a script `scripts/annotate-upstream-tests.ts` to batch-skip tests with standardized annotation format: `it.skip('test name', /* upstream: relies on unported OpenClaw test infrastructure */ ...)`
- [x] Task 4.2: Apply skip annotations to Category A tests (~85 files in `src/agents/`, `src/cron/`, `src/auto-reply/`, `src/browser/`, `src/infra/`, `src/commands/`, `src/config/`, `src/gateway/`)
- [x] Task 4.3: Apply skip annotations to Category E tests (~12 files in `src/security/`)
- [x] Task 4.4: Apply skip annotations to Category F tests (~8 files in `src/signal/`, `src/slack/`, `src/line/`, `src/discord/`, `src/facebook/`, `src/wizard/`, misc)
- [x] Task 4.5: Fix `src/auto-reply/reply/reply-plumbing.test.ts` and `session.test.ts` — investigate if these test DeXMart-relevant reply logic (fix if yes, skip if upstream-only)
- [x] Task 4.6: Fix `src/tools/cmd.test.ts` — 3 translate tests failing (likely GeminiService mock issue — investigate if DeXMart-relevant)
- [x] Task 4.7: Fix `src/analytics/` and `src/hooks/` failures — investigate root cause and fix or skip
- [ ] Task 4.8: Run full test suite — confirm zero failures
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Skip/Annotate OpenClaw Engine Tests' (Protocol in workflow.md)

---

## Phase 5: Establish Test Health Baseline

- [ ] Task 5.1: Run `CI=true pnpm test` and capture final test counts: total, passing, skipped, failed
- [ ] Task 5.2: Document baseline in `docs/session-logs/test-health-baseline.md` with breakdown by category
- [ ] Task 5.3: Clean up temporary triage files and scripts
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Establish Test Health Baseline' (Protocol in workflow.md)
