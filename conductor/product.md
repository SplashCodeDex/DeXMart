# DeXMart Product Guide

## Vision

DeXMart is OpenClaw — the battle-tested multi-channel AI gateway — fused with B2C
multi-tenancy, Stripe billing gates, and Firebase auth grounded into the engine foundation.
The DeXMart Next.js dashboard replaces ControlUI as the sole user-facing interface.

There is no "OpenClaw side" and "DeXMart side." There is only DeXMart.

## Target Users
- B2C SaaS customers managing WhatsApp bots and AI agents via a web dashboard
- Developers building on the unified platform

## Core Capabilities
- 40+ channel plugins (WhatsApp, Telegram, Discord, Slack, Signal, etc.) via OpenClaw engine
- AI Mastermind powered by pi-embedded-runner (13+ model providers)
- Per-user tenant isolation (`users/{userId}/...` Firestore hierarchy)
- Stripe plan-gated features and usage tracking
- Real-time reasoning stream via Socket.io
- Automation flows, contact/group management, campaigns, anti-ban enforcement

## Architecture Principle (The Fusion Principle)
OpenClaw is to DeXMart what the Linux kernel is to Ubuntu: the engine under the hood.
B2C tenancy, billing, and auth are injected into the engine foundation — not wrapped around it.
