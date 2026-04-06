# Specification: Production Readiness & Security Verification

## Overview

This track addresses the 5 critical gates identified in the post-fusion stability audit that are NOT covered by existing tracks (`true_fusion_audit_sync_20260401` handles bridge cleanup and doc sync separately). The system is structurally sound — typecheck clean (2,771 files, zero errors), 153 tests passing, fusion wiring complete — but has never been verified at runtime. This track gates the project for production readiness by proving:

1. The unified `src/main.ts` boots and processes messages end-to-end
2. B2C tenant isolation is enforced (User A cannot see User B's data)
3. Billing gates work correctly (Free users cannot access Pro features)
4. A production runtime is defined (not just `tsx watch`)
5. Firestore data paths are unified (`tenants/` → `users/`)

**Environment:** Local dev — `pnpm dev` against real Firebase project and Redis instance.

## Functional Requirements

### FR-1: End-to-End Smoke Test
- Boot `src/main.ts` via `pnpm dev` against real Firebase and Redis
- Verify: Express server starts, WebSocket initializes, channel watchdog starts, usage flush scheduler starts
- Connect a WhatsApp channel via QR code
- Send a message to the connected channel
- Verify: message received by `IngressService`, routed to `runEmbeddedPiAgent()`, agent responds
- Verify: `MastermindStreamService` broadcasts reasoning events via WebSocket
- Document any boot failures, fix them, and re-test until clean boot is achieved

### FR-2: B2C Tenant Isolation Integration Tests
- Write integration tests proving User A cannot access User B's data
- Test vectors: Firestore reads (sessions, agents, channels, config), API endpoints (different JWT tokens), channel operations
- Path: `src/tenancy/__tests__/isolation.integration.test.ts`
- Must cover: read isolation, write isolation, list isolation (User A cannot enumerate User B's resources)
- Minimum 10 test cases

### FR-3: Billing Enforcement Integration Tests
- Write integration tests proving Free tier users cannot access Pro features
- Test vectors: model access (`filterModelsForUser`), channel creation (`maxChannels`), agent creation (`maxAgents`), message sending (monthly quota), feature flags (campaigns)
- Path: `src/billing/__tests__/enforcement.integration.test.ts`
- Must cover: gate denial (HTTP 402), gate pass, upgrade path (denied → upgrade plan → pass)
- Minimum 10 test cases

### FR-4: Production Runtime Definition
- Add `"start": "tsx src/main.ts"` to `package.json` scripts
- Verify the start script boots successfully (no file watcher, clean exit on SIGTERM)
- Document the production entrypoint in `conductor/tech-stack.md`

### FR-5: Firestore Path Migration Script
- Write a one-time migration script: `scripts/migrate-tenants-to-users.ts`
- Read all documents under `tenants/{tenantId}/` subcollections
- Write them to `users/{userId}/` with identical structure
- Verify data integrity after migration (count documents, spot-check fields)
- Update codebase: remove all `tenants/` path references, make `users/` the sole path
- **Dry-run mode**: log what would be migrated without writing (safety gate)
- Script must be idempotent (safe to run multiple times)

## Non-Functional Requirements
- All integration tests must run in CI (`vitest run` — no manual steps)
- Smoke test results must be documented (pass/fail with logs)
- Migration script must be idempotent
- Zero changes to OpenClaw's original files (injection points only)

## Acceptance Criteria
- [ ] `pnpm dev` boots successfully and processes at least 1 message end-to-end
- [ ] B2C isolation integration tests pass (≥10 test cases)
- [ ] Billing enforcement integration tests pass (≥10 test cases)
- [ ] `pnpm start` boots the production server without file watchers
- [ ] Firestore migration script runs successfully in dry-run mode
- [ ] No `tenants/` path references remain in active `src/` code after migration
- [ ] `FUSION_STRATEGY.md` success criteria checkboxes updated to reflect completed gates

## Out of Scope
- Bridge cleanup (`DeXMartBrain.ts`, `DeXMartToolBridge.ts`, `MastermindSkillBridge.ts`) — covered by `true_fusion_audit_sync_20260401`
- Documentation sync (stale diagrams, SERVICE_CATALOG) — covered by `true_fusion_audit_sync_20260401`
- `openclaw/` directory deletion — covered by `true_fusion_audit_sync_20260401`
- Frontend changes
- New features or behavior changes
