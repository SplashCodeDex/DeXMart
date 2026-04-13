# Spec: Fix Task 5.9 Partial Migration — Data Isolation Bug

## Overview

Task 5.9 in the Phase 5 track (`Complete tenants/ → users/ Path Migration`) was marked complete but the migration was only partial. The new persistence layer file (`src/persistence/firebase.ts`) correctly uses `users/{userId}/...` paths, but **zero runtime files import from it**. All ~22 service files still import the **old** `src/services/FirebaseService.ts` which still uses `tenants/{tenantId}/...` paths in both its `SchemaMap` and `getCollectionInfo()` method.

This means at runtime, all Firestore operations for campaigns, contacts, channels, agents, templates, webhooks, groups, members, moderation, violations, subscriptions, learning, and analytics are written to `tenants/{tenantId}/...` paths instead of the canonical `users/{userId}/...` hierarchy — violating the B2C tenant isolation model defined in `product.md`, `DATA_MODEL.md`, and `PROJECT_RULES.md`.

## Functional Requirements

1. **FR-1: Single FirebaseService** — Eliminate the duplicate `src/services/FirebaseService.ts`. All Firestore access must flow through `src/persistence/firebase.ts` (which already has the correct `users/{userId}/...` SchemaMap and path resolution).

2. **FR-2: Import Migration** — All ~22 files currently importing from `@/services/FirebaseService.js` or `./FirebaseService.js` must be updated to import from `@/persistence/firebase.js`.

3. **FR-3: Type Annotation Migration** — All ~50 type annotations using `'tenants/{tenantId}/...'` keys (e.g., `firebaseService.getDoc<'tenants/{tenantId}/campaigns'>`) must be updated to use `'users/{userId}/...'` keys for compile-time enforcement.

4. **FR-4: FirestoreSchema Type Cleanup** — The `FirestoreSchema` type in `src/types/firestore.ts` should only expose `users/{userId}/...` keys (it already does this correctly), and the old `tenants/` keys should be confirmed removed.

5. **FR-5: Documentation Updates** — Update `DATA_MODEL.md` Section 1 ("Source of truth: `src/services/FirebaseService.ts` SchemaMap") to point to `src/persistence/firebase.ts`.

## Non-Functional Requirements

- Zero runtime behavior change for any file already using `src/persistence/firebase.ts`
- All existing tests that reference `src/persistence/firebase.ts` must continue to pass
- No Firestore data migration needed (development environment — fresh data acceptable)

## Acceptance Criteria

1. `grep -r "services/FirebaseService" src/` returns **zero results** (excluding test stubs if needed)
2. `grep -r "tenants/{tenantId}" src/` returns **zero results** (excluding docs/comments explaining the migration history)
3. `src/services/FirebaseService.ts` is deleted
4. All existing passing tests continue to pass
5. The path migration test at `src/persistence/firebase.path-migration.test.ts` passes (7/7)

## Out of Scope

- Fixing pre-existing 199 test failures (tracked separately in `test_health_20260413`)
- Existing Firestore data migration (development environment)
- Firestore security rules update (already done in Task 5.9.3)
