# DeXMart Architecture Documentation

> The definitive guide to the DeXMart platform architecture, True Fusion strategy, and system design.
>
> **Master Plan**: DeXMart = OpenClaw with B2C/Stripe/Firebase grounded into the foundation.
> `extensions/` is the canonical channel system. DeXMart UI replaces ControlUI.
>
> **Last updated**: 2026-04-10 | **Current Phase**: Phase 5 (Foundation Grounding)

---

## Documents

| Document | Description |
|----------|-------------|
| [BLUEPRINT.md](./BLUEPRINT.md) | **Start here.** Master architecture overview -- vision, principles, package structure, tech stack, component relationships, security, and deployment topology. |
| [SYSTEM_DIAGRAMS.md](./SYSTEM_DIAGRAMS.md) | 15 Mermaid diagrams covering C4 context/container, component relationships, injection model, message pipeline, channel lifecycle, billing flow, config resolution, session persistence, frontend data flow, startup sequence, deployment, package deps, Firestore hierarchy, and phase roadmap. |
| [FUSION_STRATEGY.md](./FUSION_STRATEGY.md) | The True Fusion approach in detail -- why managed fork, the 4 phases, 4 injection points, upstream sync strategy, what changed vs. original OpenClaw, risk register, and success criteria. |
| [DATA_MODEL.md](./DATA_MODEL.md) | Firestore document hierarchy (legacy and new paths), all Zod schemas, 3-layer caching architecture, session persistence design, batched usage tracking, data access patterns, security rules, and migration path. |
| [SERVICE_CATALOG.md](./SERVICE_CATALOG.md) | Complete reference of all 57 services -- purpose, pattern, dependencies, test status, and Phase 4 migration status. Organized by domain (core, agent/channel, AI, billing, messaging, safety, data, infrastructure, automation). |

## Related Documents

| Document | Location | Description |
|----------|----------|-------------|
| [TrueFusionPlan.md](../TrueFusionPlan.md) | `docs/` | Original canonical fusion plan (4 phases) |
| [Product Guide](../../conductor/product.md) | `conductor/` | Product vision, features, target audience |
| [Tech Stack](../../conductor/tech-stack.md) | `conductor/` | Technology choices and versions |
| [Workflow](../../conductor/workflow.md) | `conductor/` | TDD workflow, task lifecycle, quality gates |
| [Product Guidelines](../../conductor/product-guidelines.md) | `conductor/` | Tone, visual identity, UX principles |
| [CLAUDE.md](../../CLAUDE.md) | Root | Developer onboarding guide and coding standards |
| [OpenClaw AGENTS.md](../../openclaw/AGENTS.md) | `openclaw/` | OpenClaw engine guidelines |

## How to Use These Docs

- **New to the project?** Start with [BLUEPRINT.md](./BLUEPRINT.md) for the big picture, then [FUSION_STRATEGY.md](./FUSION_STRATEGY.md) to understand why things are structured this way.
- **Need to understand data flow?** See [SYSTEM_DIAGRAMS.md](./SYSTEM_DIAGRAMS.md) for visual diagrams and [DATA_MODEL.md](./DATA_MODEL.md) for the persistence layer.
- **Looking for a specific service?** Check [SERVICE_CATALOG.md](./SERVICE_CATALOG.md) for the complete inventory with file paths and dependencies.
- **Working on channels?** All channel work belongs in `extensions/`. The files in `src/services/channels/` are **deprecated** dead-end code pending removal in Phase 5. See [TrueFusionPlan.md](../TrueFusionPlan.md) for the architectural correction.
- **Working on a conductor track?** Cross-reference the track's `spec.md` with these architecture docs to understand the system context.

## Keeping Docs Current

These documents describe the system as of the date noted at the top of each file. When making architectural changes:

1. Update the relevant document(s) in this directory
2. Update the "Last verified" date
3. If adding new services, add them to SERVICE_CATALOG.md
4. If changing data paths, update DATA_MODEL.md
5. If modifying injection points, update FUSION_STRATEGY.md
6. **Never** document `src/services/channels/whatsapp/WhatsappAdapter.ts`, DeXMart's `ChannelManager.ts`, or DeXMart's `registry.ts` as canonical — they are deprecated
