# Upstream Leverage & Exclusive Feature Embedding Policy

> **Canonical source of truth** — All other docs, agent rules, conductor artifacts, and workflow files reference this document.
>
> **Last updated**: 2026-04-19

---

## 1. Upstream Leverage Principle

**FOUNDATIONAL RULE**: DeXMart MUST NOT duplicate logic, features, code, infrastructure, or capabilities that OpenClaw upstream already provides. Instead, DeXMart **leverages and utilizes** what upstream offers.

### 1.1 Why This Exists

OpenClaw owns the majority of the codebase — 4,040+ TypeScript files, 40+ channel extensions, a full plugin SDK, gateway infrastructure, agent runtime, and CLI tooling. DeXMart's value-add is the B2C multi-tenancy layer, billing gates, Firebase persistence, and exclusive platform features. By leveraging upstream instead of duplicating it:

1. **Automatic changelog adaptation** — When OpenClaw releases updates (features, fixes, security patches), DeXMart inherits them automatically through the upstream sync process. Zero rework.
2. **Minimal maintenance surface** — DeXMart only maintains its ~5 injection points and exclusive features. Everything else is upstream's responsibility.
3. **Zero divergence risk** — Duplicated logic creates parallel implementations that drift apart over time, eventually becoming unmaintainable.
4. **Faster development** — Building on proven upstream code is faster than rebuilding from scratch.

### 1.2 The Decision Tree — Build vs. Leverage

Before implementing **any** new feature, service, utility, or capability, the developer/agent MUST evaluate:

```
Does OpenClaw upstream already provide this capability?
├── YES → LEVERAGE IT. Import directly, inject at well-defined points if needed.
│         Do NOT create a parallel implementation.
│
├── PARTIALLY → Extend the upstream implementation via the injection point pattern.
│               Add only the delta (billing gate, tenant scope, etc.).
│               Do NOT fork or wrap the upstream module.
│
└── NO → Is this a DeXMart-exclusive feature? (See §2 for investigation protocol)
    ├── YES (confirmed exclusive) → Embed into the unified project's core (§2.2)
    └── NO / UNCERTAIN → Do NOT implement. Research further or file a Conductor track.
```

### 1.3 Anti-Duplication Checklist (Mandatory Pre-Implementation)

Before writing any new module, service, or utility, complete this checklist:

- [ ] **Searched `src/`** for existing implementation (`grep`, file search, or LSP)
- [ ] **Searched `extensions/`** for existing plugin implementation
- [ ] **Checked OpenClaw's CHANGELOG.md** for recently added capabilities
- [ ] **Checked `docs/OPENCLAW_UPSTREAM_REPORT.md`** for upcoming upstream features
- [ ] **Verified no bridge/wrapper/adapter** is being created (banned pattern)
- [ ] **Confirmed this is not reimplementing** an upstream module with slight modifications

If ANY of the above reveals an existing upstream capability → **STOP**. Leverage the existing implementation.

---

## 2. DeXMart-Exclusive Feature Embedding Protocol

**FOUNDATIONAL RULE**: Since OpenClaw and DeXMart are **one unified project**, any feature that is confirmed DeXMart-exclusive MUST be embedded into the core of the project natively — not as a sidecar, plugin, afterthought, or secondary citizen. This is how top-tier companies (Google, Apple, Stripe) handle core product capabilities.

### 2.1 The Investigation Protocol

A feature is classified as "DeXMart-exclusive" **only after** passing this investigation:

1. **Does OpenClaw provide this?** → Search `src/`, `extensions/`, and upstream changelog.
2. **Could OpenClaw provide this in the future?** → Check OpenClaw's `VISION.md`, issue tracker, and roadmap.
3. **Is this fundamentally a B2C/SaaS concern?** → Multi-tenancy, billing, cloud persistence, user management, platform analytics.
4. **Would this feature make sense in OpenClaw's single-user CLI mode?** → If yes, it's NOT DeXMart-exclusive.

**A feature is DeXMart-exclusive if and only if**:

- It does NOT exist in upstream (confirmed by search)
- It is fundamentally tied to DeXMart's B2C/SaaS identity (multi-tenancy, billing, cloud persistence, platform-level UX)
- It would NOT make sense in OpenClaw's single-user, self-hosted mode

### 2.2 Embedding Rules (Once Confirmed Exclusive)

When a feature is confirmed DeXMart-exclusive:

1. **Embed natively** — The feature lives in `src/` as a first-class module (e.g., `src/billing/`, `src/tenancy/`, `src/campaigns/`). It is NOT a plugin, NOT in `extensions/`, NOT in a separate package.
2. **Inject at foundation level** — If the feature needs to interact with OpenClaw's engine, inject at well-defined points (config loading, plugin runtime, session creation, gateway channels) — the same pattern used for billing gates and tenant context.
3. **Full test coverage** — The feature ships with co-located tests, the same TDD mandate as everything else.
4. **Documentation** — The feature is documented in `docs/TrueFusionPlan.md` (DeXMart-Exclusive Features table) and referenced in `FUSION_STRATEGY.md`.
5. **No second-class treatment** — The feature must be indistinguishable from the rest of the codebase. A new developer should not be able to tell "this was added later" vs. "this was always here."

### 2.3 Current DeXMart-Exclusive Features (Reference)

| Feature                                 | Location                                  | Embedded Status |
| --------------------------------------- | ----------------------------------------- | --------------- |
| Firebase/Firestore persistence          | `src/persistence/`, `src/lib/`            | ✅ Core         |
| Stripe billing & plan gating            | `src/billing/`                            | ✅ Core         |
| Multi-tenancy (B2C)                     | `src/tenancy/`                            | ✅ Core         |
| Campaigns & bulk messaging              | `src/campaigns/`                          | ✅ Core         |
| Anti-ban engine                         | `src/safety/`                             | ✅ Core         |
| Content moderation                      | `src/safety/`                             | ✅ Core         |
| AI analytics & usage tracking           | `src/analytics/`                          | ✅ Core         |
| Mastermind stream (real-time reasoning) | `src/services/MastermindStreamService.ts` | ✅ Core         |
| Ingress routing (omnichannel)           | `src/ingress/`                            | ✅ Core         |
| Agent management (multi-agent CRUD)     | `src/agents-management/`                  | ✅ Core         |
| Next.js dashboard                       | `frontend/`                               | ✅ Core         |
| Automation flows                        | `src/services/FlowEngine.ts`              | ✅ Core         |
| Contact/Group CRM                       | `src/services/ContactService.ts`          | ✅ Core         |

---

## 3. Changelog Adaptation Guarantee

By following the Upstream Leverage Principle, DeXMart gains a critical operational advantage:

**Every OpenClaw upstream update automatically benefits DeXMart.**

- **Bug fixes** → DeXMart inherits them through the sync process without re-implementing fixes.
- **Security patches** → Cherry-picked immediately; no parallel code to patch separately.
- **New features** → Available to evaluate and integrate; no catch-up implementation needed.
- **Performance improvements** → Applied globally since DeXMart uses the same code paths.
- **New channel plugins** → Work automatically since DeXMart uses the native plugin system.
- **Agent runtime improvements** → Inherited since DeXMart calls `runEmbeddedPiAgent()` directly.

**If DeXMart duplicates upstream logic, this guarantee is broken.** The duplicated code will NOT receive upstream fixes and will drift, eventually becoming a maintenance burden and a source of bugs.

---

## 4. Enforcement

This policy is enforced at every layer of the project:

| Layer               | File                                       | What it enforces                                                 |
| ------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| Root agent config   | `CLAUDE.md`                                | Agent instructions reference this policy                         |
| Root agent config   | `AGENTS.md`                                | DeXMart Fusion Policy section                                    |
| Docs rules          | `docs/PROJECT_RULES.md`                    | §0.1 Upstream Leverage Mandate, §0.2 Exclusive Feature Embedding |
| Fusion plan         | `docs/TrueFusionPlan.md`                   | Non-negotiable rules #7, #8                                      |
| Architecture        | `docs/architecture/FUSION_STRATEGY.md`     | Section 9: Upstream Leverage & Feature Embedding                 |
| Docs agent          | `docs/AGENTS.md`                           | Fusion Strategy Compliance rule                                  |
| Conductor workflow  | `conductor/workflow.md`                    | Guiding Principles 7, 8                                          |
| Product guidelines  | `conductor/product-guidelines.md`          | First principles listed                                          |
| Upstream sync track | `conductor/tracks/openclaw_sync_20260415/` | Fusion Guardrails section                                        |
| Agent core policy   | `.agent/rules/core_policy.md`              | Section 6: Enforcement                                           |
| Agent governance    | `.agent/rules/project_governance.md`       | Violation: duplicating upstream                                  |
| Agent workflow      | `.agent/workflows/PROJECT_RULES.md`        | Principles in workflow rules                                     |

---

## 5. Violations

The following are **Severe Violations** of this policy:

1. **Reimplementing upstream logic** — Creating a new service/utility/helper that duplicates what OpenClaw already provides.
2. **Creating bridges/wrappers** — Wrapping an upstream module instead of importing and using it directly.
3. **Forking upstream files** — Copying an upstream file and modifying it instead of injecting at the defined injection points.
4. **Treating exclusives as secondary** — Building a DeXMart-exclusive feature as a plugin, sidecar, or separate package instead of embedding it natively in `src/`.
5. **Ignoring the anti-duplication checklist** — Proceeding with implementation without first verifying no upstream equivalent exists.

**Remediation**: If a violation is discovered, the duplicated/bridged/forked code must be replaced with the upstream equivalent or the exclusive feature must be re-embedded natively. This is not optional — it is a blocking issue.
