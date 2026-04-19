---
description: Core Policy - Enforces TDD, Plan-Driven Development, and Code Quality
globs: ["**/*"]
alwaysApply: true
---

# Core Project Policy

## 1. The Plan is the Source of Truth

- **Always** read `plan.md` before starting work.
- **Always** update `plan.md` to reflect progress (`[ ]` -> `[~]` -> `[x]`).
- **Never** deviate from the plan without updating `plan.md` first.

## 2. Test-Driven Development (TDD) Mandate

- **Red:** Write failing tests _before_ writing any implementation code.
- **Green:** Write _only_ enough code to pass the tests.
- **Refactor:** Clean up code while keeping tests green.
- **Policy:** If you are asked to implement a feature, your first step must be creating a test file that fails.
- **2026 Verification**: Use specialized tools (linters, test runners) to verify results rather than relying on LLM intuition.

## 3. Code Quality Standards

- **No Placeholders:** Never use `TODO`, `pass`, or `// implementation here` unless explicitly instructed for prototyping.
- **Strict Typing:** Use strict types (TypeScript 5.9+). Avoid `any` at all costs.
- **Result Pattern**: Prefer returning Result objects `{ success, data, error }` over throwing exceptions for expected failures.
- **Comments:** Explain _why_, not _what_.

## 4. Agent Behavior

- **Explain First:** Before executing a tool that modifies files, explain what you are about to do and why.
- **Strategic Planning**: Generate a multi-step plan for complex tasks and update it dynamically.
- **Reflection (Critic Phase)**: Before reporting completion, the agent MUST review its own work for edge cases or security flaws.
- **No "Simulations":** Do not create "fake" logic just to satisfy a test unless mocking an external dependency.

## 5. File Management

- **New Files:** Always clarify where a new file should live (directory structure).
- **Edits:** Use `replace_file_content` for single blocks, `multi_replace_file_content` for multiple blocks.

## 6. Upstream Leverage & Feature Embedding (MANDATORY)

> **Canonical reference**: `docs/architecture/UPSTREAM_LEVERAGE_POLICY.md`

- **Upstream Leverage**: DeXMart MUST NOT duplicate logic, features, code, or capabilities that OpenClaw upstream already provides. Before implementing any new module/service/utility:
  1. Search `src/` and `extensions/` for existing upstream implementation.
  2. Check `CHANGELOG.md` and `docs/OPENCLAW_UPSTREAM_REPORT.md` for upstream capabilities.
  3. If upstream provides it → **STOP and leverage it**. Do NOT create a parallel implementation.
  4. If upstream partially provides it → Extend via injection points. Do NOT fork or wrap.
- **Changelog Adaptation**: By leveraging upstream, DeXMart automatically inherits OpenClaw's bug fixes, security patches, new features, and performance improvements through the sync process.
- **Exclusive Feature Embedding**: Features confirmed (via critical investigation) to be truly DeXMart-exclusive MUST be embedded into `src/` as first-class modules — not plugins, sidecars, or afterthoughts. A feature is exclusive ONLY if it does NOT exist upstream AND is a B2C/SaaS concern AND would NOT make sense in single-user mode.
- **Violations**: Reimplementing upstream logic, creating bridges/wrappers, forking upstream files, or treating exclusives as secondary are **Severe Violations** (see `project_governance.md` §3).
