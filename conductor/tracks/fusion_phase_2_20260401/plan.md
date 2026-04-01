# Implementation Plan: TRUE Fusion Phase 2 — UserContext Injection

## Phase 1: User-Scoped Config Resolution
Focus: Replace OpenClaw's file-based config loading with a Firestore + Redis user-scoped resolver.

- [ ] Task: Setup UserContextResolver Base
    - [ ] Write tests for `UserContextResolver` (Firestore/Redis interactions, fallback logic).
    - [ ] Implement `fromUserId`, `fromToken`, and `fromChannelId` methods in `src/tenancy/context-resolver.ts`.
- [ ] Task: Refactor OpenClaw Config I/O
    - [ ] Write tests for user-scoped config loading (`loadConfigForTenant`).
    - [ ] Modify `src/config/io.ts` to fetch config via `UserContextResolver` instead of single JSON5 file.
    - [ ] Ensure Redis caching with 5-minute TTL and invalidation triggers exist.
- [ ] Task: Conductor - User Manual Verification 'User-Scoped Config Resolution' (Protocol in workflow.md)

## Phase 2: Universal Session Persistence
Focus: Migrate channel session state from the local filesystem to Firestore, ensuring all channels (WhatsApp, Slack, Discord, etc.) are user-scoped and cloud-persisted.

- [ ] Task: Firestore Auth State Implementation
    - [ ] Write unit tests for `useFirestoreAuthState` verifying read, write, and batching logic.
    - [ ] Generalize the legacy `baileysFirestoreAuth.ts` into a universal `src/persistence/firestore-session.ts` for all OpenClaw channel plugins.
- [ ] Task: Inject Session Persistence into OpenClaw Channels
    - [ ] Write tests verifying OpenClaw channels initialize with the new Firestore auth store.
    - [ ] Modify `src/web/session.ts` (or relevant channel plugin loaders) to inject `useFirestoreAuthState(userId, channelId)`.
- [ ] Task: Conductor - User Manual Verification 'Universal Session Persistence' (Protocol in workflow.md)

## Phase 3: Usage Tracking and Billing Gates
Focus: Enforce capabilities and track usage across all primary OpenClaw actions.

- [ ] Task: UsageTracker Service
    - [ ] Write tests for `UsageTracker` verifying in-memory counters, 10% grace period logic, and async Firestore flushing.
    - [ ] Implement `src/billing/usage-tracker.ts` with 30-second batched writes to `/users/{userId}/usage`.
- [ ] Task: Inject Billing Gates into Engine Operations
    - [ ] Write tests checking that capabilities accurately block out-of-plan operations.
    - [ ] Inject `AuthGuard.canUseModel` into `src/agents/model-selection.ts`.
    - [ ] Inject `AuthGuard.canStartChannel` into `src/gateway/server-channels.ts`.
    - [ ] Inject `AuthGuard.canCreateAgent` and feature checks into `src/agents-management/` and tool executors.
- [ ] Task: Notification and Rejection Handling
    - [ ] Write tests verifying WebSocket warnings at grace period entry and HTTP 402 responses on hard blocks.
    - [ ] Implement rejection handlers in the API layer / Gateway for plan limits.
- [ ] Task: Conductor - User Manual Verification 'Usage Tracking and Billing Gates' (Protocol in workflow.md)
