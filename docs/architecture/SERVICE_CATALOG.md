# DeXMart Service Catalog

> **Last verified**: 2026-04-10 | **Source**: `src/services/` directory listing
>
> **True Fusion complete**: All source code exists exclusively in the unified `src/` tree. The `backend/` and `openclaw/` directories have been deleted. No migration artifacts remain.

---

## Table of Contents

1. [Core Platform Services](#1-core-platform-services)
2. [Agent & Channel Services](#2-agent--channel-services)
3. [AI & Intelligence Services](#3-ai--intelligence-services)
4. [Billing & Authorization Services](#4-billing--authorization-services)
5. [Messaging & Campaign Services](#5-messaging--campaign-services)
6. [Safety & Moderation Services](#6-safety--moderation-services)
7. [Data & Persistence Services](#7-data--persistence-services)
8. [Infrastructure Services](#8-infrastructure-services)
9. [Automation & Flow Services](#9-automation--flow-services)
10. [Fusion Layer Modules](#10-fusion-layer-modules)
11. [Migration Status Table](#11-migration-status-table)

---

## 1. Core Platform Services

### ConfigService
| Field | Value |
|-------|-------|
| **File** | `src/services/ConfigService.ts` |
| **Pattern** | Singleton (`getInstance()`) |
| **Purpose** | Centralized configuration management with Zod validation |
| **Dependencies** | `dexmart-config/env.schema.ts` |
| **Tests** | `ConfigService.test.ts` |

Loads and validates environment variables at startup. Provides typed access to config values with dot-notation paths. Supports dev/prod/test environments. All config access goes through this singleton.

### MultiTenantService
| Field | Value |
|-------|-------|
| **File** | `src/services/multiTenantService.ts` |
| **Pattern** | Singleton |
| **Purpose** | Tenant lifecycle management (create, lookup, settings) |
| **Dependencies** | `FirebaseService`, `ConfigService` |

Handles atomic tenant initialization with Firestore transactions. Manages plan-based limits (Starter/Pro/Enterprise), tenant user management, and trial periods. Every new user registration flows through this service.

### AuthSystem
| Field | Value |
|-------|-------|
| **File** | `src/services/authSystem.ts` |
| **Pattern** | Module |
| **Purpose** | Authentication and authorization |
| **Dependencies** | `FirebaseService` (token verification) |

JWT and Firebase Auth token verification. Maps auth tokens to tenantId. Used by `authMiddleware.ts` on every authenticated request.

### UserService
| Field | Value |
|-------|-------|
| **File** | `src/services/userService.ts` |
| **Pattern** | Module |
| **Purpose** | User account management |
| **Dependencies** | `FirebaseService`, `MultiTenantService` |

User CRUD operations, profile management, and account settings. Links Firebase Auth UID to tenant records.

### SettingsService
| Field | Value |
|-------|-------|
| **File** | `src/services/settingsService.ts` |
| **Pattern** | Module |
| **Purpose** | Tenant-level settings CRUD |
| **Dependencies** | `FirebaseService` |

Reads/writes tenant settings from Firestore. Used by dashboard settings pages.

### TenantConfigService
| Field | Value |
|-------|-------|
| **File** | `src/services/tenantConfigService.ts` |
| **Pattern** | Module |
| **Purpose** | Per-tenant feature flags and configuration |
| **Dependencies** | `FirebaseService`, `ConfigService` |

Resolves tenant-specific overrides on top of platform defaults. Part of the configuration hierarchy: Infrastructure (.env) -> Platform Defaults -> Tenant Settings -> Bot Configuration.

---

## 2. Agent & Channel Services

### AgentService
| Field | Value |
|-------|-------|
| **File** | `src/services/AgentService.ts` |
| **Pattern** | Singleton |
| **Purpose** | AI Agent lifecycle (CRUD, linking to channels) |
| **Dependencies** | `FirebaseService`, `SystemAuthorityService` |
| **Tests** | `AgentService.test.ts` |

Manages the 3-level hierarchy: Tenant -> Agents -> Channels. Creates/retrieves/deletes agents. Ensures a `system_default` agent exists for webhook-only connectivity. Checks plan limits before agent creation.

### ChannelService
| Field | Value |
|-------|-------|
| **File** | `src/services/ChannelService.ts` |
| **Pattern** | Singleton |
| **Purpose** | Channel connectivity lifecycle (create, start, stop, delete) |
| **Dependencies** | `FirebaseService`, `ChannelManagerService`, `SystemAuthorityService` |
| **Tests** | `ChannelService.test.ts`, `.lifecycle.test.ts`, `.cleanup.test.ts`, `.move.test.ts` |

Manages connectivity slots nested under agents: `tenants/{tenantId}/agents/{agentId}/channels/{channelId}`. Auto-generates webhook secrets for non-native channels. Resolves platform adapters via the channel manager.

### ChannelManagerService
| Field | Value |
|-------|-------|
| **File** | `src/services/ChannelManagerService.ts` |
| **Pattern** | Singleton |
| **Purpose** | Channel connection pool management and health monitoring |
| **Dependencies** | `ChannelService`, platform SDKs (Baileys, grammY, discord.js) |
| **Tests** | `ChannelManagerService.test.ts` |

Manages active WebSocket/API connections per channel. Handles reconnection logic, stale socket detection, and max-restarts-per-hour caps. The runtime counterpart to `ChannelService` (which handles persistence).

### IngressService
| Field | Value |
|-------|-------|
| **File** | `src/services/IngressService.ts` |
| **Pattern** | Singleton |
| **Purpose** | Centralized inbound message entry point for all channels |
| **Dependencies** | `AgentService`, `DeduplicationService`, `AutomationService`, `FlowEngine`, AI Agent, `WebhookService`, `Analytics` |
| **Tests** | `IngressService.test.ts`, `.hierarchy.test.ts`, `.path.test.ts` |

The most critical routing service. Every inbound message from every channel flows through `handleCommonMessage()`. Implements priority-based routing:
1. Automations (trigger: message_received)
2. Visual Flows (FlowEngine)
3. AI Agents (pi-embedded-runner)
4. Webhook Forwarding (fallback)

Includes message deduplication with clock skew tolerance and CommonMessage format normalization.

---

## 3. AI & Intelligence Services

### DeXMartBrain
| Field | Value |
|-------|-------|
| **File** | `src/services/DeXMartBrain.ts` |
| **Pattern** | Wrapper |
| **Purpose** | Backward-compatible alias for the AI processing pipeline |
| **Status** | Deprecated -- points to OpenClaw's agent runtime |

Legacy wrapper. In Phase 3, this is being replaced by direct integration with OpenClaw's pi-embedded-runner.

### DeXMartToolBridge
| Field | Value |
|-------|-------|
| **File** | `src/services/DeXMartToolBridge.ts` |
| **Pattern** | Bridge |
| **Purpose** | Registers legacy DeXMart bot commands as unified AI tools |
| **Dependencies** | `CommandSystem`, Tool Registry |
| **Tests** | `DeXMartToolBridge.test.ts` |

Maps ~16 DeXMart Command objects to ToolDefinition format. Bridges YouTube DL, Instagram DL, TikTok DL, image generation (DALL-E, Animagine), weather, translate, and more into the unified tool registry so AI agents can use them.

### MastermindSkillBridge
| Field | Value |
|-------|-------|
| **File** | `src/services/MastermindSkillBridge.ts` |
| **Pattern** | Bridge |
| **Purpose** | Registers Phase 2+ advanced agentic skills |
| **Dependencies** | `ResearchSkill`, Tool Registry |

Currently registers the `ResearchSkill` (nested multi-agent research). Extensible for future advanced skills.

### MastermindStreamService
| Field | Value |
|-------|-------|
| **File** | `src/services/MastermindStreamService.ts` |
| **Pattern** | Event emitter |
| **Purpose** | Real-time AI reasoning transparency via WebSocket |
| **Dependencies** | `SocketService` |
| **Tests** | `MastermindStreamService.test.ts`, `.integration.test.ts` |

Broadcasts agent reasoning events to the frontend dashboard in real-time. Event types: `reasoning:start`, `reasoning:thought`, `tool:invoke`, `tool:result`, `agent:spawn`, `reasoning:complete`, `reasoning:error`. All events scoped by userId.

### ResearchSkill
| Field | Value |
|-------|-------|
| **File** | `src/services/researchSkill.ts` |
| **Pattern** | Skill |
| **Purpose** | Multi-agent research with autonomous audit |

Phase 2 nested agentic research implementation. Spawns sub-agents for exhaustive data gathering. Supports 1-5 depth levels for thoroughness control.

### NlpProcessor
| Field | Value |
|-------|-------|
| **File** | `src/services/nlpProcessor.ts` |
| **Pattern** | Module |
| **Purpose** | Natural language processing for intent detection |

Extracts intents and entities from user messages. Used by IngressService for routing decisions.

### EmbeddingService
| Field | Value |
|-------|-------|
| **File** | `src/services/embeddingService.ts` |
| **Pattern** | Module |
| **Purpose** | Text embedding generation for semantic operations |

Generates vector embeddings for semantic search and caching.

### SemanticCacheService
| Field | Value |
|-------|-------|
| **File** | `src/services/SemanticCacheService.ts` |
| **Pattern** | Module |
| **Purpose** | Semantic similarity caching for AI responses |

Caches AI responses keyed by semantic similarity (92% threshold). Avoids redundant LLM calls for similar queries.

### CommandSystem
| Field | Value |
|-------|-------|
| **File** | `src/services/commandSystem.ts` |
| **Pattern** | Registry |
| **Purpose** | Bot command registry and loader |

Loads and manages legacy bot commands from `src/commands-dexmart/`. Commands are registered at startup and bridged to the tool registry via `DeXMartToolBridge`.

### CommandSuggestions
| Field | Value |
|-------|-------|
| **File** | `src/services/commandSuggestions.ts` |
| **Pattern** | Module |
| **Purpose** | Suggests relevant commands based on user input |

---

## 4. Billing & Authorization Services

### SystemAuthorityService
| Field | Value |
|-------|-------|
| **File** | `src/services/SystemAuthorityService.ts` |
| **Pattern** | Singleton |
| **Purpose** | Plan-based usage limits enforcement (legacy naming) |
| **Dependencies** | `FirebaseService` |
| **Tests** | `SystemAuthorityService.test.ts` |

The original billing gate service. Checks tenant plan against usage limits. Being partially superseded by `src/billing/auth-guard.ts` (Phase 2) which uses the B2C `UserContext` model.

### UsageGuard
| Field | Value |
|-------|-------|
| **File** | `src/services/UsageGuard.ts` |
| **Pattern** | Module |
| **Purpose** | Usage quota enforcement at the request level |
| **Tests** | `UsageGuard.test.ts` |

Lightweight guard that checks current usage against plan limits before allowing operations.

### BillingService
| Field | Value |
|-------|-------|
| **File** | `src/services/billingService.ts` |
| **Pattern** | Module |
| **Purpose** | Subscription management and billing logic |
| **Dependencies** | `StripeService`, `FirebaseService` |

### StripeService
| Field | Value |
|-------|-------|
| **File** | `src/services/stripeService.ts` |
| **Pattern** | Module |
| **Purpose** | Stripe API wrapper for payment operations |
| **Dependencies** | Stripe SDK |

Handles subscription creation, updates, cancellations, webhook event processing, and invoice management.

### Fusion Layer: auth-guard.ts
| Field | Value |
|-------|-------|
| **File** | `src/billing/auth-guard.ts` |
| **Pattern** | Pure functions |
| **Purpose** | B2C billing gate utilities (Phase 2) |
| **Tests** | `src/billing/auth-guard.test.ts` (20/20) |

Key functions: `filterModelsForUser()`, `buildGateDeniedMessage()`, `assertCan()`. Works with `UserContext` (not `tenantId`).

### Fusion Layer: usage-tracker.ts
| Field | Value |
|-------|-------|
| **File** | `src/billing/usage-tracker.ts` |
| **Pattern** | Batched accumulator |
| **Purpose** | Non-blocking usage counter with batched Firestore flush |
| **Tests** | `src/billing/usage-tracker.test.ts` (9/9) |

In-memory counters flushed every 10s or at 50-increment threshold. Metrics: messages, agents, channels, tokensIn, tokensOut.

---

## 5. Messaging & Campaign Services

### CampaignService
| Field | Value |
|-------|-------|
| **File** | `src/services/campaignService.ts` |
| **Pattern** | Module |
| **Purpose** | Bulk messaging campaign orchestration |
| **Dependencies** | `AntiBanService`, `ChannelService`, `BullMQ` |

Campaign CRUD, scheduling, execution via BullMQ workers, and result tracking. Enforces anti-ban throttling and randomized delays.

### CampaignSocketService
| Field | Value |
|-------|-------|
| **File** | `src/services/campaignSocketService.ts` |
| **Pattern** | Event emitter |
| **Purpose** | Real-time campaign progress updates via WebSocket |

### TemplateService
| Field | Value |
|-------|-------|
| **File** | `src/services/templateService.ts` |
| **Pattern** | Module |
| **Purpose** | Message template CRUD with variable extraction |

### ContactService
| Field | Value |
|-------|-------|
| **File** | `src/services/contactService.ts` |
| **Pattern** | Module |
| **Purpose** | Contact management (CRUD, search, tagging) |

### GroupService
| Field | Value |
|-------|-------|
| **File** | `src/services/groupService.ts` |
| **Pattern** | Module |
| **Purpose** | WhatsApp group management |

### WebhookService
| Field | Value |
|-------|-------|
| **File** | `src/services/webhookService.ts` |
| **Pattern** | Module |
| **Purpose** | Outbound webhook delivery for external integrations |

### StickerService
| Field | Value |
|-------|-------|
| **File** | `src/services/stickerService.ts` |
| **Pattern** | Module |
| **Purpose** | Sticker creation and management |

### WelcomeService
| Field | Value |
|-------|-------|
| **File** | `src/services/welcomeService.ts` |
| **Pattern** | Module |
| **Purpose** | Welcome message management for new group members/contacts |

---

## 6. Safety & Moderation Services

### AntiBanService
| Field | Value |
|-------|-------|
| **File** | `src/services/antiBanService.ts` |
| **Pattern** | Module |
| **Purpose** | Anti-ban velocity rules, content rules, cooldown management |
| **Dependencies** | Redis (rate tracking) |

Critical for WhatsApp. Enforces message velocity limits, content diversity requirements, cooldown periods, and message spinning to prevent account bans. Never bypass this service.

### ContentModeration
| Field | Value |
|-------|-------|
| **File** | `src/services/contentModeration.ts` |
| **Pattern** | Module |
| **Purpose** | Content safety filtering |

Scans inbound and outbound messages for harmful content. Flags violations and optionally blocks delivery.

### RateLimiter
| Field | Value |
|-------|-------|
| **File** | `src/services/rateLimiter.ts` |
| **Pattern** | Module |
| **Purpose** | API rate limiting (global, per-user, per-command, per-AI) |
| **Dependencies** | Redis or in-memory fallback |

### DeduplicationService
| Field | Value |
|-------|-------|
| **File** | `src/services/deduplicationService.ts` |
| **Pattern** | Module |
| **Purpose** | Message deduplication with clock skew tolerance |

Prevents duplicate processing of the same inbound message. Used by IngressService.

---

## 7. Data & Persistence Services

### FirebaseService
| Field | Value |
|-------|-------|
| **File** | `src/services/FirebaseService.ts` |
| **Pattern** | Singleton |
| **Purpose** | Low-level Firestore CRUD with Zod schema validation |
| **Tests** | `FirebaseService.test.ts`, `.hierarchy.test.ts`, `.path.test.ts` |

The foundation of all data access. Path-aware document operations with `{tenantId}` substitution. SchemaMap validates every write against 18+ collection schemas.

### DatabaseService
| Field | Value |
|-------|-------|
| **File** | `src/services/database.ts` |
| **Pattern** | Module |
| **Purpose** | High-level Firestore operations with tenant scoping |
| **Dependencies** | `FirebaseService` |

Convenience layer over FirebaseService. Every method enforces tenantId scoping.

### GoogleDriveService
| Field | Value |
|-------|-------|
| **File** | `src/services/GoogleDriveService.ts` |
| **Pattern** | Module |
| **Purpose** | Google Drive API integration for file storage |

### BackupService
| Field | Value |
|-------|-------|
| **File** | `src/services/backupService.ts` |
| **Pattern** | Module |
| **Purpose** | Data backup and export operations |

### ToolPersistenceService
| Field | Value |
|-------|-------|
| **File** | `src/services/toolPersistenceService.ts` |
| **Pattern** | Module |
| **Purpose** | Persists tool execution state and results |

### TreeIndexService
| Field | Value |
|-------|-------|
| **File** | `src/services/TreeIndexService.ts` |
| **Pattern** | Module |
| **Purpose** | Hierarchical document index for fast traversal |

### Cache
| Field | Value |
|-------|-------|
| **File** | `src/services/cache.ts` |
| **Pattern** | Module |
| **Purpose** | In-memory caching layer (node-cache wrapper) |

### Fusion Layer: channel-auth-state.ts
| Field | Value |
|-------|-------|
| **File** | `src/persistence/channel-auth-state.ts` |
| **Pattern** | Adapter |
| **Purpose** | Universal channel session persistence to Firestore (Phase 2) |
| **Tests** | `src/persistence/channel-auth-state.test.ts` (12/12) |

Replaces `useMultiFileAuthState()` with `useChannelAuthState()` backed by any `AuthKeyValueStore` implementation.

### Fusion Layer: user-config.ts
| Field | Value |
|-------|-------|
| **File** | `src/config/user-config.ts` |
| **Pattern** | Module |
| **Purpose** | User-scoped config resolution with 3-layer cache (Phase 2) |
| **Tests** | `src/config/io.user-config.test.ts` (8/8) |

---

## 8. Infrastructure Services

### SocketService
| Field | Value |
|-------|-------|
| **File** | `src/services/socketService.ts` |
| **Pattern** | Singleton |
| **Purpose** | WebSocket server (Socket.io) for real-time client communication |

Manages WebSocket connections, room management (per-userId), and event broadcasting. Used by MastermindStreamService, CampaignSocketService, and channel status updates.

### JobQueue
| Field | Value |
|-------|-------|
| **File** | `src/services/jobQueue.ts` |
| **Pattern** | Module |
| **Purpose** | BullMQ job queue management |
| **Dependencies** | Redis |

### QueueService
| Field | Value |
|-------|-------|
| **File** | `src/services/queueService.ts` |
| **Pattern** | Module |
| **Purpose** | High-level queue operations (enqueue, dequeue, status) |

### CronManagerService
| Field | Value |
|-------|-------|
| **File** | `src/services/CronManagerService.ts` |
| **Pattern** | Singleton |
| **Purpose** | Scheduled task management |
| **Tests** | `CronManagerService.test.ts` |

### Analytics
| Field | Value |
|-------|-------|
| **File** | `src/services/analytics.ts` |
| **Pattern** | Module |
| **Purpose** | Event tracking and usage analytics |

### AiAnalytics
| Field | Value |
|-------|-------|
| **File** | `src/services/aiAnalytics.ts` |
| **Pattern** | Module |
| **Purpose** | AI-specific analytics (token usage, model performance, latency) |

### AuditService
| Field | Value |
|-------|-------|
| **File** | `src/services/auditService.ts` |
| **Pattern** | Module |
| **Purpose** | Audit trail logging for compliance |

### HealthCheckService
| Field | Value |
|-------|-------|
| **File** | `src/services/healthCheckService.ts` |
| **Pattern** | Module |
| **Purpose** | System health checks (DB connectivity, Redis, channel status) |

### Monitoring
| Field | Value |
|-------|-------|
| **File** | `src/services/monitoring.ts` |
| **Pattern** | Module |
| **Purpose** | OpenTelemetry instrumentation and Prometheus metrics |

### ErrorHandler
| Field | Value |
|-------|-------|
| **File** | `src/services/errorHandler.ts` |
| **Pattern** | Module |
| **Purpose** | Global error handling and formatting |

### EventHandler
| Field | Value |
|-------|-------|
| **File** | `src/services/eventHandler.ts` |
| **Pattern** | Module |
| **Purpose** | Local event bus for inter-service communication |

### MiddlewareSystem
| Field | Value |
|-------|-------|
| **File** | `src/services/middlewareSystem.ts` |
| **Pattern** | Module |
| **Purpose** | Middleware chain management for message processing pipeline |

### InteractiveAuth
| Field | Value |
|-------|-------|
| **File** | `src/services/interactiveAuth.ts` |
| **Pattern** | Module |
| **Purpose** | Interactive authentication flows (QR code, pairing code) |

### ApiKeyManager
| Field | Value |
|-------|-------|
| **File** | `src/services/ApiKeyManager.ts` |
| **Pattern** | Module |
| **Purpose** | Universal API key rotation with circuit breaker |

Wraps `@splashcodex/api-key-manager`. Semantic caching with 92% similarity threshold. Proactive health checks every 5 minutes. Fallback strategies on key failure.

---

## 9. Automation & Flow Services

### AutomationService
| Field | Value |
|-------|-------|
| **File** | `src/services/automationService.ts` |
| **Pattern** | Module |
| **Purpose** | Automation rule management (triggers, conditions, actions) |

### FlowEngine
| Field | Value |
|-------|-------|
| **File** | `src/services/flowEngine.ts` |
| **Pattern** | Module |
| **Purpose** | Visual flow execution runtime |

Executes no-code visual flows built in the FlowBuilder UI. Processes nodes sequentially with branching logic.

### FlowService
| Field | Value |
|-------|-------|
| **File** | `src/services/flowService.ts` |
| **Pattern** | Module |
| **Purpose** | Flow CRUD operations (persistence layer for FlowEngine) |

---

## 10. Fusion Layer Modules

These are the Phase 2+ modules that implement the True Fusion injection points. They live outside `src/services/` in their own domain directories.

### UserContextResolver
| Field | Value |
|-------|-------|
| **File** | `src/tenancy/context-resolver.ts` |
| **Tests** | `src/tenancy/__tests__/context-resolver.test.ts` (5/5) |
| **Purpose** | Resolves UserContext from JWT, userId, or channelId |

### tenant-context.ts
| Field | Value |
|-------|-------|
| **File** | `src/tenancy/tenant-context.ts` |
| **Purpose** | UserContext interface, PLAN_CAPABILITIES constants, createAuthGuard() factory |

### auth-guard.ts
| Field | Value |
|-------|-------|
| **File** | `src/billing/auth-guard.ts` |
| **Tests** | `src/billing/auth-guard.test.ts` (20/20) |
| **Purpose** | Billing gate: filterModelsForUser, assertCan, buildGateDeniedMessage |

### usage-tracker.ts
| Field | Value |
|-------|-------|
| **File** | `src/billing/usage-tracker.ts` |
| **Tests** | `src/billing/usage-tracker.test.ts` (9/9) |
| **Purpose** | Batched usage counter with Firestore flush |

### channel-auth-state.ts
| Field | Value |
|-------|-------|
| **File** | `src/persistence/channel-auth-state.ts` |
| **Tests** | `src/persistence/channel-auth-state.test.ts` (12/12) |
| **Purpose** | Universal channel session persistence |

### user-config.ts
| Field | Value |
|-------|-------|
| **File** | `src/config/user-config.ts` |
| **Tests** | `src/config/io.user-config.test.ts` (8/8) |
| **Purpose** | User-scoped config with 3-layer cache |

---

## 11. Migration Status Table

Status of each service relative to the Phase 4 migration (backend/ → src/). **Phase 4 is complete.**

| Service | Location | Notes |
|---------|----------|-------|
| AgentService | `src/services/AgentService.ts` | ✅ Migrated |
| ChannelService | `src/services/ChannelService.ts` | ✅ Migrated + `startWatchdog()` / `stopWatchdog()` added (ChannelWatchdog dissolved) |
| ChannelManagerService | `src/services/ChannelManagerService.ts` | ✅ Migrated |
| ChannelManager (adapter registry) | `src/services/channels/ChannelManager.ts` | ✅ Recreated from compiled JS + enhanced with `getAdaptersForUser()`, `shutdownUserAdapters()` |
| Channel Registry | `src/services/channels/registry.ts` | ✅ Recreated — `GenericOpenClawAdapter` bridge removed, `nativeOpenClaw` flag added |
| WhatsappAdapter | `src/services/channels/whatsapp/WhatsappAdapter.ts` | ✅ Recreated + fused: wraps OpenClaw `createWaSocket()` with Firestore auth (Phase 2 FR-2) |
| IngressService | `src/ingress/ingress-service.ts` | ✅ Migrated + **wired to `runEmbeddedPiAgent()`** (Phase 4 core fusion) |
| FirebaseService | `src/services/FirebaseService.ts` | ✅ Migrated |
| ConfigService | `src/services/ConfigService.ts` | ✅ Migrated |
| MultiTenantService | `src/services/MultiTenantService.ts` | ✅ Migrated |
| MastermindStreamService | `src/services/MastermindStreamService.ts` | ✅ Migrated — Phase 3 wiring complete via `src/analytics/event-listener.ts` |
| DeXMartToolBridge | `src/services/DeXMartToolBridge.ts` | ✅ Migrated |
| MastermindSkillBridge | `src/services/MastermindSkillBridge.ts` | ✅ Migrated |
| SystemAuthorityService | `src/services/SystemAuthorityService.ts` | ✅ Migrated — second-pass dedup with `src/billing/system-authority.ts` pending |
| CampaignService | `src/services/CampaignService.ts` | ✅ Migrated |
| AntiBanService | `src/services/AntiBanService.ts` | ✅ Migrated |
| ContentModeration | `src/services/ContentModeration.ts` | ✅ Migrated |
| Analytics | `src/services/analytics.ts` | ✅ Migrated |
| AuthSystem | `src/services/AuthSystem.ts` | ✅ Migrated |
| UserService | `src/services/UserService.ts` | ✅ Migrated |
| WebhookService | `src/services/WebhookService.ts` | ✅ Migrated |
| SemanticCacheService | `src/services/SemanticCacheService.ts` | ✅ Migrated — Phase 3: merged with OpenClaw via `hybrid-adapter.ts` and `memory-worker.ts` |
| CronManagerService | `src/services/CronManagerService.ts` | ✅ Migrated — second-pass: merge with OpenClaw `src/cron/` pending |
| GoogleDriveService | `src/services/GoogleDriveService.ts` | ✅ Migrated |
| All routes / middleware / lib / jobs / server | `src/routes/`, `src/middleware/`, `src/lib/`, `src/jobs/`, `src/server/` | ✅ Migrated |
| All workers / controllers / events / tools / webhooks | `src/workers/`, `src/controllers/`, `src/events/`, `src/tools/`, `src/webhooks/` | ✅ Migrated |
| Config (conflict avoidance) | `src/dexmart-config/` | ✅ Migrated — renamed to avoid conflict with OpenClaw `src/config/config.ts` |

**Remaining work (post-Phase 4):**
1. **Staging smoke test** — verify `src/main.ts` boots cleanly; all channels reconnect; agent processes messages
2. **Delete `backend/`** — TS source fully migrated; only `dist/` remains
3. **Second-pass dedup** — consolidate `SystemAuthorityService` ↔ `src/billing/system-authority.ts`; `CronManagerService` ↔ `src/cron/`

---

## Service Dependency Graph (Simplified)

```
ConfigService (standalone, no deps)
    |
    v
FirebaseService (depends on: Firebase Admin SDK)
    |
    v
DatabaseService (depends on: FirebaseService)
    |
    +---> MultiTenantService
    +---> AgentService -------> ChannelService -------> ChannelManagerService
    +---> UserService                                        |
    +---> CampaignService ---> AntiBanService                v
    +---> ContactService                              Platform SDKs
    +---> TemplateService                            (Baileys, grammY,
    +---> WebhookService                              discord.js, etc.)
    +---> FlowService
    |
    v
IngressService (depends on: AgentService, DeduplicationService,
                AutomationService, FlowEngine, AI Agent, WebhookService)
    |
    v
MastermindStreamService (depends on: SocketService)
    |
    v
Dashboard (WebSocket consumer)
```
