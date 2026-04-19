---
description: Project Governance - Checklists, Definition of Done, and Violations
globs: ["**/*"]
alwaysApply: true
---

# Project Governance (2026 Edition)

## 1. Definition of Done

A task is considered complete ONLY when:

1.  [ ] Code is implemented and functional.
2.  [ ] **Unit Tests** pass (TDD Green Phase).
3.  [ ] **Reflection (Self-Critic)**: Agent identifies and fixes at least one edge case or improvement.
4.  [ ] **Linting & Types** pass zero-error gate.
5.  [ ] **Documentation** (JSDoc, Architecture, README) updated.
6.  [ ] `plan.md` updated with commit hash.

## 2. Pre-Commit Verification

Before running `/finish-task`:

- **Verify ESM**: Check for `.js` extensions in all new imports.
- **Check Zod**: Ensure all new API/DB reads are validated.
- **Cleanup**: Delete `console.log` and dead code.
- **Naming**: PascalCase for Components, camelCase for functions.

## 3. Violations Policy

The following are considered "Severe Violations" of project rules:

1.  **Breaking the Build**: Committing code that does not compile.
2.  **Ignored Tests**: Commenting out failing tests instead of fixing them.
3.  **Magic Numbers**: Using unexplained numbers in logic.
4.  **Duplication**: Copy-pasting complex logic instead of refactoring into a utility.
5.  **Duplicating Upstream Logic**: Reimplementing logic, features, or capabilities that OpenClaw already provides instead of leveraging upstream. This includes creating bridges, wrappers, or adapters around upstream modules, forking upstream files instead of injecting at defined points, and treating confirmed DeXMart-exclusive features as plugins or secondary citizens instead of core modules. See `docs/architecture/UPSTREAM_LEVERAGE_POLICY.md` for remediation.

## 4. Emergency Protocol

If a critical bug is found:

1.  **Stop**: Halt all new feature work.
2.  **Reproduce**: Write a test case that reproduces the bug (it should fail).
3.  **Fix**: Implement the fix until the test passes.
4.  **Verify**: Ensure no regressions in related modules.
