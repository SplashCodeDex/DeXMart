# Implementation Plan: OpenClaw Comprehensive Upstream Sync (40 Patches)

## Overview
Strategic integration of 40 upstream patches. Every fix MUST be preceded by an empirical check (reproduction script or code analysis) to verify the issue exists in the local codebase.

## Phase 1: Research & Fact-Finding
- [x] Task: Audit `openclaw/src/` to confirm the presence of vulnerable/buggy code for all 40 issues.
- [x] Task: Document the "Verification of Existence" for each issue in a temporary `research_notes.md`.
- [x] Task: Create a dedicated `test/upstream-sync/` directory for automated reproduction scripts.

## Phase 2: Security & Hardening (Issues #26192 to #26047)
- [x] Task: **Verify Existence** then Patch: SwiftAPI Attestation and governance (#26192).
- [x] Task: **Verify Existence** then Patch: External Secrets Management (#26155).
- [x] Task: **Verify Existence** then Patch: Config Integrity Verification (#26104).
- [x] Task: **Verify Existence** then Patch: Isolation Fixes (BlueBubbles, Zalo, Slack, Twitch, Mattermost).
- [x] Task: **Verify Existence** then Patch: Path Escape Protection (Symlinks/Hardlinks).
- [x] Task: Cleanup: Remove temporary logs and reproduction scripts for this block.

## Phase 3: Channel Core Stability (Issues #26229 to #26144)
- [x] Task: **Verify Existence** then Patch: Telegram Proxy and Webhook Startup (#26229, #26206).
- [x] Task: **Verify Existence** then Patch: Discord IDs, Permissions, and threadId (#26226, #26209, #26164, #26144).
- [x] Task: **Verify Existence** then Patch: Slack threadId and Synology Chat cfg (#26216, #26210).
- [x] Task: **Verify Existence** then Patch: WhatsApp Opus TTS and Feishu sequential blocks (#26195, #26172, #26203).
- [x] Task: Cleanup: Remove temporary logs and reproduction scripts for this block.

## Phase 4: AI Engine & Model Intelligence (Issues #26214 to #26153)
- [x] Task: **Verify Existence** then Patch: Anthropic Haiku aliases and Haiku 4.5 mapping (#26214, #26181, #26175).
- [x] Task: **Verify Existence** then Patch: Gemini 3.1 Pro normalization (#26134).
- [x] Task: **Verify Existence** then Patch: Context Overflow UX and Cortex tag stripping (#26085, #26133).
- [x] Task: **Verify Existence** then Patch: Reasoning flags and model overrides (#26131, #26228, #26153).
- [x] Task: Cleanup: Remove temporary logs and reproduction scripts for this block.

## Phase 5: Infrastructure & Optimization (Issues #26205 to #26056)
- [x] Task: **Verify Existence** then Patch: Unify Embedding Providers and FTS modes (#26205, #26177).
- [x] Task: **Verify Existence** then Patch: Heartbeat event detection (#26213, #26062).
- [x] Task: **Verify Existence** then Patch: Auth-profile migration and job/hook preservation (#26221, #26184, #26180).
- [x] Task: **Verify Existence** then Patch: Memory flush fixes and Delivery Queue GC (#26145, #26056).
- [x] Task: Cleanup: Remove temporary logs and reproduction scripts for this block.

## Phase 6: Final System Validation
- [x] Task: Run full project regression suite (`npm test`) to ensure no side effects.
- [x] Task: Verify DeXMart Dashboard connectivity with the fully patched engine.
- [x] Task: Final Cleanup: Remove all remaining temporary research and test artifacts.
