# Implementation Plan: Pre-Existing Test Suite Failures — Audit, Root-Cause Investigation & Systematic Remediation

## Phase 1: Establish Clean Baseline

- [ ] Task: Terminate all running vitest/node processes (`pkill -f vitest || true`)
- [ ] Task: Run the full suite in strict isolation, capturing full untruncated output:
  `pnpm exec vitest run --reporter=verbose 2>&1 | tee conductor/tracks/test_failures_audit_20260410/test-baseline.log`
- [ ] Task: Parse the log to extract (a) exact failing file count, (b) list of all failing file paths, (c) first error per file — write to `conductor/tracks/test_failures_audit_20260410/failure-catalog.md`
- [ ] Task: Commit the baseline log and catalog skeleton
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Establish Clean Baseline' (Protocol in workflow.md)

## Phase 2: Categorize All Failures

- [ ] Task: For each failing file in `failure-catalog.md`: read its full error block from the baseline log AND read the source file — assign Category A/B/C/D/E/F
- [ ] Task: Search for all other test files that mock `accounts.js` (or paths that resolve to it) to find additional Category A candidates matching the `hasAnyWhatsAppAuth` pattern:
  `grep -r "accounts.js" src --include="*.test.ts" -l`
- [ ] Task: Update `failure-catalog.md` with root cause evidence and proposed fix for each file
- [ ] Task: Commit the completed catalog
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Categorize All Failures' (Protocol in workflow.md)

## Phase 3: Fix Category A — Mock Gaps

- [ ] Task: For each Category A file: read the `vi.mock` factory, identify the missing exports by cross-referencing what the implementation calls, add them (use `importOriginal` for partial mocking)
- [ ] Task: Run Category A files in isolation to verify: `pnpm exec vitest run <file1> <file2> ...`
- [ ] Task: Commit: `fix(tests): resolve vi.mock gaps — missing exports in <module> mock`
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Fix Category A — Mock Gaps' (Protocol in workflow.md)

## Phase 4: Fix Category B — Error Message Mismatches

- [ ] Task: For each Category B file: read the exact error thrown by the current implementation (run the test, read the "Received" value in the output), update `.rejects.toThrow()` regex to match
- [ ] Task: Run Category B files in isolation to verify
- [ ] Task: Commit: `fix(tests): sync error message regex in <test-file>`
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Fix Category B — Error Message Mismatches' (Protocol in workflow.md)

## Phase 5: Fix Category C — Import Errors

- [ ] Task: For each Category C file: read the module-level error, trace the import chain (`grep -r "from.*<broken-path>"` + `Glob`), verify the actual file path exists before updating
- [ ] Task: Run Category C files in isolation to verify
- [ ] Task: Commit: `fix(imports): restore broken import path in <test-file>`
- [ ] Task: Conductor - User Manual Verification 'Phase 5: Fix Category C — Import Errors' (Protocol in workflow.md)

## Phase 6: Fix Category D — Logic Regressions

- [ ] Task: For each Category D file: read the test expected behavior AND the current implementation — document in `failure-catalog.md` whether the test or the implementation is the source of truth
- [ ] Task: Apply fix only to what evidence supports (test OR implementation — not both unless both are wrong)
- [ ] Task: Run Category D files in isolation to verify
- [ ] Task: Commit: `fix(tests|impl): resolve logic regression in <file> — [evidence summary]`
- [ ] Task: Conductor - User Manual Verification 'Phase 6: Fix Category D — Logic Regressions' (Protocol in workflow.md)

## Phase 7: Fix Category E — Timeouts

- [ ] Task: For each Category E file: run it alone with no other tests running to determine if it is a true timeout or resource contention artifact:
  `pnpm exec vitest run <file> --reporter=verbose`
- [ ] Task: If true timeout: read the async pattern, fix the underlying hang or add a justified timeout value; if resource contention: document as environment-only flake
- [ ] Task: Run Category E files in isolation to verify
- [ ] Task: Commit: `fix(tests): resolve timeout in <test-file> — [root cause]`
- [ ] Task: Conductor - User Manual Verification 'Phase 7: Fix Category E — Timeouts' (Protocol in workflow.md)

## Phase 8: Document Category F — Unknown / Escalation

- [ ] Task: For each Category F file: write a full investigation report in `failure-catalog.md` — error output, relevant source code, what was attempted, why root cause is unclear
- [ ] Task: Create a GitHub issue for each Category F file with the investigation report as the body
- [ ] Task: Conductor - User Manual Verification 'Phase 8: Document Category F — Unknown / Escalation' (Protocol in workflow.md)

## Phase 9: Final Clean Verification

- [ ] Task: Terminate all vitest processes, run the full suite in isolation one final time
- [ ] Task: Confirm 0 failing test files (or all remaining are Category F with issue links)
- [ ] Task: Update `failure-catalog.md` with final resolution status for every file
- [ ] Task: Conductor - User Manual Verification 'Phase 9: Final Clean Verification' (Protocol in workflow.md)
