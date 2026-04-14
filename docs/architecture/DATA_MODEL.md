# DeXMart Data Model & Persistence

> **Last verified**: 2026-04-14 | **Current Phase**: Phase 6 / Test Health | **Source of truth**: `src/persistence/firebase.ts` SchemaMap

---

## 1. Overview

DeXMart uses **Firestore** as the primary database with **Redis** for caching and **BullMQ** for job queues. There is no ORM -- all database access goes through `FirebaseService` (low-level CRUD with Zod validation) or `DatabaseService` (high-level operations with tenant scoping).

**Key principle**: Every document path is scoped by tenant ID. In the B2C model, `tenantId === userId` -- the user IS the tenant.

> **Terminology transition**: The codebase is migrating from `tenants/{tenantId}` paths to `users/{userId}` paths. Both exist currently. New code (Phase 2+) uses `users/{userId}`. Legacy code still references `tenants/{tenantId}`. They are semantically equivalent.

---

## 2. Firestore Document Hierarchy

### 2.1 Legacy Path Structure (current in FirebaseService SchemaMap)

```
firestore-root/
|
+-- tenants/
|   +-- {tenantId}/                    # TenantSchema
|   |
|   +-- users/
|   |   +-- {userId}/                  # TenantUserSchema
|   |
|   +-- agents/
|   |   +-- {agentId}/                 # AgentSchema
|   |   +-- channels/
|   |       +-- {channelId}/           # ChannelSchema
|   |       +-- auth/
|   |           +-- {docId}            # AuthSchema (session creds)
|   |
|   +-- channels/
|   |   +-- {channelId}/               # ChannelSchema (flat, deprecated)
|   |   +-- auth/
|   |       +-- {docId}               # AuthSchema
|   |
|   +-- slots/
|   |   +-- {slotId}/                  # ChannelSchema (alias)
|   |
|   +-- subscriptions/
|   |   +-- {subscriptionId}/          # SubscriptionSchema
|   |
|   +-- campaigns/
|   |   +-- {campaignId}/              # CampaignSchema
|   |
|   +-- contacts/
|   |   +-- {contactId}/               # ContactSchema
|   |
|   +-- audiences/
|   |   +-- {audienceId}/              # AudienceSchema
|   |
|   +-- templates/
|   |   +-- {templateId}/              # TemplateSchema
|   |
|   +-- webhooks/
|   |   +-- {webhookId}/               # WebhookSchema
|   |
|   +-- moderation/
|   |   +-- {itemId}/                  # ModerationItemSchema
|   |
|   +-- violations/
|   |   +-- {violationId}/             # ViolationSchema
|   |
|   +-- learning/
|   |   +-- {topicId}/                 # LearningSchema
|   |
|   +-- analytics/
|   |   +-- {period}/                  # AnalyticsSchema
|   |
|   +-- members/                       # WhatsApp JID mappings (untyped)
|   +-- groups/                        # WhatsApp group metadata (untyped)
```

### 2.2 New Path Structure (Phase 2+ / B2C model)

```
firestore-root/
|
+-- users/
    +-- {userId}/
    |
    +-- config/
    |   +-- settings                   # Engine config (maps to OpenClaw UserConfig object)
    |
    +-- channels/
    |   +-- {channelId}/
    |       +-- auth/
    |           +-- {docId}            # Universal channel auth state for all extensions
    |
    +-- usage/
    |   +-- current                    # Batched usage counters
    |
    +-- (future: agents/, campaigns/, etc. migrated from tenants/ path)
```

### 2.3 Global Collections

```
firestore-root/
+-- users/
    +-- {userId}/                      # Global user profile + plan lookup
```

---

## 3. Schema Definitions

All schemas are defined with Zod and enforced at write time by `FirebaseService`. Source: `src/types/contracts.ts` (backend) and `shared/src/schemas/` (cross-package).

### 3.1 Core Schemas

#### TenantSchema
```typescript
{
  id: string;                          // Same as userId in B2C
  name: string;                        // Display name
  ownerId: string;                     // Firebase Auth UID
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  subscriptionStatus: 'active' | 'past_due' | 'cancelled' | 'trialing';
  settings: Record<string, unknown>;   // Tenant-level settings
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### AgentSchema
```typescript
{
  id: string;
  tenantId: string;
  name: string;                        // Display name (e.g., "Sales Bot")
  status: 'active' | 'inactive' | 'error';
  skills: string[];                    // Enabled skill IDs
  linkedChannels: string[];            // Channel IDs attached to this agent
  modelConfig: {
    provider: string;                  // e.g., 'google-gemini', 'anthropic'
    model: string;                     // e.g., 'gemini-2.5-pro'
    temperature: number;
    maxTokens: number;
  };
  systemPrompt: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### ChannelSchema
```typescript
{
  id: string;
  tenantId: string;
  agentId: string;                     // Parent agent
  platform: string;                    // 'whatsapp' | 'telegram' | 'discord' | ...
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  webhookSecret: string;               // Auto-generated for non-native channels
  metadata: Record<string, unknown>;   // Platform-specific data
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### SubscriptionSchema
```typescript
{
  id: string;
  tenantId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'past_due' | 'cancelled' | 'trialing';
  currentPeriodStart: Timestamp;
  currentPeriodEnd: Timestamp;
  cancelAtPeriodEnd: boolean;
}
```

### 3.2 Messaging Schemas

#### CampaignSchema
```typescript
{
  id: string;
  tenantId: string;
  name: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed';
  audienceId: string;                  // Target audience
  templateId: string;                  // Message template
  channelId: string;                   // Delivery channel
  scheduledAt: Timestamp | null;
  stats: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    read: number;
  };
  createdAt: Timestamp;
}
```

#### TemplateSchema
```typescript
{
  id: string;
  tenantId: string;
  name: string;
  content: string;                     // Template body with {{variables}}
  mediaUrl: string | null;
  category: 'text' | 'image' | 'video' | 'document';
  variables: string[];                 // Extracted variable names
  createdAt: Timestamp;
}
```

#### ContactSchema
```typescript
{
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  lastContactedAt: Timestamp | null;
  createdAt: Timestamp;
}
```

### 3.3 Safety & Analytics Schemas

#### ModerationItemSchema
```typescript
{
  id: string;
  tenantId: string;
  messageId: string;
  reason: string;                      // Why flagged
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'flagged' | 'blocked' | 'allowed';
  createdAt: Timestamp;
}
```

#### AnalyticsSchema
```typescript
{
  id: string;                          // Period identifier (e.g., '2026-04')
  tenantId: string;
  messagesSent: number;
  messagesReceived: number;
  activeChannels: number;
  aiTokensUsed: number;
  topIntents: Record<string, number>;
  period: 'daily' | 'weekly' | 'monthly';
  createdAt: Timestamp;
}
```

---

## 4. Caching Architecture

### 4.1 Three-Layer Cache (Config Resolution)

```
Layer 1: In-Memory Map (Node.js process)
  - TTL: Until process restart
  - Used for: Config objects, hot path data
  - Capacity: Bounded by process memory

Layer 2: Redis (ioredis)
  - TTL: 5 minutes (config), 24 hours (channel mappings)
  - Used for: Cross-request caching, rate limit counters
  - Fallback: node-cache if Redis unavailable (dev mode)

Layer 3: Firestore (source of truth)
  - TTL: Permanent (until explicitly updated)
  - Used for: All persistent data
  - All reads validate against Zod schemas
```

### 4.2 Cache Key Patterns

| Pattern | TTL | Purpose |
|---------|-----|---------|
| `config:{userId}` | 5 min | User-scoped configuration |
| `ctx:{userId}` | 5 min | Resolved UserContext |
| `channel-map:{channelId}` | 24 hours | Channel ID -> userId mapping |
| `rate:{userId}:{action}` | 1 min | Rate limit counters |
| `session:{userId}:{channelId}` | 30 min | Active session metadata |

### 4.3 Cache Invalidation

- **Config changes**: User updates settings via dashboard -> Firestore write triggers -> Redis key deleted -> next request refills from Firestore
- **Plan upgrades**: Stripe webhook -> update subscription -> invalidate `ctx:{userId}` -> next request gets fresh capabilities
- **Channel disconnect**: Channel status change -> invalidate `channel-map:{channelId}`

---

## 5. Session Persistence

### 5.1 The Problem

OpenClaw uses `useMultiFileAuthState(authDir)` which writes credentials to the local filesystem. This doesn't work for:
- Multiple users (file paths collide or require per-user directories)
- Horizontal scaling (files are local to one container)
- Container restarts (ephemeral storage loses sessions)

### 5.2 The Solution: Universal Channel Auth State

**File**: `src/persistence/channel-auth-state.ts`

**Interface**: `AuthKeyValueStore` -- a minimal get/set interface that any storage backend can implement.

```typescript
interface AuthKeyValueStore {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown | null): Promise<void>;
}
```

**Firestore adapter**: `makeFirestoreAuthStore(userId, channelId, firestoreClient)`
- Path: `/users/{userId}/channels/{channelId}/auth`
- Documents: `creds` (credentials), signal keys (e.g., `pre-key-1`, `session-jid`)
- Null values trigger document deletion (cleanup)

**Injection point**: `src/web/session.ts` -- `createWaSocket()` accepts optional `authStateFactory` function. If provided, uses cloud storage. If omitted, falls back to file-based (backward compatible).

### 5.3 Applies to All Channels

The `AuthKeyValueStore` interface is channel-agnostic. While initially implemented for WhatsApp (Baileys), the same pattern applies to:
- Telegram session tokens
- Discord bot tokens
- Slack OAuth tokens
- Signal protocol state
- Any channel requiring persistent credentials

---

## 6. Usage Tracking

### 6.1 Architecture

**File**: `src/billing/usage-tracker.ts`

```
Operation (send message, create agent, etc.)
  |
  v
increment(userId, metric)          -- Synchronous, O(1)
  |                                   In-memory accumulator
  v
pendingBatch Map<userId, metrics>  -- Shared across all requests
  |
  +-- Timer fires (every 10s)     -- OR threshold (50 increments)
  |
  v
flushAll(firestoreClient)         -- Single batched Firestore write
  |
  v
/users/{userId}/usage/current     -- Firestore document (merge write)
```

### 6.2 Metrics Tracked

| Metric | Type | Description |
|--------|------|-------------|
| `messages` | Counter | Messages sent across all channels |
| `agents` | Gauge | Active agents (incremented on create, decremented on delete) |
| `channels` | Gauge | Active channel connections |
| `tokensIn` | Counter | AI input tokens consumed |
| `tokensOut` | Counter | AI output tokens generated |

### 6.3 Design Decisions

- **Non-blocking**: `increment()` is synchronous -- never delays the request
- **Batched writes**: One Firestore write per flush covers all users, not one per user per request
- **Merge semantics**: Uses Firestore `set({...}, {merge: true})` with `FieldValue.increment()` for atomic updates
- **Shutdown safety**: `flushAll()` called on `SIGTERM`/`SIGINT` to drain pending increments
- **No hard Firebase import**: Firestore client injected as a structural interface (`UsageFirestoreClient`) for testability

---

## 7. Data Access Patterns

### 7.1 Service Layer Access

```
Route Handler
  -> Controller (thin, extracts params)
    -> Service (business logic, receives tenantId)
      -> FirebaseService (Zod-validated CRUD)
        -> Firestore (gRPC)
```

**Rules:**
- Services never access `req`/`res` -- they are framework-agnostic
- Every service method receives `tenantId` as a parameter
- FirebaseService validates every write against the SchemaMap
- Path templates use `{tenantId}` substitution: `tenants/${tenantId}/agents`

### 7.2 Frontend Access

```
Server Component
  -> DAL function (server/dal/)
    -> Firestore Admin SDK (direct query)
    -> Return typed data to component

Client Component
  -> React Query (useQuery/useMutation)
    -> fetch(/api/...)
    -> Backend Express handler
    -> Service -> FirebaseService -> Firestore
```

**Rules:**
- Server Components use DAL functions for direct Firestore access (no HTTP round-trip)
- Client Components always go through the REST API (never direct Firestore)
- No `useEffect` for data fetching -- React Query or Server Components only

### 7.3 Real-Time Updates

```
Firestore Snapshot Listener (backend)
  -> SocketService.emit(userId, event, data)
    -> Socket.io WebSocket
      -> Frontend client
        -> Zustand store update
          -> React re-render
```

Used for: Mastermind Stream (agent reasoning), channel status changes, QR code delivery, campaign progress.

---

## 8. Firebase Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Global user profile: only the user themselves
    match /users/{userId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }

    // Legacy tenant paths: tenantId must match auth token
    match /tenants/{tenantId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.token.tenantId == tenantId;
    }

    // New user-scoped paths: userId must match auth UID
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

**Enforcement**: Security rules are the last line of defense. The application layer (AuthGuard, middleware) handles authorization first. Firestore rules catch anything that slips through.

---

## 9. Backup & Recovery

| Concern | Strategy |
|---------|----------|
| **Data loss** | Firestore automatic daily backups (Google-managed) |
| **Point-in-time recovery** | Firestore PITR enabled (up to 7 days) |
| **Session loss** | Channel reconnects automatically via health monitor |
| **Redis loss** | Redis is a cache -- cold start reads from Firestore, rebuilds cache |
| **Usage counter loss** | In-memory counters lost on crash; counters since last flush are gap. Acceptable (< 10s of data) |

---

## 10. Data Migration Path

### From Legacy (tenants/) to New (users/)

The codebase currently has both path patterns. The migration strategy:

1. **Phase 2 (complete)**: New modules (`usage-tracker`, `channel-auth-state`, `user-config`) write to `users/{userId}/` paths
2. **Phase 4 (complete)**: `backend/` source migrated to `src/` to share Zod schemas
3. **Phase 5 (complete)**: Engine foundation wired to use `users/{userId}/` for multi-tenancy
4. **Post-migration**: Update `FirebaseService.SchemaMap` to use `users/` paths exclusively and remove `tenants/` paths

**During transition**: Both paths coexist. New code reads from `users/` first, falls back to `tenants/` for backward compatibility.
