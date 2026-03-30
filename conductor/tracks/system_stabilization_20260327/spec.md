# Specification: System Health & Technical Debt Remediation

## Overview
DeXMart currently has several hundred lint warnings, multiple type-check errors, and an ESLint configuration issue in the frontend. This track aims to bring the project to a "Zero Error" state for builds and type-checks, while significantly reducing linting noise.

## Problem Statement
- **Frontend:** ESLint is crashing due to a `minimatch` ESM issue. Type-checks are failing on 9 points across 7 files (missing icons, store sync issues, duplicate exports).
- **Backend:** 47 type-check errors across 40 files. These range from missing service methods to broken `openclaw` workspace imports (specifically `.ts` extensions in ESM imports).
- **OpenClaw:** Internal imports within the `openclaw` workspace are using `.ts` extensions which are prohibited in standard ESM Node.js without specific flags, causing `TS5097` errors.

## Functional Requirements
1. **Frontend Restoration:**
    - Fix the ESLint `minimatch` SyntaxError.
    - Fix the 9 TypeScript errors (Icon imports, Store method definitions, and Export ambiguities).
2. **Backend Stability:**
    - Fix the `automationService` and `webhookService` type mismatches.
    - Resolve the `MultiTenantService.canAddBot` missing property.
    - Standardize `openclaw` imports to use `.js` or no extension as per ESM requirements.
3. **OpenClaw Refactoring:**
    - Globally replace `.ts` extensions in import statements with `.js` extensions within the `openclaw` workspace to satisfy the TypeScript/Node.js ESM compiler.
4. **Lint Cleanup:**
    - Resolve the most frequent lint warnings (unused vars, explicit any) in critical paths.

## Acceptance Criteria
- [ ] `pnpm --filter frontend typecheck` passes with 0 errors.
- [ ] `pnpm --filter backend typecheck` passes with 0 errors.
- [ ] `pnpm --filter frontend lint` runs successfully without crashing.
- [ ] The `openclaw` workspace build succeeds on Windows (addressing the `bash` dependency in scripts where possible).

## Out of Scope
- Rewriting core logic unless required to fix a type error.
- Adding new features.
