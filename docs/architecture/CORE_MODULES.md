# DeXMart Core Modules Architecture

> **Last verified**: 2026-04-10 | **Status**: True Fusion Complete
>
> These modules are DeXMart's native platform layer — they exist exclusively in `src/` and
> provide capabilities that OpenClaw does not have. They elevate the entire unified codebase
> with multi-tenancy, billing, safety, and observability.

---

## Table of Contents

1. [Tenancy (`src/tenancy/`)](#1-tenancy-srctenancy)
2. [Billing (`src/billing/`)](#2-billing-srcbilling)
3. [Campaigns (`src/campaigns/`)](#3-campaigns-srccampaigns)
4. [Safety (`src/safety/`)](#4-safety-srcsafety)
5. [Analytics (`src/analytics/`)](#5-analytics-srcanalytics)

---

## 1. Tenancy (`src/tenancy/`)

**Purpose:** B2C user-level isolation. Every data operation in the platform is scoped to a
`userId`. This module defines the trust boundary between users.

### Files

| File | Role |
|---|---|
| `tenant-service.ts` | Tenant lifecycle — create, lookup, settings, plan limits |
| `tenant-config.ts` | Tenant-scoped configuration resolution |
| `tenant-context.ts` | `UserContext` type — the central identity carrier passed through every request |
| `context-resolver.ts` | Resolves `UserContext` from Firebase Auth token on each request |
| `__tests__/` | Test suite for tenancy isolation invariants |

### Key Concepts

- **UserContext**: The single source of truth for "who is this user" in any backend operation.
  Contains `userId`, `tenantId`, plan tier, and capability flags. Every service method that
  touches data accepts `UserContext` as its first parameter.

- **AuthGuard** (`src/billing/auth-guard.ts`): Enforces UserContext boundaries. Throws if
  a request tries to access data belonging to a different `userId`.

- **Firestore path pattern**: All user data lives under `/users/{userId}/...`. The tenancy
  module ensures this prefix is always set from the verified Firebase Auth token — never
  from a user-supplied value.

### Integration Points

- `context-resolver.ts` is called by every Express middleware before route handlers
- `tenant-service.ts` is called during user registration to initialize Firestore documents
- `UserContext` is threaded through every service call that reads or writes data

---

## 2. Billing (`src/billing/`)

**Purpose:** Stripe subscription management and feature gating. Controls which models,
channels, tools, and agents are available based on the user's plan tier.

### Files

| File | Role |
|---|---|
| `billing-service.ts` | Stripe customer/subscription CRUD, webhook processing |
| `stripe.ts` | Stripe SDK client initialization and type helpers |
| `auth-guard.ts` | `assertCan()` / `assertCanWithGrace()` — feature gate enforcement |
| `usage-tracker.ts` | Batched Firestore flush of per-user usage metrics |
| `auth-guard.test.ts` | Gate enforcement tests |
| `usage-tracker.test.ts` | Usage tracking tests |

### Plan Tiers

| Tier | Key Capabilities |
|---|---|
| Free | Limited messages, basic models, 1 channel |
| Starter | More messages, standard models, 3 channels |
| Pro | High volume, all models, unlimited channels, campaigns |
| Enterprise | No limits, priority support, custom integrations |

### Key Concepts

- **`assertCan(userContext, capability)`**: Pure function that throws if the user's plan
  does not include the requested capability. Called at the start of any gated operation.

- **`assertCanWithGrace(userContext, capability)`**: Same as `assertCan` but allows usage
  in a 90–99% grace zone before throwing (prevents jarring cutoffs at plan limits).

- **`UsageTracker`**: Batches Firestore writes (instead of writing on every message) to
  avoid hot-spotting. Flushes every 30 seconds or when the batch reaches 100 events.

### Integration Points

- `assertCan()` is called by every service that provides a gated feature
- `billing-service.ts` handles Stripe webhooks (`customer.subscription.updated`,
  `invoice.payment_failed`) and updates the user's `UserContext` capabilities in Firestore
- `usage-tracker.ts` receives events from the ingress pipeline and agent runner

---

## 3. Campaigns (`src/campaigns/`)

**Purpose:** High-volume broadcast messaging with intelligent anti-ban throttling.
Not part of OpenClaw — a DeXMart-exclusive capability.

### Files

| File | Role |
|---|---|
| `campaign-service.ts` | Campaign CRUD, scheduling, BullMQ job dispatch |

### Architecture

Campaigns use **BullMQ** for reliable background processing:

```
User creates campaign
  → campaign-service.ts validates & stores in Firestore
    → BullMQ job enqueued per recipient
      → campaignWorker (src/jobs/campaignWorker.ts) processes each job
        → antiBanService enforces rate limits + randomized delays
          → WhatsApp/channel adapter sends message
```

### Key Concepts

- **Anti-ban integration**: Every outbound message through the campaign engine passes
  through `src/safety/anti-ban.ts` before sending. Rate limits and delays are applied
  per-user, not globally.

- **BullMQ Group Isolation**: Jobs are grouped by `userId` so one user's high-volume
  campaign cannot starve another user's messages.

- **Firestore persistence**: Campaign state (sent count, failed count, status) is updated
  atomically after each batch. Campaigns survive server restarts.

---

## 4. Safety (`src/safety/`)

**Purpose:** Platform-wide protection against WhatsApp bans and harmful content.
Not part of OpenClaw — DeXMart-exclusive.

### Files

| File | Role |
|---|---|
| `anti-ban.ts` | Rate limiting, velocity rules, cooldown management |
| `content-moderation.ts` | Content safety filters before sending |

### Anti-Ban System (`anti-ban.ts`)

The anti-ban system enforces three layers of protection:

1. **Velocity rules**: Maximum messages per minute/hour per account. Configurable per
   plan tier (higher plans get higher limits).

2. **Content rules**: Blocks known spam patterns, excessive links, and message spinning
   that violates WhatsApp's terms of service.

3. **Cooldown management**: After detecting suspicious activity, applies exponential
   backoff before allowing more messages. State persisted in Redis.

**Critical**: The anti-ban system must NEVER be bypassed. All outbound WhatsApp messages
(direct, campaign, AI-generated) go through this service. Bypassing it risks permanent
account bans.

### Content Moderation (`content-moderation.ts`)

Runs each outbound message through safety filters before sending:
- Blocks personally identifiable information (PII) leakage
- Filters illegal content categories
- Applies tenant-configured content policies

---

## 5. Analytics (`src/analytics/`)

**Purpose:** AI usage tracking, audit trail, and real-time reasoning transparency.

### Files

| File | Role |
|---|---|
| `ai-analytics.ts` | AI model usage tracking (tokens, costs, model provider) |
| `audit-service.ts` | Immutable audit log of all user actions in Firestore |
| `mastermind-stream.ts` | Real-time WebSocket stream of AI reasoning steps |
| `event-listener.ts` | Internal event bus subscriber for analytics events |
| `event-listener.test.ts` | Event listener tests |

### Mastermind Stream (`mastermind-stream.ts`)

The Mastermind Stream provides real-time visibility into AI reasoning for the dashboard:

```
AI agent processes message
  → emits reasoning events (intent, plan, tool calls, reflection)
    → mastermind-stream.ts receives events via event bus
      → Socket.io broadcasts to authenticated dashboard client
        → Frontend renders live agent reasoning trace
```

Events include: `intent_detected`, `plan_created`, `tool_invoked`, `tool_result`,
`reflection`, `response_generated`.

### Usage Tracking

`ai-analytics.ts` tracks per-user:
- Token consumption by model provider
- Estimated cost per conversation
- Model selection distribution
- Tool invocation frequency

Data is stored in Firestore under `/users/{userId}/analytics/` and feeds the dashboard
analytics page.
