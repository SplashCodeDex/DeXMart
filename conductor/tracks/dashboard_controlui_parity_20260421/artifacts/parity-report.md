# ControlUI → DeXMart Parity Matrix Report

Generated from parity-matrix.json. Do NOT hand-edit — rerun `pnpm tsx scripts/controlui-parity-discover.ts`.

## Summary

- **rpc_method_count**: 119
- **rpc_domain_count**: 28
- **controlui_view_count**: 58
- **controlui_controller_count**: 28
- **dexmart_route_count**: 21
- **dexmart_feature_count**: 18
- **parity_feature_count**: 22
- **coverage_pct**: 82

## Parity Matrix

| Feature ID | Label | Strategy | Status | DeXMart Route | ControlUI Views | RPC Methods |
|---|---|---|---|---|---|---|
| chat | Mastermind Chat | add | complete | /chat | 1 view(s) | 4 methods |
| channels | Channels + QR Login | weave | partial | /dashboard/omnichannel | 13 view(s) | 4 methods |
| agents | Agents CRUD + Files + Identity | enhance | complete | /dashboard/agents | 6 view(s) | 10 methods |
| sessions | Sessions List + Detail + Compaction | implement | complete | /dashboard/sessions | 1 view(s) | 23 methods |
| config | Configuration Panel | enhance | partial | /dashboard/config | 6 view(s) | 8 methods |
| cron | Cron Jobs | enhance | complete | /dashboard/cron | 1 view(s) | 8 methods |
| skills | Skills + Plugins | enhance | complete | /dashboard/skills | 3 view(s) | 9 methods |
| nodes | Nodes + Canvas + Pending Queue | enhance | partial | /dashboard/nodes | 4 view(s) | 15 methods |
| devices | Device Pairing + Tokens | weave | partial | /dashboard/nodes | 4 view(s) | 6 methods |
| logs | Live Logs Viewer | implement | missing | — | 1 view(s) | 1 methods |
| debug | Debug / Developer Panel | add | missing | — | 1 view(s) | 5 methods |
| dreaming | Doctor / Memory (Dream) | weave | stub | /dashboard/agents | 1 view(s) | 3 methods |
| tts | TTS / Voice Settings | weave | stub | /dashboard/config | — | 10 methods |
| instances | Instances + Presence | weave | stub | /dashboard/home | 1 view(s) | 0 methods |
| setup-wizard | First-Run Setup Wizard | add | missing | — | — | 4 methods |
| usage | Usage Time-Series + Cost | enhance | stub | /dashboard/usage | 5 view(s) | 5 methods |
| exec-approvals | Exec Approvals Allowlist | weave | stub | /dashboard/config | 2 view(s) | 8 methods |
| update-runner | Update Runner | weave | stub | /dashboard/config | — | 1 methods |
| overview | Home / Overview Cards | enhance | stub | /dashboard/home | 6 view(s) | 0 methods |
| command-palette | Command Palette | add | missing | — | 1 view(s) | 1 methods |
| message-actions | Message Actions (react/edit/delete) | weave | stub | /dashboard/messages | — | 1 methods |
| connect-gate | Connect / Gateway URL / Login Gate | subtract | complete | — | 3 view(s) | 0 methods |

## Gaps

### Unmapped RPC Methods (0)

Present in Gateway, not linked to any parity feature. Either add to a feature seed or mark internal.

_(none)_

### Views Without Parity Target (3)

- ui/src/ui/views/channel-config-extras.ts
- ui/src/ui/views/markdown-sidebar.ts
- ui/src/ui/views/usageTypes.ts

### DeXMart Routes Without ControlUI Parent (10)

DeXMart-exclusive surfaces. Confirm each matches PROJECT_RULES §0.2 embedding rules.

- /dashboard/billing
- /dashboard/contacts
- /dashboard/flows
- /dashboard/messages/campaigns/[id]
- /dashboard/omnichannel/reasoning
- /dashboard/sessions/[id]
- /dashboard/settings
- /dashboard/templates
- /dashboard/webhooks
- /settings
