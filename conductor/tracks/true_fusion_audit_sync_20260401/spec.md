# Specification: Architecture & Documentation Sync (True Fusion)

## Overview
This track aims to audit, synchronize, and finalize the "True Fusion" architecture transition. This involves verifying the migration of all code into the unified `src/` directory, removing redundant legacy directories (`openclaw/`, `backend/`), and updating all project documentation to reflect the current, enterprise-grade unified platform.

## Functional Requirements
- **Codebase Audit:** Confirm that all logic from `openclaw/src/` and `backend/src/` has been correctly moved to the root `src/` directory.
- **Deduplication:** Merging overlapping logic and ensuring DeXMart patterns (multi-tenant, Firestore) are the project-wide defaults.
- **Legacy Cleanup:** Securely delete the redundant `openclaw/` and `backend/` directories once migration is verified.
- **Eliminate Bridges:** Remove all "in-between" shims, bridge files, or wrapper logic connecting previously separate projects.
- **Core Doc Update:** Revise `conductor/product.md`, `conductor/tech-stack.md`, and `conductor/workflow.md` to reflect the unified architecture and "Managed Fork" upstream strategy.
- **Component Doc Consolidation:** Migrate and update architectural documentation from component directories into a centralized, unified documentation structure (e.g., `src/docs/`).

## Non-Functional Requirements
- **Accuracy:** Documentation must match the current versions (Node 24+, Next.js 16.1.6, Baileys 7.0.0, etc.) and patterns (B2C isolation, Firestore persistence) found in the code.
- **Integrity:** Ensure no broken imports or broken documentation links after the cleanup.

## Acceptance Criteria
- `openclaw/` and `backend/` directories are removed.
- `src/main.ts` is the single entry point.
- All documents in `conductor/` are consistent with the "True Fusion" vision.
- All "bridge" or "shim" files are eliminated.
- Logic is deduplicated across the unified `src/` tree.

## Out of Scope
- Implementing new features (this is a documentation and structural chore).
- WhatsApp-specific logic changes (unless directly related to general patterns).
