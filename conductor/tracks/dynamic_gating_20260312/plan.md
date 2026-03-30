# Implementation Plan: Unified Dynamic Gating (dynamic_gating_20260312)

## Phase 1: Backend Authority Core [checkpoint: f9a8580]
- [x] Task: Create `SystemAuthorityService.ts` with the master Capability Matrix f9a8580
- [x] Task: Migrate logic from `UsageGuard.ts` into `SystemAuthorityService.ts` f9a8580
- [x] Task: Implement `GET /api/authority/capabilities` endpoint f9a8580
- [x] Task: Write unit tests for `SystemAuthorityService` verifying tier outputs f9a8580
- [x] Task: Conductor - User Manual Verification 'Phase 1: Backend Authority Core' (Protocol in workflow.md) f9a8580

## Phase 2: Backend Enforcement
- [x] Task: Update `AgentService.ts` to use `SystemAuthorityService` for agent creation limits
- [x] Task: Update `ChannelService.ts` to use `SystemAuthorityService` for slot limits
- [x] Task: Update `GeminiAI.ts` and `SkillsManager.ts` to use `SystemAuthorityService` for skill gating
- [x] Task: Conductor - User Manual Verification 'Phase 2: Backend Enforcement' (Protocol in workflow.md)

## Phase 3: Frontend Authority Bridge
- [x] Task: Create `useAuthorityStore.ts` in Zustand to manage the fetched capability matrix
- [x] Task: Implement capability fetching in the root Dashboard layout
- [x] Task: Refactor `ChannelSlotGuard.ts` and `SkillGating.ts` to delegate to `useAuthorityStore`
- [x] Task: Conductor - User Manual Verification 'Phase 3: Frontend Authority Bridge' (Protocol in workflow.md)

## Phase 4: UI Cleanup & Verification
- [x] Task: Update `AgentsDashboard.tsx` and `TemplateSelector.tsx` to use dynamic model/feature flags
- [x] Task: Remove all deprecated hardcoded limit files from `frontend/src/features/agents/`
- [x] Task: Final end-to-end verification of tier-based restriction enforcement
- [x] Task: Conductor - User Manual Verification 'Phase 4: UI Cleanup & Verification' (Protocol in workflow.md)
