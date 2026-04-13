# Plan: Fix Task 5.9 Partial Migration — Data Isolation Bug

## Phase 1: Import Migration & Old File Deletion

- [ ] Task 1.1: Write failing tests — Add a compile-time regression test that asserts `src/services/FirebaseService.ts` does NOT exist and that all `firebaseService` imports resolve from `@/persistence/firebase.js`
    - [ ] Create `src/persistence/firebase.import-audit.test.ts` — uses `fs.existsSync` to assert old file absent, and greps `src/` for stale imports
- [ ] Task 1.2: Migrate all runtime imports from `@/services/FirebaseService.js` → `@/persistence/firebase.js`
    - [ ] `src/services/AgentService.ts`
    - [ ] `src/services/ChannelService.ts`
    - [ ] `src/services/ChannelManagerService.ts`
    - [ ] `src/services/multiTenantService.ts`
    - [ ] `src/services/userService.ts`
    - [ ] `src/services/contactService.ts`
    - [ ] `src/services/database.ts`
    - [ ] `src/services/templateService.ts`
    - [ ] `src/services/campaignService.ts`
    - [ ] `src/services/webhookService.ts`
    - [ ] `src/services/analytics.ts`
    - [ ] `src/services/antiBanService.ts`
    - [ ] `src/services/groupService.ts`
    - [ ] `src/campaigns/campaign-service.ts`
    - [ ] `src/jobs/campaignWorker.ts`
    - [ ] `src/workers/antiBanResumeWorker.ts`
    - [ ] `src/safety/anti-ban.ts`
    - [ ] `src/controllers/authController.ts`
    - [ ] `src/shared/user-service.ts`
    - [ ] `src/shared/database.ts`
    - [ ] `src/agents-management/agent-service.ts`
    - [ ] `src/tenancy/tenant-service.ts`
    - [ ] `src/lib/baileysFirestoreAuth.ts`
    - [ ] `src/utils/resilienceHarness.ts`
    - [ ] `src/persistence/firestore-auth-state.ts`
- [ ] Task 1.3: Migrate all runtime imports in test files from `@/services/FirebaseService.js` → `@/persistence/firebase.js`
    - [ ] `src/controllers/authController.test.ts`
    - [ ] `src/services/ChannelService.test.ts`
    - [ ] `src/services/ChannelService.lifecycle.test.ts`
    - [ ] `src/services/ChannelService.cleanup.test.ts`
    - [ ] `src/services/ChannelService.move.test.ts`
    - [ ] `src/agents-management/agent-service.test.ts`
- [ ] Task 1.4: Update all `'tenants/{tenantId}/...'` type annotations to `'users/{userId}/...'` across all ~50 call sites
    - [ ] `src/jobs/campaignWorker.ts` (~12 annotations)
    - [ ] `src/campaigns/campaign-service.ts` (~7 annotations)
    - [ ] `src/services/contactService.ts` (~5 annotations)
    - [ ] `src/services/database.ts` (~5 annotations)
    - [ ] `src/services/templateService.ts` (~4 annotations)
    - [ ] `src/services/ChannelManagerService.ts` (~3 annotations)
    - [ ] `src/workers/antiBanResumeWorker.ts` (~2 annotations)
    - [ ] `src/safety/anti-ban.ts` (~1 annotation)
    - [ ] `src/services/antiBanService.ts` (~1 annotation)
    - [ ] Any remaining files with `tenants/{tenantId}` type annotations
- [ ] Task 1.5: Delete `src/services/FirebaseService.ts`
- [ ] Task 1.6: Run tests (green) — verify `firebase.path-migration.test.ts` passes (7/7) + no regressions in existing passing tests
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Import Migration & Old File Deletion' (Protocol in workflow.md)

---

## Phase 2: Documentation & Verification

- [ ] Task 2.1: Update `docs/architecture/DATA_MODEL.md` — change "Source of truth" reference from `src/services/FirebaseService.ts` to `src/persistence/firebase.ts`
- [ ] Task 2.2: Update `docs/architecture/SERVICE_CATALOG.md` — update FirebaseService entry to point to `src/persistence/firebase.ts`
- [ ] Task 2.3: Run grep verification commands — confirm zero `services/FirebaseService` and zero `tenants/{tenantId}` in runtime code
- [ ] Task 2.4: Run full test suite — confirm no new failures introduced
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Documentation & Verification' (Protocol in workflow.md)
