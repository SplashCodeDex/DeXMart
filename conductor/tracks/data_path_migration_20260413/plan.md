# Plan: Fix Task 5.9 Partial Migration — Data Isolation Bug

## Phase 1: Import Migration & Old File Deletion

- [x] Task 1.1: Write failing tests — Add a compile-time regression test that asserts `src/services/FirebaseService.ts` does NOT exist and that all `firebaseService` imports resolve from `@/persistence/firebase.js`
    - [x] Create `src/persistence/firebase.import-audit.test.ts` — uses `fs.existsSync` to assert old file absent, and greps `src/` for stale imports
- [x] Task 1.2: Migrate all runtime imports from `@/services/FirebaseService.js` → `@/persistence/firebase.js`
    - [x] `src/services/AgentService.ts`
    - [x] `src/services/ChannelService.ts`
    - [x] `src/services/ChannelManagerService.ts`
    - [x] `src/services/multiTenantService.ts`
    - [x] `src/services/userService.ts`
    - [x] `src/services/contactService.ts`
    - [x] `src/services/database.ts`
    - [x] `src/services/templateService.ts`
    - [x] `src/services/campaignService.ts`
    - [x] `src/services/webhookService.ts`
    - [x] `src/services/analytics.ts`
    - [x] `src/services/antiBanService.ts`
    - [x] `src/services/groupService.ts`
    - [x] `src/campaigns/campaign-service.ts`
    - [x] `src/jobs/campaignWorker.ts`
    - [x] `src/workers/antiBanResumeWorker.ts`
    - [x] `src/safety/anti-ban.ts`
    - [x] `src/controllers/authController.ts`
    - [x] `src/shared/user-service.ts`
    - [x] `src/shared/database.ts`
    - [x] `src/agents-management/agent-service.ts`
    - [x] `src/tenancy/tenant-service.ts`
    - [x] `src/lib/baileysFirestoreAuth.ts`
    - [x] `src/utils/resilienceHarness.ts`
    - [x] `src/persistence/firestore-auth-state.ts`
- [x] Task 1.3: Migrate all runtime imports in test files from `@/services/FirebaseService.js` → `@/persistence/firebase.js`
    - [x] `src/controllers/authController.test.ts`
    - [x] `src/services/ChannelService.test.ts`
    - [x] `src/services/ChannelService.lifecycle.test.ts`
    - [x] `src/services/ChannelService.cleanup.test.ts`
    - [x] `src/services/ChannelService.move.test.ts`
    - [x] `src/agents-management/agent-service.test.ts`
- [x] Task 1.4: Update all `'tenants/{tenantId}/...'` type annotations to `'users/{userId}/...'` across all ~50 call sites
    - [x] `src/jobs/campaignWorker.ts` (~12 annotations)
    - [x] `src/campaigns/campaign-service.ts` (~7 annotations)
    - [x] `src/services/contactService.ts` (~5 annotations)
    - [x] `src/services/database.ts` (~5 annotations)
    - [x] `src/services/templateService.ts` (~4 annotations)
    - [x] `src/services/ChannelManagerService.ts` (~3 annotations)
    - [x] `src/workers/antiBanResumeWorker.ts` (~2 annotations)
    - [x] `src/safety/anti-ban.ts` (~1 annotation)
    - [x] `src/services/antiBanService.ts` (~1 annotation)
    - [x] Any remaining files with `tenants/{tenantId}` type annotations
- [x] Task 1.5: Delete `src/services/FirebaseService.ts`
- [x] Task 1.6: Run tests (green) — verify `firebase.path-migration.test.ts` passes (7/7) + no regressions in existing passing tests
- [x] Task: Conductor - User Manual Verification 'Phase 1: Import Migration & Old File Deletion' (Protocol in workflow.md)

---

## Phase 2: Documentation & Verification

- [x] Task 2.1: Update `docs/architecture/DATA_MODEL.md` — change "Source of truth" reference from `src/services/FirebaseService.ts` to `src/persistence/firebase.ts`
- [x] Task 2.2: Update `docs/architecture/SERVICE_CATALOG.md` — update FirebaseService entry to point to `src/persistence/firebase.ts`
- [x] Task 2.3: Run grep verification commands — confirm zero `services/FirebaseService` and zero `tenants/{tenantId}` in runtime code
- [x] Task 2.4: Run full test suite — confirm no new failures introduced
- [x] Task: Conductor - User Manual Verification 'Phase 2: Documentation & Verification' (Protocol in workflow.md)
