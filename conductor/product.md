# DeXMart Product Guide

## Initial Concept

DeXMart is an enterprise-grade, omnichannel AI automation platform with a unified codebase that fuses the OpenClaw engine with DeXMart's platform layer into a single `src/` tree. OpenClaw is maintained as a **managed fork** — its engine capabilities are preserved and extended natively rather than wrapped. DeXMart's platform layer contributes two capabilities that OpenClaw itself does not have: **user-level multi-tenancy** (B2C model, like Spotify/CapCut) and **billing gating** (Stripe subscriptions controlling feature access per plan).

The platform follows the B2C multi-tenant pattern: every user is isolated via their `userId`, all data is tagged per-user in Firestore, and the authorization layer ensures User A cannot access User B's data. There are no teams, orgs, or admin roles — the user IS the tenant.

## Target Audience

- **Small to Medium Businesses (SMBs):** Needing automated customer support and engagement tools.
- **Marketing Agencies:** Managing multiple client messaging accounts for campaigns.
- **Individual Power Users:** Developers or entrepreneurs automating personal or business workflows.
- **Enterprises:** Requiring a robust, scalable solution for high-volume messaging across channels.

## Core Features

### 1. User & Account Management

- **Self-Service Onboarding:** Fast, "one-click" onboarding via Google OAuth or Email/Password with automated account provisioning.
- **B2C Isolation:** Every resource (channels, agents, sessions, messages) is scoped to the user's `userId` in Firestore. Shared infrastructure, authorization-enforced walls.
- **Dashboard:** Centralized hub for metrics, bot status, and account settings.

### 2. Channel Management

Powered by **OpenClaw's channel plugin system** (40+ extensions), integrated natively into the unified `src/` tree.

- **Connectivity Slots:** Link WhatsApp via QR code, connect Telegram, Discord, Slack, Signal, and 35+ other platforms via OpenClaw's native channel plugins.
- **Webhook Mode:** Support for connectivity-only use cases where incoming messages are forwarded to external webhooks without AI intervention.
- **Unified Agent Orchestration:** AI Agents (managed per-user) act as the parent for one or more Channels.
- **Dynamic Binding:** Hot-swap Agents across Channels instantly without disconnecting the underlying platform session.
- **Channel Health Monitor:** OpenClaw's native health monitoring with stale socket detection, restart cooldowns, and max-restarts-per-hour caps — enhanced with user-scoping.

### 3. AI Agent System

Powered by **OpenClaw's pi-embedded-runner**, integrated natively into the unified `src/` tree.

- **13+ Model Providers:** Anthropic, OpenAI, Google Gemini, AWS Bedrock, Ollama, HuggingFace, and more — all via OpenClaw's model selection system.
- **Model Fallback Chains:** If one model fails, the engine automatically tries the next in the chain.
- **Billing-Gated Model Access:** The `UserContext` capabilities filter determines which models each subscription tier can use.
- **Autonomous Multi-Agent Orchestration:** Recursive reasoning loops and dynamic sub-agent spawning via OpenClaw's subagent registry.
- **Real-time AI Transparency:** Live streaming of AI thought processes, tool invocations, and reasoning stages via WebSockets (Mastermind Stream).
- **Tool System:** OpenClaw's native tool/skill system. DeXMart-exclusive tools (campaigns, anti-ban) register as first-class tools alongside OpenClaw's built-in tools.

### Core Pillars

1. **Omnichannel Mastery:** Unified management of all messaging platforms within a single dashboard.
2. **OpenClaw Engine:** Battle-tested agent runtime with 13+ model providers, 40+ channel extensions, and full tool orchestration.
3. **Fact-Based Transparency:** Live, granular monitoring of AI reasoning to build user trust.
4. **B2C Isolation:** Every user's data is private, enforced by the authorization layer.
5. **Billing-Gated Access:** Subscription tiers control which models, channels, features, and tools are available.

### 4. Messaging & Automation

- **Omnichannel Unified Inbox:** A single interface for viewing and managing conversations across all connected platforms, tracked by channel type and assigned agent.
- **Broadcast/Marketing:** High-performance campaign engine using BullMQ for reliable background processing with intelligent throttling and randomized delays.
- **Visual Automation (FlowBuilder 2.0):** No-code visual orchestrator for designing complex, multi-step conversation logic with skill nodes for triggering agentic AI tools.
- **Rich Templates:** Manage media-heavy templates with dynamic variable injection and AI Message Spinning (Pro+ tier) to prevent account bans.
- **Auto-Replies:** OpenClaw's native auto-reply system, configured per-user.

### 5. DeXMart-Exclusive Features (Not in OpenClaw)

| Feature | Module | Purpose |
|---|---|---|
| Firebase/Firestore | `src/persistence/` | Cloud persistence, user data isolation |
| Stripe Billing | `src/billing/` | Subscriptions, plan gating |
| UserContext + AuthGuard | `src/tenancy/` | B2C isolation, feature permission checks |
| Campaign Engine | `src/campaigns/` | Bulk messaging with anti-ban throttling |
| Anti-Ban System | `src/safety/anti-ban.ts` | Rate limiting, message spinning |
| Content Moderation | `src/safety/content-moderation.ts` | Safety filters |
| AI Analytics | `src/analytics/` | Usage tracking, audit trail |
| Mastermind Stream | `src/analytics/mastermind-stream.ts` | Real-time reasoning visibility |
| Ingress Routing | `src/ingress/` | Omnichannel message routing |
| Agent CRUD | `src/agents-management/` | Multi-agent management per user |
| Dashboard | `frontend/` | Next.js management UI |

### 6. Infrastructure & Monetization

- **Payments:** Integrated Stripe subscription management with four tiers (Free, Starter, Pro, Enterprise).
- **Scalability:** Single unified codebase (OpenClaw engine + DeXMart platform) with Redis caching and BullMQ worker queues.
- **Security:** Zero-trust data layer with Zod validation, AuthGuard for user isolation, and Firestore security rules.
- **Managed Fork:** OpenClaw upstream tracked as git remote. Security patches cherry-picked, new features manually adapted.

## Vision

To build a scalable and reliable B2C SaaS platform that democratizes access to powerful omnichannel AI automation tools — a unified platform where the OpenClaw engine and DeXMart's user-level isolation and subscription billing form a single, cohesive product.
