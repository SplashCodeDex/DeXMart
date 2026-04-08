# Implementation Plan: Architecture & Documentation Sync (True Fusion)

## Phase 1: Deep Audit, Deduplication & Clean Up
Goal: Verify 100% code parity, merge overlapping logic, and remove all "bridge" structures.

- [x] Task: Audit and **Deduplicate** logic in `src/`: ensure DeXMart patterns (multi-tenant, Firestore) are the *default* and not "wrappers". Merge overlapping functions from `openclaw/src/` and `backend/src/` into unified versions in root `src/`. [8e17743]
- [x] Task: Resolve and **Eliminate all "Bridge" patterns**: remove any remaining wrapper classes, "imports" shims, or "in-between" logic that was used to connect separate projects. Ensure imports are direct and internal to the single `src/` tree. [8e17743]
- [x] Task: Delete redundant legacy directories: `openclaw/` and `backend/`. [8e17743]
- [x] Task: Execute the full test suite (`npm test`) to confirm zero regressions after the logic harmonization and cleanup. [8e17743]
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Deep Audit & Clean Up' (Protocol in workflow.md)

## Phase 2: Core Documentation Sync (Enterprise Vision)
Goal: Update all documentation to reflect a single, unified, enterprise-grade platform.

- [ ] Task: Revise `conductor/product.md` to reflect DeXMart as a unified enterprise-grade platform (OpenClaw engine + DeXMart core modules). Remove all references to DeXMart as a "layer on top".
- [ ] Task: Synchronize `conductor/tech-stack.md` with the confirmed unified versions (Node 24+, Next.js 16.1.6, etc.).
- [ ] Task: Update `conductor/workflow.md` to formally document the "Managed Fork" upstream sync strategy for the unified project.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Core Documentation Sync' (Protocol in workflow.md)

## Phase 3: Component Documentation Refactor
Goal: Centralize and modernize architectural documentation for the unified platform.

- [ ] Task: Relocate and modernize architectural documentation from `backend/` and `openclaw/` into a unified documentation area within the single project structure.
- [ ] Task: Rewrite architectural guides for core modules (e.g., `src/tenancy/`, `src/billing/`, `src/campaigns/`) as native parts of the project's 'src/' architecture.
- [ ] Task: Update the project `README.md` and `conductor/index.md` to present the project as a single, cohesive AI automation platform.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Component Documentation Refactor' (Protocol in workflow.md)
