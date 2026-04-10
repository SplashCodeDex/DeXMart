# Specification: Pre-Existing Test Suite Failures — Audit, Root-Cause Investigation & Systematic Remediation

## Overview

During Phase 1 Verification of the Architecture & Documentation Sync track (2026-04-10),
the full test suite revealed ~141 failing test files / 223+ failing tests. These failures
predate the current work and originate from the OpenClaw flattening commit:

  f11789c8b  ref: Flatten OpenClaw and reorganize DeXMart core services

Two files were patched in-session (see Known Starting Context). The remaining ~139+ failing
files have UNKNOWN root causes and must be investigated from actual test output — not assumed.

This track is a structured audit and remediation effort. Every fix must be preceded by reading
actual failure output and source code. No guessing. No assumptions.

## Functional Requirements

### FR-1: Establish Clean Baseline
- Terminate all concurrent vitest/node processes before running
- Capture FULL, untruncated test output (no `| tail`) to a log file
- Record exact count of failing test files and tests

### FR-2: Categorize All Failures
For each failing file, identify the failure category by reading both the error output and
the relevant source file:

| Category | Name | Description |
|---|---|---|
| A | Mock Gap | `vi.mock` factory is missing an export the implementation now uses |
| B | Error Message Mismatch | Test `.rejects.toThrow()` regex/string doesn't match current error text |
| C | Import Error | Module fails to load at test file startup (broken path, missing export) |
| D | Logic Regression | Implementation changed; test reflects old behavior |
| E | Timeout | Test hangs or exceeds 5000ms timeout |
| F | Unknown | Root cause unclear after reading source — requires escalation |

### FR-3: Fix All Failures Systematically by Category
Fixes must be applied category by category, with verification between each:
- **A:** Add missing exports to `vi.mock` (use `importOriginal` for partial mocks)
- **B:** Update regex/string to match current implementation's actual error message
- **C:** Trace import chain, verify each path exists before updating
- **D:** Determine with evidence whether implementation or test is correct — document before fixing
- **E:** Fix async pattern, increase timeout, or improve mocking
- **F:** Document exhaustively and create a GitHub issue for each

### FR-4: Final Clean Verification
- After all fixes, run the full test suite in isolation
- Confirm 0 failing test files (or document any remaining Category F exclusions with issue links)

## Non-Functional Requirements

- **NFR-1: Evidence-Based Only** — No fix may be applied without first reading actual failure
  output AND relevant source file. Document "Root Cause Evidence" before each fix.
- **NFR-2: Atomic Commits** — Each logical fix group (by category or by module) is a separate
  commit. Messages must reference the failing file and root cause.
- **NFR-3: No Production Code Changes Without Justification** — Only modify implementation
  code if a test reveals an actual bug AND the evidence clearly supports it.

## Acceptance Criteria

- [ ] Full, untruncated test baseline log captured with no concurrent vitest processes running
- [ ] All failing test files are categorized in `failure-catalog.md` with documented root causes
- [ ] All Category A–E failures are fixed and verified to pass in isolation
- [ ] The full test suite passes at 0 failures in isolation
- [ ] Category F failures (if any) are documented with GitHub issues

## Out of Scope

- Adding new tests for currently untested code (separate coverage track)
- Rewriting tests for functionality that no longer exists (delete, don't rewrite)
- Introducing new features or refactoring production code beyond what's needed to fix a test

## Known Starting Context

### Fixes Already Applied (2026-04-10, Architecture & Documentation Sync Track)

| File | Category | Fix |
|---|---|---|
| `src/cron/isolated-agent/delivery-target.test.ts` | A | Added `hasAnyWhatsAppAuth: vi.fn().mockReturnValue(false)` to `vi.mock("../../web/accounts.js")` + added `vi.mock("../../infra/outbound/targets.js")` with passthrough `resolveOutboundTarget` |
| `src/infra/outbound/message-action-params.test.ts` | B | Updated error regex from `/outside workspace root\|outside/i` to `/outside workspace root\|outside\|path alias escape blocked/i` |

### Documented Root Causes (Category A — Mock Gap)

**`hasAnyWhatsAppAuth` not exported from `vi.mock("../../web/accounts.js")`:**
- `src/web/accounts.ts:64` exports `hasAnyWhatsAppAuth(cfg: OpenClawConfig): boolean`
- `src/config/plugin-auto-enable.ts:173` calls it inside `isWhatsAppConfigured()`
- Call chain: `resolveDeliveryTarget → resolveOutboundTarget (targets.ts:187) → resolveOutboundChannelPlugin (channel-resolution.ts:76) → maybeBootstrapChannelPlugin (channel-resolution.ts:47) → applyPluginAutoEnable (plugin-auto-enable.ts:481) → resolveConfiguredPlugins (plugin-auto-enable.ts:344) → isChannelConfigured (plugin-auto-enable.ts:194) → isWhatsAppConfigured (plugin-auto-enable.ts:173) → hasAnyWhatsAppAuth`
- Result: vitest throws "No 'hasAnyWhatsAppAuth' export is defined on the mock"
- This same call chain may affect other test files that mock `accounts.js` — scan with:
  `grep -r "accounts.js" src --include="*.test.ts" -l`

### Baseline Measurements (Pre-Fix, Concurrent Runs — Inflated by Timeouts)

| Run Timestamp | Failing Files | Failing Tests | Notes |
|---|---|---|---|
| 02:22:14 | 141 | 223 | `CI=true pnpm test \| tail -80` |
| 02:32:46 | 147 | 240 | `pnpm test:coverage` |
| 02:39:06 | 155 | 253 | `pnpm exec vitest run --reporter=dot` |

All three ran concurrently, inflating timeout failures. True baseline is ~141 files.
**First step of this track MUST be a clean isolated run with no other vitest processes.**

### Origin Commit
All failures trace back to:
```
f11789c8b  ref: Flatten OpenClaw and reorganize DeXMart core services
```
Verify for any file with: `git log --oneline --all -- <failing-file.ts>`
Expected: only `f11789c8b` appears (file never modified after initial port).
