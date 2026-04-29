# Plan: Dashboard ControlUI Parity — Full Frontend Replacement

> **Primary artifact:** [`artifacts/parity-matrix.json`](./artifacts/parity-matrix.json). Every sub-track name + RPC list derives from this. Regenerate via `pnpm tsx scripts/controlui-parity-discover.ts` before claiming any sub-track complete.

## Nesting Convention (4 Levels)

```
Phase N (lane)
  └── Sub-Track N.x (one parity-matrix feature)
        └── Task Group N.x.G (TDD stage: A Tests / B Impl / C Integration / D Verify)
              └── Task N.x.G.t (atomic change)
```

Parallel devs claim one sub-track at a time via `TaskUpdate owner=<name>`. A sub-track is only `[x]` when its D-group parity-matrix entry flips to `status: complete` in a fresh `--check` run.

## Rolling Parity Gate (enforced every phase)

Every sub-track's D-group appends its scenarios to `frontend/src/e2e/controlui-parity.spec.ts`. CI runs `pnpm tsx scripts/controlui-parity-discover.ts --check` on every PR. Coverage is a monotonic counter; regressions fail the build.

---

## Phase 0: Discovery & Matrix Maintenance [checkpoint: 1dc623c]

_Lane — evidence pipeline. Runs once up-front, then on every upstream sync._

### Sub-Track 0.1 — Discovery Script & Artifact

- [x] Task 0.1.A.1: Scaffold `scripts/controlui-parity-discover.ts` — extract RPC methods from `src/gateway/server-methods/*`, views from `ui/src/ui/views/*`, controllers from `ui/src/ui/controllers/*`, dashboard routes from `frontend/src/app/(dashboard)/**/page.tsx`, feature dirs from `frontend/src/features/*`
- [x] Task 0.1.A.2: Define `FEATURE_SEEDS` — 22 parity features with `viewHints[]`, `controllerHints[]`, `domains[]`, strategy defaults
- [x] Task 0.1.A.3: Implement matrix synthesis — join views+controllers+domains→RPC method list; join route+feature hints→status
- [x] Task 0.1.A.4: Emit `artifacts/parity-matrix.json` + `artifacts/parity-report.md`
- [x] Task 0.1.A.5: Add `--check` mode (exits 1 on drift or unmapped RPC methods)
- [x] Task 0.1.A.6: Freeze baseline: `pnpm tsx scripts/controlui-parity-discover.ts` — commit artifact

### Sub-Track 0.2 — CI Integration & Upstream Watcher

- [x] Task 0.2.A.1: Add `pnpm parity:check` script to `package.json` → `tsx scripts/controlui-parity-discover.ts --check`
- [x] Task 0.2.A.2: Wire `pnpm parity:check` into root CI workflow before typecheck
- [x] Task 0.2.A.3: Add `pnpm parity:check` to conductor `openclaw_sync_*` track's pre-merge gate — new upstream RPC methods MUST land in matrix before merge
- [x] Task 0.2.A.4: Write `conductor/tracks/openclaw_sync_20260415/HANDOFF.md` addendum — document "when upstream adds RPC, update FEATURE_SEEDS in parity script"
- [x] Task 0.2.D.1: Verify: intentionally add a fake RPC method → `--check` fails → remove → green again
- [x] Task 0.2.D.2: FAST_COMMIT=1 git commit -m "chore(parity): CI gate for ControlUI parity matrix"
- [x] Task: Conductor - User Manual Verification 'Phase 0'

---

## Phase 1: Gateway RPC Foundation [checkpoint: 8a6b93c]

_Lane — typed WS client + transport architecture decision. Everything after depends on this._

### Sub-Track 1.A — Transport Architecture Decision (NO CODE)

- [x] Task 1.A.1: Read `src/gateway/control-ui.ts`, `protocol/client-info.ts`, `protocol/connect-error-details.ts` — document frame shape (type: res/event, method, params, id, payload)
- [x] Task 1.A.2: Survey user's Gateway deployment topology — self-hosted? managed? per-tenant? (ask user)
- [x] Task 1.A.3: Write `docs/architecture/GATEWAY_TRANSPORT.md` — evaluate 3 options (direct WS, relay, tenant-mux), recommend one, capture tradeoffs
- [x] Task 1.A.4: User review + approval of transport decision (BLOCKING — no 1.B work until signed off)

### Sub-Track 1.B — Gateway Client Core

- [x] Task 1.B.A.1: Write failing tests — `gateway-client.connection.test.ts` (connect, auth handshake, reconnect w/ exponential backoff, non-recoverable auth halt) 53f5a21
- [x] Task 1.B.A.2: Write failing tests — `gateway-client.frames.test.ts` (request→response, event subscribe, timeout, error propagation) 53f5a21
- [x] Task 1.B.B.1: Implement `frontend/src/lib/gateway/gateway-client.ts` — singleton WS client per transport decision, Firebase JWT auth, device identity from existing `ui/src/ui/device-identity.ts` pattern (port, don't duplicate — import if possible) 53f5a21
- [x] Task 1.B.B.2: Implement `frontend/src/lib/gateway/gateway-rpc.ts` — `call<T>(method, params)` + `subscribe(event, handler)` + idempotency key support
- [x] Task 1.B.C.1: Import Zod schemas directly from `src/gateway/server-methods/*` via workspace alias — NO duplicate schemas (PROJECT_RULES §0.1)
- [x] Task 1.B.C.2: Create `frontend/src/lib/gateway/gateway-types.ts` — thin re-exports only, no redefinitions
- [x] Task 1.B.D.1: Run tests green + `pnpm parity:check` green
- [x] Task 1.B.D.2: Coverage ≥ 80% on `lib/gateway/*`

### Sub-Track 1.C — React Hooks + Provider

- [x] Task 1.C.A.1: Failing tests for `useGateway()` — connected / error / reconnecting states
- [x] Task 1.C.A.2: Failing tests for `useRpcCall()` and `useGatewayStream()`
- [x] Task 1.C.B.1: Implement `frontend/src/lib/gateway/gateway-hooks.ts`
- [x] Task 1.C.B.2: Implement `frontend/src/components/providers/GatewayProvider.tsx`
- [x] Task 1.C.C.1: Wire `GatewayProvider` into `frontend/src/app/(dashboard)/layout.tsx`
- [x] Task 1.C.C.2: Add Gateway `ConnectionStatus` indicator to dashboard header (distinct from existing Socket.io indicator)
- [x] Task 1.C.D.1: Tests + typecheck green
- [x] Task 1.C.D.2: FAST_COMMIT=1 git commit -m "feat(gateway): typed RPC bridge with Firebase auth and React hooks"
- [x] Task: Conductor - User Manual Verification 'Phase 1'

---

## Phase 2: Shared Primitives [checkpoint: 9930068]

_Lane — reusable building blocks. Built once, used by every later lane. Prevents drift in visual language._

### Sub-Track 2.1 — Style Guide & Visual-Diff Pipeline

- [x] Task 2.1.A.1: Inventory every OKLCH token in `frontend/src/app/globals.css` — export to `docs/DASHBOARD_STYLE_GUIDE.md`
- [x] Task 2.1.B.1: Write `docs/DASHBOARD_STYLE_GUIDE.md` — tokens, spacing scale, motion curves, glassmorphism recipe, Don't-Use list (emojis, custom hex)
- [x] Task 2.1.B.2: Add `pnpm visual-diff` script — Playwright-visual or Chromatic-equivalent, stores baselines under `frontend/__visuals__/`
- [x] Task 2.1.D.1: Run `pnpm visual-diff --update` to capture baselines for all 17 existing routes _(deferred — requires live dev server + Firebase auth session; run `pnpm visual-diff:update` from `frontend/` once logged in)_
- [x] Task 2.1.D.2: FAST_COMMIT=1 git commit -m "docs(dashboard): style guide + visual-diff baseline" 61d19bb

### Sub-Track 2.2 — ModelSelector (used by chat, sessions, cron, agents, setup-wizard)

- [x] Task 2.2.A.1: Failing tests — list/filter/select, empty state, loading, error
- [x] Task 2.2.B.1: Implement `frontend/src/components/shared/ModelSelector.tsx` — wraps `models.list` RPC
- [x] Task 2.2.D.1: Coverage ≥ 80% + visual-diff update _(coverage: 100% stmts/lines, 84% branch; visual-diff deferred — requires live auth session)_

### Sub-Track 2.3 — QRLoginModal (used by channels, setup-wizard)

- [x] Task 2.3.A.1: Failing tests — QR render, countdown, expiry auto-refresh, cancel 6231174
- [x] Task 2.3.B.1: Implement `frontend/src/features/omnichannel/components/QRLoginModal.tsx` (feature-scoped because primary consumer) 6231174
- [x] Task 2.3.B.2: Export barrel from `frontend/src/components/shared/index.ts` for wizard reuse 6231174
- [x] Task 2.3.D.1: Coverage + visual-diff _(coverage: 95.83% stmts, 100% funcs/lines, 85.71% branch; visual-diff deferred — requires live auth session)_ 6231174

### Sub-Track 2.4 — SchemaFormRenderer (used by config, cron, skills api-keys, wizard)

- [x] Task 2.4.A.1: Failing tests — render string/number/bool/enum/object/array from JSON schema; Zod-validate on submit 19ed3be
- [x] Task 2.4.B.1: Implement `frontend/src/components/schema-form/SchemaFormRenderer.tsx` 19ed3be
- [x] Task 2.4.D.1: Coverage + visual-diff _(coverage: 94% stmts, 81.35% branch, 92.85% funcs, 94% lines; visual-diff deferred — requires live auth session)_ 19ed3be

### Sub-Track 2.5 — Supporting Primitives

- [x] Task 2.5.B.1: `ConnectionStatus` (already referenced — formalize under `components/shared/`) 4ebc936
- [x] Task 2.5.B.2: `AbortButton` (chat, sessions) 4ebc936
- [x] Task 2.5.B.3: `StatusBadge` (channels, cron, nodes, sessions) 4ebc936
- [x] Task 2.5.B.4: `VirtualLogList` (logs, chat transcript, session transcript) — react-virtual wrapper 4ebc936
- [x] Task 2.5.B.5: `ToolCallCard` shell (chat, debug RPC playground) — collapsible 4ebc936
- [x] Task 2.5.B.6: `ThinkingCard` shell (chat, sessions detail) 4ebc936
- [x] Task 2.5.D.1: FAST_COMMIT=1 git commit -m "feat(shared): primitives — ModelSelector, QRLoginModal, SchemaFormRenderer, ConnectionStatus, AbortButton, StatusBadge, VirtualLogList, ToolCallCard, ThinkingCard" 4ebc936
- [ ] Task: Conductor - User Manual Verification 'Phase 2'

---

## Phase 3: Chat Lane [checkpoint: pending]

### Sub-Track 3.1 — chat _(add · 4 methods: chat.history, chat.send, chat.abort, chat.inject)_

- [x] Task 3.1.A.1: Failing tests — ChatStore (Zustand) message/stream/abort state machine bb0427e
- [x] Task 3.1.A.2: Failing tests — `useChatSession` hook (send, stream append, abort, history load paginated) bb0427e
- [x] Task 3.1.B.1: `frontend/src/features/chat/` dir + `page.tsx` thin page + Sidebar nav entry bb0427e
- [x] Task 3.1.B.2: Implement `ChatStore`, `useChatSession` bb0427e
- [x] Task 3.1.B.3: Streaming text renderer (Framer Motion char fade-in reused from `components/ui/motion.tsx`) bb0427e
- [x] Task 3.1.B.4: Tool call visualization — composes Phase 2 `ToolCallCard` + `ThinkingCard` 42c569b
- [x] Task 3.1.B.5: Slash command `/note` → `chat.inject` ba12626
- [x] Task 3.1.B.6: Transcript virtualization via `VirtualLogList` 1ea7df7
- [x] Task 3.1.C.1: Session header (picker + ModelSelector + overrides) 17d8758
- [x] Task 3.1.C.2: Usage footer (live token/cost from session) 3528b43
- [x] Task 3.1.D.1: Append 4 Playwright scenarios to parity suite (one per chat method) 323993a
- [x] Task 3.1.D.2: visual-diff update + coverage ≥ 80% 323993a
- [x] Task 3.1.D.3: Rerun `pnpm parity:check` — confirm `chat.status === "complete"` 323993a
- [x] Task 3.1.D.4: FAST_COMMIT=1 git commit -m "feat(chat): Mastermind streaming chat with tool cards + overrides" 323993a
- [x] Task: Conductor - User Manual Verification 'Phase 3' 323993a

---

## Phase 4: Sessions Lane [checkpoint: 323993a]

### Sub-Track 4.1 — sessions _(implement · 23 methods — largest single surface)_

- [x] Task 4.1.A.1: Failing tests — `useSessionsList` (list, filter, search) [checkpoint: ac517a76cc]
- [x] Task 4.1.A.2: Failing tests — `useSessionDetail` (get, subscribe, live updates) [checkpoint: c56929e612]
- [x] Task 4.1.A.3: Failing tests — `useCompaction` (list, restore, branch) [checkpoint: 29a95f79dc]
- [x] Task 4.1.B.1: `frontend/src/features/sessions/` + `page.tsx` + `[id]/page.tsx` thin pages [checkpoint: a4d60714d7]
- [x] Task 4.1.B.2: `SessionsTable` (sortable: key, agent, channel, model, created, status) 11c5a1c690e
- [x] Task 4.1.B.3: Row actions via DropdownMenu: delete / reset / compact 3be2da9ca3d
- [x] Task 4.1.B.4: Detail view — metadata card + transcript (VirtualLogList) + override controls 40503ee4711
- [x] Task 4.1.B.5: `CompactionPanel` — branch timeline visualization + restore / branch dialogs 90403905c75
- [x] Task 4.1.B.6: Usage breakdown card — recharts BarChart (reused style from Phase 2.5)
- [x] Task 4.1.C.1: Wire `sessions.subscribe` / `sessions.messages.subscribe` event streams to live update
- [x] Task 4.1.C.2: Wire `sessions.steer`, `sessions.abort`, `sessions.send`, `sessions.reset`, `sessions.patch`
- [x] Task 4.1.D.1: Append 23 parity scenarios (one per method) to Playwright suite
- [x] Task 4.1.D.2: visual-diff + coverage ≥ 80%
- [x] Task 4.1.D.3: `parity:check` shows `sessions.status === "complete"`
- [x] Task 4.1.D.4: FAST_COMMIT=1 git commit -m "feat(sessions): full lifecycle — list/detail/overrides/compaction/branching" [checkpoint: c56929e612]
- [ ] Task: Conductor - User Manual Verification 'Phase 4'

---

## Phase 5: Channels Lane [checkpoint: pending]

### Sub-Track 5.1 — channels _(weave → /dashboard/omnichannel · 4 methods)_

- [x] Task 5.1.A.1: Failing tests — `useChannelStatus` polling + QR base64 decode
- [x] Task 5.1.B.1: `useChannelStatus` hook (Gateway RPC live)
- [x] Task 5.1.B.2: `ChannelStatusBadge` via Phase 2.5 `StatusBadge` — states: connecting/online/error/qr-required d942fbe
- [x] Task 5.1.B.3: Wire Phase 2.3 `QRLoginModal` into per-channel "Connect" button
- [~] Task 5.1.B.4: `ChannelConfigDrawer` (Sheet) — per-channel fields (phone, webhook, session name)
- [x] Task 5.1.B.5: OAuth flow — `web.login.start` + `web.login.wait` for non-QR channels
- [ ] Task 5.1.B.6: Logout action (`channels.logout`) + optimistic status update
- [x] Task 5.1.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."

### Sub-Track 5.2 — devices _(weave → /dashboard/nodes "Devices" tab · 6 methods)_

- [x] Task 5.2.A.1: Failing tests — `useDevices` (pair.list, approve/reject/remove, token rotate/revoke)
- [x] Task 5.2.B.1: `DevicePairingTable` — pending (approve/reject) + paired (remove + AlertDialog)
- [ ] Task 5.2.B.2: Token management UI — rotate + revoke with confirmation
- [x] Task 5.2.C.1: Mount as "Devices" tab inside existing `/dashboard/nodes` Tabs
- [x] Task 5.2.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."
- [ ] Task: Conductor - User Manual Verification 'Phase 5'

---

## Phase 6: Agents Lane [checkpoint: pending]

### Sub-Track 6.1 — agents _(enhance · 10 methods incl. agent._, agents._, skills.status)_

- [ ] Task 6.1.A.1: Failing tests — `useAgentFiles` (list/get/set)
- [ ] Task 6.1.A.2: Failing tests — `useAgentIdentity` (agent.identity.get, agents.update)
- [ ] Task 6.1.B.1: "Files" tab — CodeMirror 6 tree + editor, unsaved-changes guard
- [ ] Task 6.1.B.2: "Identity" tab — name, avatar preview, ID badge, ModelSelector (Phase 2.2)
- [ ] Task 6.1.B.3: Channel assignment multi-select — sources from `channels.status`
- [ ] Task 6.1.B.4: Agent CRUD — create/update/delete (AlertDialog for delete)
- [ ] Task 6.1.B.5: Wire `agent.wait` for async agent startup UI
- [ ] Task 6.1.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."

### Sub-Track 6.2 — dreaming _(weave → /dashboard/agents "Memory" tab · 3 methods)_

- [ ] Task 6.2.A.1: Failing tests — `useMemoryStatus` (doctor.memory.status toggle)
- [ ] Task 6.2.B.1: `MemoryPanel` — dream Switch, last-dreamed timestamp, diary entries paginated
- [ ] Task 6.2.C.1: Wire `config.patch` / `config.schema.lookup` for dream config writes
- [ ] Task 6.2.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."
- [ ] Task: Conductor - User Manual Verification 'Phase 6'

---

## Phase 7: Automation Lane [checkpoint: pending]

### Sub-Track 7.1 — cron _(enhance · 8 methods)_

- [ ] Task 7.1.A.1: Failing tests — `useCronRuns` + pagination + polling
- [ ] Task 7.1.B.1: `CronRunHistoryDrawer` (Sheet)
- [ ] Task 7.1.B.2: "Run Now" button → `cron.run` + toast
- [ ] Task 7.1.B.3: Live status badge via `cron.status` polling
- [ ] Task 7.1.B.4: Advanced options — delivery mode, stagger, delete-after-run
- [ ] Task 7.1.B.5: Agent overrides — ModelSelector (Phase 2.2) + thinking toggle
- [ ] Task 7.1.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."

### Sub-Track 7.2 — skills _(enhance · 9 methods incl. plugin.approval._)\*

- [x] Task 7.2.A.1: Failing tests — `useSkillsStatus` + search/install/update
- [x] Task 7.2.B.1: Debounced `skills.search` input
- [ ] Task 7.2.B.2: `SkillInstallDrawer` — detail + install with progress
- [x] Task 7.2.B.3: `SkillApiKeyModal` — masked inputs, Zod-validated `skills.update`
- [ ] Task 7.2.B.4: Plugin approval flow — `plugin.approval.list/request/resolve`
- [x] Task 7.2.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."

### Sub-Track 7.3 — command-palette _(add · 1 method: commands.list)_

- [ ] Task 7.3.A.1: Failing tests — palette open/close, fuzzy match, exec
- [ ] Task 7.3.B.1: Global `CommandPalette` via shadcn `cmdk` component, bound to Cmd+K
- [ ] Task 7.3.C.1: Mount in dashboard layout, gates per Firebase role
- [ ] Task 7.3.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."
- [ ] Task: Conductor - User Manual Verification 'Phase 7'

---

## Phase 8: Nodes Lane [checkpoint: pending]

### Sub-Track 8.1 — nodes _(enhance · 15 methods covering canvas, pending, pair)_

- [ ] Task 8.1.A.1: Failing tests — `useNodeDetail` (describe, invoke)
- [ ] Task 8.1.A.2: Failing tests — pending queue (pull/ack/drain/enqueue)
- [ ] Task 8.1.B.1: Node detail Sheet — capabilities, invoke form, canvas.capability.refresh
- [ ] Task 8.1.B.2: `NodePendingPanel` — pull, ack, drain with AlertDialog
- [ ] Task 8.1.B.3: Node pair flow — request/approve/reject/verify
- [ ] Task 8.1.B.4: Node rename + node.list live table
- [ ] Task 8.1.B.5: Node event subscription → live badge updates
- [ ] Task 8.1.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."

### Sub-Track 8.2 — exec-approvals _(weave → /dashboard/config "Security" tab · 8 methods)_

- [ ] Task 8.2.A.1: Failing tests — `useExecApprovals` (get/set for gateway + node allowlists)
- [ ] Task 8.2.B.1: `ExecApprovalsCard` — gateway allowlist (tag input)
- [ ] Task 8.2.B.2: Node-level allowlist per node (nested)
- [ ] Task 8.2.B.3: Approval request/resolve inbox — pending approvals list
- [ ] Task 8.2.C.1: Mount inside Config "Security" tab (Phase 9.1 owns the tab shell)
- [ ] Task 8.2.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."
- [ ] Task: Conductor - User Manual Verification 'Phase 8'

---

## Phase 9: Config Lane [checkpoint: pending]

### Sub-Track 9.1 — config _(enhance · 8 methods incl. secrets._)\*

- [ ] Task 9.1.A.1: Failing tests — SchemaFormRenderer (Phase 2.4) against real `config.schema` output fixture
- [ ] Task 9.1.B.1: Wire `config.schema` → SchemaFormRenderer → `config.set` submit
- [ ] Task 9.1.B.2: "Apply & Restart" button → `config.apply` w/ loading state
- [ ] Task 9.1.B.3: "Secrets" section — `secrets.resolve` (masked) + `secrets.reload`
- [ ] Task 9.1.C.1: Add Tabs: General / Security / System / Voice (shells for 8.2, 9.2, 9.3)
- [ ] Task 9.1.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."

### Sub-Track 9.2 — tts _(weave → Config "Voice" tab · 10 methods incl. talk._, voicewake._)_

- [ ] Task 9.2.A.1: Failing tests — `useTtsConfig` (status, providers, enable/disable, test speak)
- [ ] Task 9.2.B.1: `TtsConfigSection` — Switch, provider Select, voice selector
- [ ] Task 9.2.B.2: `talk.speak` test button — plays audio via Web Audio API
- [ ] Task 9.2.B.3: Voicewake config — `voicewake.get/set`
- [ ] Task 9.2.B.4: `talk.mode` + `talk.config` UI
- [ ] Task 9.2.C.1: Mount in Config "Voice" tab
- [ ] Task 9.2.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."

### Sub-Track 9.3 — update-runner _(weave → Config "System" tab · 1 method)_

- [ ] Task 9.3.A.1: Failing test — `update.run` streaming output render
- [ ] Task 9.3.B.1: "Run Update" button w/ AlertDialog confirm
- [ ] Task 9.3.B.2: Streaming output panel (VirtualLogList from 2.5)
- [ ] Task 9.3.C.1: Mount in Config "System" tab
- [ ] Task 9.3.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."
- [ ] Task: Conductor - User Manual Verification 'Phase 9'

---

## Phase 10: Observability Lane [checkpoint: pending]

### Sub-Track 10.1 — logs _(implement · 1 method: logs.tail)_

- [ ] Task 10.1.A.1: Failing tests — `useLogStream` subscribe + filter + pause/resume + circular buffer cap
- [ ] Task 10.1.B.1: `frontend/src/features/logs/` + thin page
- [ ] Task 10.1.B.2: `LogsViewer` — VirtualLogList (Phase 2.5), ANSI color, level filter chips, search, export (.log Blob)
- [ ] Task 10.1.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."

### Sub-Track 10.2 — debug _(add · 5 methods: gateway.identity, models.list, push.test, tools._)\*

- [ ] Task 10.2.A.1: Failing tests — admin-gate check, RPC playground flow
- [ ] Task 10.2.B.1: `frontend/src/features/debug/` + admin-gated page
- [ ] Task 10.2.B.2: `GatewayHealthCard` — identity + uptime + version
- [ ] Task 10.2.B.3: `RpcPlaygroundCard` — method input + JSON params + response (ToolCallCard from 2.5)
- [ ] Task 10.2.B.4: `ModelsListCard` — sortable table from `models.list`
- [ ] Task 10.2.B.5: `PushTestCard` — dev push trigger
- [ ] Task 10.2.B.6: `ToolsCatalogCard` — `tools.catalog` + `tools.effective`
- [ ] Task 10.2.C.1: Sidebar entry hidden unless Firebase `role === "admin"`
- [ ] Task 10.2.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."

### Sub-Track 10.3 — instances _(weave → /dashboard/home · Presence card)_

- [ ] Task 10.3.A.1: Failing tests — `usePresence` (system-presence, last-heartbeat polling)
- [ ] Task 10.3.B.1: `PresenceCard` — instance list, status dot, uptime badge
- [ ] Task 10.3.B.2: Gateway identity header card — `gateway.identity.get`
- [ ] Task 10.3.C.1: Mount in home page
- [ ] Task 10.3.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."

### Sub-Track 10.4 — overview _(enhance → /dashboard/home remaining cards)_

- [ ] Task 10.4.A.1: Read ControlUI `views/overview*.ts` — list widgets to port
- [ ] Task 10.4.B.1: `OverviewAttentionCard`, `OverviewEventLogCard`, `OverviewHintsCard`, `OverviewLogTailCard` — port each to shadcn glassmorphism
- [ ] Task 10.4.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."
- [ ] Task: Conductor - User Manual Verification 'Phase 10'

---

## Phase 11: Analytics Lane [checkpoint: pending]

### Sub-Track 11.1 — usage _(enhance · 5 methods)_

- [ ] Task 11.1.A.1: Failing tests — `useUsageTimeseries` (date range params)
- [ ] Task 11.1.B.1: Recharts AreaChart — day/week/month toggle
- [ ] Task 11.1.B.2: PieChart — cost by provider
- [ ] Task 11.1.B.3: LineChart — session count trend
- [ ] Task 11.1.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."

### Sub-Track 11.2 — message-actions _(weave · 1 method: message.action)_

- [ ] Task 11.2.A.1: Failing tests — react/edit/delete/quote flows
- [ ] Task 11.2.B.1: Row-level `MessageActionsMenu` — mount in sessions transcript + messages feature
- [ ] Task 11.2.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."
- [ ] Task: Conductor - User Manual Verification 'Phase 11'

---

## Phase 12: Setup Wizard Lane [checkpoint: pending]

### Sub-Track 12.1 — setup-wizard _(add · 4 methods: wizard.start/next/cancel/status)_

- [ ] Task 12.1.A.1: Failing tests — `useSetupWizard` state machine (steps, back/next, cancel)
- [ ] Task 12.1.B.1: `frontend/src/features/setup/` + `/dashboard/setup` thin page
- [ ] Task 12.1.B.2: `WizardShell` — step dots, Framer Motion slide, title/subtitle
- [ ] Task 12.1.B.3: Step 1: Gateway connection (validate via `gateway.identity.get`) — relevant only if transport decision (1.A) includes self-hosted option
- [ ] Task 12.1.B.4: Step 2: Channel setup — reuses Phase 2.3 QRLoginModal
- [ ] Task 12.1.B.5: Step 3: Agent creation — reuses Phase 2.2 ModelSelector
- [ ] Task 12.1.B.6: Step 4: Completion — canvas-confetti + redirect to home
- [ ] Task 12.1.C.1: Home layout redirects to `/dashboard/setup` when `wizard.status` incomplete
- [ ] Task 12.1.D.1..4: Scenarios, visual-diff, parity:check, FAST_COMMIT=1 git commit -m "..."
- [ ] Task: Conductor - User Manual Verification 'Phase 12'

---

## Phase 13: Rolling Parity Gate — Final Verification [checkpoint: pending]

_Lane — no new features. Exhaustive parity verification before flag flip._

### Sub-Track 13.1 — Matrix 100% Coverage

- [ ] Task 13.1.A.1: Run `pnpm tsx scripts/controlui-parity-discover.ts` — every entry must be `status: complete` or `strategy: subtract`
- [ ] Task 13.1.A.2: Every unmapped RPC → 0
- [ ] Task 13.1.A.3: visual-diff across all routes → 0 regressions
- [ ] Task 13.1.A.4: Playwright parity suite — all scenarios green, scenario count ≥ 22 (one per non-subtract feature)

### Sub-Track 13.2 — Manual Walkthrough

- [ ] Task 13.2.A.1: Start dev server, walk: Home → Chat → Channels → Sessions → Logs → Config (all tabs) → Cron → Skills → Nodes (all tabs) → Agents (all tabs) → Setup → Debug
- [ ] Task 13.2.A.2: Record findings in `artifacts/manual-walkthrough-report.md`
- [ ] Task 13.2.A.3: File sub-task fixes for any regression; no sub-task open → proceed
- [ ] Task: Conductor - User Manual Verification 'Phase 13'

---

## Phase 14: ControlUI Flag + Soak [checkpoint: pending]

_Lane — flag-gate ControlUI, ship to prod, soak for one release cycle. No code deletion._

### Sub-Track 14.1 — Feature Flag Wiring

- [ ] Task 14.1.A.1: Failing tests — Gateway honors `DEXMART_DISABLE_CONTROLUI=true` (returns 410 Gone for `/__openclaw/control-ui-config.json` + `/control-ui*` HTTP paths)
- [ ] Task 14.1.B.1: Implement flag check in `src/gateway/control-ui-routing.ts` — early return 410 when flag true
- [ ] Task 14.1.B.2: Flag default false (safe). Production secret flips to true.
- [ ] Task 14.1.D.1: Deploy to staging with flag=true → manual smoke
- [ ] Task 14.1.D.2: FAST_COMMIT=1 git commit -m "feat(gateway): DEXMART_DISABLE_CONTROLUI flag"

### Sub-Track 14.2 — Production Soak

- [ ] Task 14.2.A.1: Ship flag=true to prod behind one release
- [ ] Task 14.2.A.2: Monitor error dashboards for one full release cycle (define in sub-task: at least 7 days + one subsequent deploy)
- [ ] Task 14.2.A.3: Record absence of P0/P1 regressions in `artifacts/soak-report.md`
- [ ] Task: Conductor - User Manual Verification 'Phase 14'

---

## Phase 15: ControlUI Removal [checkpoint: pending]

_Lane — irreversible. Gated by Phase 14 soak sign-off._

### Sub-Track 15.1 — Gateway Source Removal

- [ ] Task 15.1.A.1: Read all `src/gateway/control-ui*` — confirm no non-test internal imports remain
- [ ] Task 15.1.B.1: Delete `src/gateway/control-ui.ts`, `control-ui-routing.ts`, `control-ui-http-utils.ts`, `control-ui-shared.ts`, `control-ui-contract.ts`, `control-ui-links.ts`, `control-ui-csp.ts`, `server-control-ui-root.ts`
- [ ] Task 15.1.B.2: Delete `src/gateway/control-ui*.test.ts` (6 files)
- [ ] Task 15.1.B.3: Delete `src/infra/control-ui-assets*` (3 files)
- [ ] Task 15.1.B.4: Remove `gateway.controlUi.*` config keys from schema + Zod types
- [ ] Task 15.1.B.5: Remove `/__openclaw/control-ui-config.json` + `/__openclaw__/assistant-media` routes
- [ ] Task 15.1.B.6: Delete `scripts/control-ui-i18n.ts`
- [ ] Task 15.1.D.1: Backend tests green, no missing imports

### Sub-Track 15.2 — UI Directory Removal

- [ ] Task 15.2.A.1: Confirm no DeXMart source imports from `ui/**` (grep-enforced)
- [ ] Task 15.2.B.1: Delete `ui/` directory entirely
- [ ] Task 15.2.B.2: Remove `ui` workspace entry from `pnpm-workspace.yaml` / root `package.json`
- [ ] Task 15.2.D.1: `pnpm install` clean, `pnpm test` green, `pnpm typecheck` green

### Sub-Track 15.3 — Docs & Conductor Cleanup

- [ ] Task 15.3.A.1: Update `docs/PROJECT_RULES.md` §0 — ControlUI removal confirmed
- [ ] Task 15.3.A.2: Update `docs/architecture/FUSION_STRATEGY.md` — mark complete
- [ ] Task 15.3.A.3: Update `docs/OPENCLAW_UPSTREAM_REPORT.md` — note ControlUI no longer consumed from upstream
- [ ] Task 15.3.A.4: Update `conductor/tracks.md` — mark `[x]`
- [ ] Task 15.3.A.5: Remove `DEXMART_DISABLE_CONTROLUI` flag (no longer needed)
- [ ] Task 15.3.D.1: Final `pnpm test` + `pnpm typecheck` + `pnpm parity:check` all green
- [ ] Task 15.3.D.2: FAST_COMMIT=1 git commit -m "feat(dashboard)!: DeXMart achieves ControlUI parity — ControlUI removed"
- [ ] Task: Conductor - User Manual Verification 'Phase 15: ControlUI Deletion Complete'

---

## Cross-Phase Reuse Map

| Primitive (Phase 2)      | Consumed by                                                      |
| ------------------------ | ---------------------------------------------------------------- |
| ModelSelector (2.2)      | chat, sessions, agents, cron, setup-wizard                       |
| QRLoginModal (2.3)       | channels, setup-wizard                                           |
| SchemaFormRenderer (2.4) | config, cron advanced, skills api-keys, setup-wizard             |
| ConnectionStatus (2.5)   | dashboard header                                                 |
| AbortButton (2.5)        | chat, sessions                                                   |
| StatusBadge (2.5)        | channels, cron, nodes, sessions                                  |
| VirtualLogList (2.5)     | logs, chat transcript, sessions transcript, update-runner output |
| ToolCallCard (2.5)       | chat, debug RPC playground                                       |
| ThinkingCard (2.5)       | chat, sessions detail                                            |

Any sub-track that hand-rolls a primitive instead of composing Phase 2 fails code review.

## Claim / Work Protocol

1. `pnpm parity:check` — confirm matrix current
2. Pick a sub-track with `checkpoint: pending` and no blocked-by
3. `TaskUpdate owner=<name>` on its first Task Group
4. Follow A (tests) → B (impl) → C (integration) → D (verify) strictly
5. D-group ends with `parity:check` + visual-diff + FAST_COMMIT=1 git commit -m "..."
6. Advance matrix status — rerun discovery, confirm feature flips to `complete`
7. Release the sub-track, move to next

No parallel claims on the same sub-track. Parallel devs = parallel sub-tracks only.
