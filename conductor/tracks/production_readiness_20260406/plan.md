# Implementation Plan: Production Readiness & Security Verification

## Phase 1: Smoke Test — Runtime Verification [BLOCKING GATE]
Goal: Prove `src/main.ts` boots and processes a message end-to-end. **Nothing else proceeds until this passes.**

- [x] Task: Boot Verification — run `pnpm dev` and diagnose all subsystem initialization
    - [x] Verify Express server starts on expected port
    - [x] Verify WebSocket server initializes (Socket.io)
    - [x] Verify channel watchdog starts (`channelService.startWatchdog()`)
    - [x] Verify usage flush scheduler starts (`startUsageFlushScheduler()`)
    - [x] Verify agent event listener starts (`startAgentEventListener()`)
    - [x] Document all boot errors encountered
    - [x] Fix each boot error, re-test until clean boot achieved
- [ ] Task: Channel Connection — connect a WhatsApp channel via QR code
    - [ ] Verify QR code is generated and served to the frontend
    - [ ] Verify Firestore auth state is created at `/users/{userId}/channels/{channelId}/auth`
    - [ ] Verify channel status updates broadcast via WebSocket
- [ ] Task: End-to-End Message Processing — send a message and verify agent responds
    - [ ] Send a test message to the connected WhatsApp channel
    - [ ] Verify `IngressService` receives the message
    - [ ] Verify `runEmbeddedPiAgent()` is invoked (not a bridge or wrapper)
    - [ ] Verify agent generates a response and sends it back
    - [ ] Verify `MastermindStreamService` broadcasts reasoning events via WebSocket
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Smoke Test — Runtime Verification' (Protocol in workflow.md)

## Phase 2: Security & Billing Integration Tests
Goal: Prove B2C tenant isolation and billing enforcement with automated tests. **Requires Phase 1 clean boot.**

- [x] Task: Write B2C Tenant Isolation Integration Tests (TDD Red → Green)
    - [x] Create `src/tenancy/__tests__/isolation.integration.test.ts`
    - [x] Write test: User A cannot read User B's Firestore documents (sessions, agents, channels)
    - [x] Write test: User A cannot write to User B's Firestore paths
    - [x] Write test: User A cannot enumerate/list User B's resources
    - [x] Write test: API endpoints with User A's JWT reject access to User B's data (401/403)
    - [x] Write test: Channel operations are scoped to owning user only
    - [x] Write test: `UserContextResolver` never resolves a context for a mismatched userId/channelId pair
    - [x] Run tests — verify all pass (≥10 test cases) — 14 tests passing
    - [x] Verify coverage ≥80% for `src/tenancy/`
- [x] Task: Write Billing Enforcement Integration Tests (TDD Red → Green)
    - [x] Create `src/billing/__tests__/enforcement.integration.test.ts`
    - [x] Write test: Free tier user denied access to Pro-only models (`filterModelsForUser` returns empty)
    - [x] Write test: Free tier user hits `maxChannels` gate — `assertCan('startChannel')` throws 402
    - [x] Write test: Free tier user hits `maxAgents` gate — `assertCan('createAgent')` throws 402
    - [x] Write test: Free tier user hits monthly message quota — `assertCan('sendMessage')` throws 402
    - [x] Write test: Free tier user denied gated feature — `assertCan('feature:campaigns')` throws 402
    - [x] Write test: Gate denial returns HTTP 402 with structured `PLAN_LIMIT_*` error code
    - [x] Write test: Upgrade path — denied on Free → upgrade context to Pro → assertCan passes
    - [x] Write test: 10% overage grace period on message quota before hard block
    - [x] Run tests — verify all pass (≥10 test cases) — 28 tests passing
    - [x] Verify coverage ≥80% for `src/billing/`
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Security & Billing Integration Tests' (Protocol in workflow.md)

## Phase 3: Production Runtime & Data Unification
Goal: Define production entrypoint and unify Firestore data paths. Close remaining FUSION_STRATEGY.md gates.

- [ ] Task: Add Production Start Script
    - [ ] Add `"start": "tsx src/main.ts"` to `package.json` scripts
    - [ ] Verify `pnpm start` boots without file watcher
    - [ ] Verify clean shutdown on SIGTERM (watchdog stops, usage flushed, process exits)
    - [ ] Update `conductor/tech-stack.md` to document production entrypoint
- [ ] Task: Write Firestore Migration Script Tests (TDD Red Phase)
    - [ ] Create `scripts/__tests__/migrate-tenants-to-users.test.ts`
    - [ ] Write test: dry-run mode logs operations without writing to Firestore
    - [ ] Write test: migration copies all subcollections from `tenants/{id}/` to `users/{id}/`
    - [ ] Write test: migration is idempotent (second run produces zero new writes)
    - [ ] Write test: data integrity verification (document counts match, field values preserved)
    - [ ] Run tests — confirm they fail (Red phase)
- [ ] Task: Implement Firestore Migration Script (TDD Green Phase)
    - [ ] Create `scripts/migrate-tenants-to-users.ts`
    - [ ] Implement `--dry-run` mode (default — logs only, no writes)
    - [ ] Implement live migration with progress logging and batch writes
    - [ ] Implement post-migration integrity verification (count + spot-check)
    - [ ] Run tests — verify all pass (Green phase)
- [ ] Task: Remove Legacy Firestore Path References
    - [ ] Search `src/` for all `tenants/` Firestore path references
    - [ ] Update each reference to use `users/{userId}/` path exclusively
    - [ ] Verify all existing tests still pass after path updates
    - [ ] Update `docs/architecture/DATA_MODEL.md` to reflect unified paths (remove "both coexist" language)
- [ ] Task: Update Fusion Success Criteria & Close Gates
    - [ ] Update `docs/architecture/FUSION_STRATEGY.md` — check completed success criteria boxes
    - [ ] Mark: `[x] B2C isolation verified`, `[x] Billing enforcement verified`
    - [ ] Add smoke test result documentation to FUSION_STRATEGY.md Phase 4
    - [ ] Remove "What remains" section or mark items complete
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Production Runtime & Data Unification' (Protocol in workflow.md)
