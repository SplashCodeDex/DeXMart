Plan: DeXMart Dashboard — ControlUI Complete Parity & Replacement

Context

DeXMart's Next.js dashboard (frontend/) is the SaaS-grade replacement for ControlUI (OpenClaw's
self-hosted Lit/Vite SPA running at :18789). PROJECT_RULES.md §0 declares "Frontend dominates —
the DeXMart Next.js dashboard is THE UI." But ControlUI cannot be deleted until DeXMart covers every
surface it exposes: 17 major feature areas, 33+ RPC domains, 100+ Gateway methods.

This plan creates one conductor track with 13 sub-tracks (phases), each broken into sub-sub-tracks
(task groups), so any developer who picks it up can execute atomically and verify parity before
ControlUI is removed. The approach is Add, Subtract, Weave: every ControlUI concept is either
added as a first-class DeXMart page, subtracted (self-hosted-only features eliminated), or woven into
an existing DeXMart page in DeXMart's visual language (glassmorphism, OKLCH, shadcn/ui, Framer Motion).

---

Conductor Track to Create

Directory: conductor/tracks/dashboard_controlui_parity_20260421/

Files to create:

- index.md — links to spec, plan, metadata
- spec.md — full feature inventory + acceptance criteria
- plan.md — the executable phased plan (primary reference)
- metadata.json — { type: "feature", status: "new" }

Entry to add in conductor/tracks.md:

- [ ] **Track: Dashboard ControlUI Parity — Full Frontend Replacement**
      _Link: [./tracks/dashboard_controlui_parity_20260421/](./tracks/dashboard_controlui_parity_20260421/)_

---

Architecture Decisions (Inform All Phases)

A. Gateway RPC Client (foundation for every phase)

DeXMart dashboard must talk to the OpenClaw Gateway WebSocket (port same as backend, path configured).
The Gateway uses a custom JSON-RPC-like protocol (not Socket.io namespace events — raw WS messages
with { method, params, id } shape). DeXMart already has socket.io-client for its own events but
needs a separate typed RPC layer for Gateway communication.

Decision: Create frontend/src/lib/gateway/ with:

- gateway-client.ts — singleton WS client, auto-reconnect, auth handshake
- gateway-rpc.ts — typed call<T>(method, params) → Promise + event subscription
- gateway-hooks.ts — React hooks: useGateway(), useRpc(), useGatewayEvent()
- gateway-types.ts — Zod schemas for every RPC request/response (auto-validated)

B. Add / Subtract / Weave Mapping

┌───────────────────────────────────┬─────────────────────────────────────────────┬───────────────────────────────┐
│ ControlUI Feature │ DeXMart Strategy │ Target Location │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Chat Interface │ ADD as new /dashboard/chat │ features/chat/ │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Channel Status + QR │ WEAVE into existing Omnichannel │ features/omnichannel/ enhance │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Channel OAuth Login Flow │ WEAVE into Omnichannel QR modal │ in-page modal │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Session Management │ IMPLEMENT existing /dashboard/sessions stub │ features/sessions/ │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Session Compaction/Branching │ ADD into sessions detail │ sessions sub-page │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Configuration Panel │ ENHANCE existing /dashboard/config │ features/config/ enhance │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Schema Form Renderer │ ADD as shared component │ components/schema-form/ │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Cron Run History + Manual Trigger │ ENHANCE existing /dashboard/cron │ features/cron/ enhance │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Skills Install + API Keys │ ENHANCE existing /dashboard/skills │ features/skills/ enhance │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Nodes Detail + Canvas │ ENHANCE existing /dashboard/nodes │ features/nodes/ enhance │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Device Pairing + Token │ WEAVE into Nodes (Devices tab) │ nodes page tab │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Logs Live Tail │ IMPLEMENT existing /dashboard/logs stub │ features/logs/ │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Debug / Developer Panel │ ADD as /dashboard/debug (gated: dev/admin) │ features/debug/ │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Doctor / Memory (Dream) │ WEAVE into Agents as "Memory" tab │ agents page tab │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ TTS Settings │ WEAVE into /dashboard/config voice section │ config section │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Instances / Presence │ WEAVE into /dashboard/home status bar │ home feature │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Setup Wizard │ ADD as /dashboard/setup (first-run only) │ features/setup/ │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Agent File Editor │ ENHANCE existing /dashboard/agents │ agents sub-page │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Agent Identity/Avatar │ ENHANCE existing /dashboard/agents │ agents detail │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Model Selection │ ENHANCE existing sessions + agents │ shared component │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Usage Time-Series Charts │ ENHANCE existing /dashboard/usage │ features/usage/ enhance │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Exec Approvals Allowlist │ ADD into /dashboard/config security tab │ config tab │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Update Runner │ WEAVE into /dashboard/config system tab │ config tab │
├───────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────────────┤
│ Gateway Identity │ WEAVE into /dashboard/home header │ home feature │
└───────────────────────────────────┴─────────────────────────────────────────────┴───────────────────────────────┘

SUBTRACT (self-hosted-only, no SaaS equivalent):

- Raw JSON config file editing (replaced by form-based config with Zod validation)
- Raw openclaw.json patch (replaced by structured sections)
- Tailscale identity auth (not applicable to cloud SaaS)
- Local media preview roots (filesystem access — not applicable)
- Embed sandbox iframe config (internal infra, not user-facing)

C. Multi-Tenancy Wrapping

ControlUI was single-user. Every RPC call in DeXMart must include the authenticated user's Firebase
UID as a tenant scope. The Gateway RPC client should inject this automatically via auth headers.
Every Firestore persistence must target users/{userId}/... per PROJECT_RULES §3.

D. Visual Language Rules (All Phases)

- All new components use shadcn/ui primitives from components/ui/
- Real-time indicators use ConnectionStatus component pattern
- Live data cards use glassmorphism (bg-card/60 backdrop-blur-sm border border-border/50)
- Streaming text uses components/ui/motion.tsx fade-in animation
- Icons: lucide-react only, NO emojis
- Colors: OKLCH tokens from globals.css — primary green (hue 155), accent violet (hue 285)
- All new pages follow Thin Page pattern: page.tsx renders one <FeatureRoot /> component only

---

Phase 1: Gateway RPC Foundation

Sub-Track 1 — The typed WebSocket/RPC bridge. All subsequent phases depend on this.

Task Group 1.1 — Gateway Client Core

- Task 1.1.1: Read src/gateway/ Gateway WS protocol — extract message envelope shape (method, params, id, result, error)
- Task 1.1.2: Write failing tests for gateway-client.ts — connection lifecycle, auth handshake, reconnect
- Task 1.1.3: Implement frontend/src/lib/gateway/gateway-client.ts — singleton WS, auto-reconnect w/ exponential backoff, Firebase JWT auth header injection
- Task 1.1.4: Write failing tests for gateway-rpc.ts — typed call, streaming event subscription, timeout
- Task 1.1.5: Implement frontend/src/lib/gateway/gateway-rpc.ts — call<T>(), subscribe(), idempotency key support
- Task 1.1.6: Run tests (green) + coverage check (>80%)

Task Group 1.2 — Zod Type Contracts

- Task 1.2.1: Create frontend/src/lib/gateway/gateway-types.ts — Zod schemas for all 33 RPC domains (use inference, not manual interface writing)
- Task 1.2.2: Add schema for Chat domain (chat.history, chat.send, chat.abort, chat.inject)
- Task 1.2.3: Add schemas for Channels, Agents, Sessions, Cron, Config, Skills, Nodes, Logs, Doctor, Devices, Models, Usage, Update, Wizard, TTS, Tools, Commands, Exec,
  Gateway
- Task 1.2.4: Write type-safety tests — parse real Gateway responses against schemas (use recorded fixtures)
- Task 1.2.5: Run tests (green) + coverage check

Task Group 1.3 — React Hooks Layer

- Task 1.3.1: Write failing tests for useGateway() — connected state, error state, reconnecting state
- Task 1.3.2: Implement frontend/src/lib/gateway/gateway-hooks.ts — useGateway(), useRpcCall(), useGatewayStream()
- Task 1.3.3: Add GatewayProvider to frontend/src/components/providers/ — wraps dashboard layout
- Task 1.3.4: Wire GatewayProvider into frontend/src/app/(dashboard)/layout.tsx
- Task 1.3.5: Add ConnectionStatus indicator for Gateway (separate from existing Socket.io status)
- Task 1.3.6: Run tests + typecheck (zero errors)
- Task 1.3.7: Commit — feat(gateway): typed RPC bridge with Zod contracts and React hooks
- Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

---

Phase 2: Mastermind Chat Interface (ADD)

Sub-Track 2 — The crown jewel. A streaming AI chat with tool call visualization, absent in DeXMart.

Task Group 2.1 — Chat Architecture & Route

- Task 2.1.1: Create frontend/src/features/chat/ directory structure (components/, hooks/, types/, index.ts)
- Task 2.1.2: Create frontend/src/app/(dashboard)/dashboard/chat/page.tsx — thin page, renders <ChatRoot />
- Task 2.1.3: Add /dashboard/chat to Sidebar nav (MessageSquare icon, "Chat" label)
- Task 2.1.4: Write failing tests for ChatStore (Zustand) — messages, streaming state, abort flag
- Task 2.1.5: Implement frontend/src/features/chat/store.ts — chat Zustand store
- Task 2.1.6: Run tests (green)

Task Group 2.2 — Message Streaming Engine

- Task 2.2.1: Write failing tests for useChatSession hook — send, stream append, abort
- Task 2.2.2: Implement frontend/src/features/chat/hooks/useChatSession.ts — wraps useGatewayStream() for chat.send non-blocking events
- Task 2.2.3: Implement streaming text renderer with character-by-character Framer Motion fade-in
- Task 2.2.4: Implement chat.abort binding to a floating Abort button (visible only while streaming)
- Task 2.2.5: Implement chat.history load on mount (paginated, last 50 messages default)
- Task 2.2.6: Run tests (green) + coverage check

Task Group 2.3 — Tool Call Visualization

- Task 2.3.1: Write failing tests for ToolCallCard — pending state, executing state, result state, error state
- Task 2.3.2: Implement frontend/src/features/chat/components/ToolCallCard.tsx — collapsible card showing tool name, input params, output (code block), duration
- Task 2.3.3: Implement frontend/src/features/chat/components/ThinkingCard.tsx — collapsible reasoning trace (matches Reasoning page style)
- Task 2.3.4: Implement message list virtualization (react-virtual) for long conversations
- Task 2.3.5: Add chat.inject (assistant note injection) accessible via slash command /note
- Task 2.3.6: Run tests + visual check in dev server

Task Group 2.4 — Session Context & Model Selection

- Task 2.4.1: Add session selector dropdown — links to sessions list, shows active session
- Task 2.4.2: Implement ModelSelector shared component (frontend/src/components/shared/ModelSelector.tsx) — wraps models.list RPC
- Task 2.4.3: Add per-session overrides panel (thinking mode toggle, verbosity, trace) — collapsible sidebar panel
- Task 2.4.4: Add usage display (token count, cost estimate) in chat footer
- Task 2.4.5: Run tests (green) + typecheck
- Task 2.4.6: Commit — feat(chat): Mastermind chat with streaming, tool cards, session overrides
- Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

---

Phase 3: Channel Management Parity (WEAVE + ENHANCE)

Sub-Track 3 — QR code login flows and channel status woven into existing Omnichannel page.

Task Group 3.1 — Channel Status & QR Code Login

- Task 3.1.1: Write failing tests for useChannelStatus hook — polling channels.status, QR base64 decode
- Task 3.1.2: Implement frontend/src/features/omnichannel/hooks/useChannelStatus.ts — live channel status via Gateway RPC
- Task 3.1.3: Create frontend/src/features/omnichannel/components/QRLoginModal.tsx — full-screen modal with QR code image, countdown timer, auto-refresh on expiry
- Task 3.1.4: Create frontend/src/features/omnichannel/components/ChannelStatusBadge.tsx — animated indicator (connecting/online/error/qr-required states in OKLCH
  semantic colors)
- Task 3.1.5: Wire QRLoginModal into existing Omnichannel page — "Connect" button per channel triggers modal
- Task 3.1.6: Run tests (green) + coverage check

Task Group 3.2 — Per-Channel Configuration

- Task 3.2.1: Write failing tests for channel config form — Zod validation, submit calls config.patch
- Task 3.2.2: Create ChannelConfigDrawer.tsx — Sheet component (slides from right), renders channel-specific config fields (phone, webhook URL, session name, etc.)
- Task 3.2.3: Implement channels.logout binding — "Logout" button with confirmation dialog, optimistic status update
- Task 3.2.4: Add web.login.start + web.login.wait flow for OAuth-based channels (non-QR login)
- Task 3.2.5: Run tests + typecheck
- Task 3.2.6: Commit — feat(omnichannel): QR login flows, channel status badges, config drawer
- Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

---

Phase 4: Session Management (IMPLEMENT)

Sub-Track 4 — The existing /dashboard/sessions sidebar link has no page. Build it completely.

Task Group 4.1 — Sessions List Page

- Task 4.1.1: Create frontend/src/features/sessions/ directory structure
- Task 4.1.2: Create frontend/src/app/(dashboard)/dashboard/sessions/page.tsx — thin page renders <SessionsRoot />
- Task 4.1.3: Write failing tests for useSessionsList hook — fetch, filter by status, search by key
- Task 4.1.4: Implement frontend/src/features/sessions/hooks/useSessionsList.ts — wraps sessions.list RPC
- Task 4.1.5: Create SessionsTable.tsx — sortable table (key, agent, channel, model, created, status), row click → detail view
- Task 4.1.6: Add session actions: delete (with confirmation), reset, compact — via row action menu
- Task 4.1.7: Run tests (green) + coverage check

Task Group 4.2 — Session Detail View

- Task 4.2.1: Create frontend/src/app/(dashboard)/dashboard/sessions/[id]/page.tsx — session detail thin page
- Task 4.2.2: Write failing tests for useSessionDetail hook — fetch, subscribe to live updates
- Task 4.2.3: Implement session detail: metadata card (model, agent, channel, created, usage), transcript preview (read-only message list)
- Task 4.2.4: Add override controls panel: model override dropdown, thinking mode toggle, verbose toggle, trace toggle — calls sessions.patch
- Task 4.2.5: Add usage breakdown card: input tokens, output tokens, cost estimate, charts via recharts
- Task 4.2.6: Run tests (green) + coverage check

Task Group 4.3 — Session Compaction & Branching

- Task 4.3.1: Write failing tests for useCompaction hook — list branches, restore, create branch
- Task 4.3.2: Create CompactionPanel.tsx — collapsible panel in session detail, shows branch tree (timeline visualization)
- Task 4.3.3: Implement sessions.compaction.list → branch list, sessions.compaction.restore → confirmation dialog, sessions.compaction.branch → name input modal
- Task 4.3.4: Run tests + typecheck
- Task 4.3.5: Commit — feat(sessions): full session management — list, detail, overrides, compaction
- Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)

---

Phase 5: Observability Triad (IMPLEMENT + ADD)

Sub-Track 5 — Logs page stub + new Debug panel + Doctor/Memory woven into Agents.

Task Group 5.1 — Live Logs Viewer

- Task 5.1.1: Create frontend/src/features/logs/ directory structure
- Task 5.1.2: Create frontend/src/app/(dashboard)/dashboard/logs/page.tsx — thin page renders <LogsRoot />
- Task 5.1.3: Write failing tests for useLogStream hook — logs.tail subscription, filter params, pause/resume
- Task 5.1.4: Implement frontend/src/features/logs/hooks/useLogStream.ts — Gateway subscription, circular buffer (max 2000 lines in memory)
- Task 5.1.5: Create LogsViewer.tsx — virtualized log list (react-virtual), monospace font (JetBrains Mono), ANSI color rendering, level filter chips
  (debug/info/warn/error), search input
- Task 5.1.6: Add export button — downloads current buffer as .log file (client-side Blob)
- Task 5.1.7: Run tests (green) + coverage check

Task Group 5.2 — Debug / Developer Panel (Admin-Gated)

- Task 5.2.1: Create frontend/src/features/debug/ directory structure
- Task 5.2.2: Create frontend/src/app/(dashboard)/dashboard/debug/page.tsx — thin page, gated by user.role === 'admin' check from Firebase claims
- Task 5.2.3: Add /dashboard/debug to sidebar (hidden unless admin role — conditional render)
- Task 5.2.4: Implement GatewayHealthCard.tsx — gateway.identity.get + last heartbeat, uptime, version
- Task 5.2.5: Implement RpcPlaygroundCard.tsx — raw RPC caller: method input + JSON params textarea → response display (for developer use)
- Task 5.2.6: Implement ModelsListCard.tsx — models.list output in sortable table (provider, name, context, available)
- Task 5.2.7: Implement ExecApprovalsCard.tsx — exec.approvals.get/set — gateway and node allowlists as editable tag inputs
- Task 5.2.8: Run tests + coverage check

Task Group 5.3 — Doctor / Memory UI (WEAVE into Agents)

- Task 5.3.1: Write failing tests for useMemoryStatus hook — doctor.memory.status, toggle dream mode
- Task 5.3.2: Add "Memory" tab to existing /dashboard/agents detail page
- Task 5.3.3: Create MemoryPanel.tsx — dream mode toggle switch, last-dreamed timestamp, dream diary entries (paginated list), each entry collapsible with timestamp +
  content
- Task 5.3.4: Run tests + typecheck
- Task 5.3.5: Commit — feat(observability): live logs viewer, debug panel, memory/doctor UI in agents
- Task: Conductor - User Manual Verification 'Phase 5' (Protocol in workflow.md)

---

Phase 6: Automation Enhancement (ENHANCE)

Sub-Track 6 — Existing Cron page gets run history, manual trigger, and agent override support.

Task Group 6.1 — Cron Run History & Manual Trigger

- Task 6.1.1: Write failing tests for useCronRuns hook — cron.runs fetch, pagination
- Task 6.1.2: Enhance frontend/src/features/cron/ — add CronRunHistoryDrawer.tsx (Sheet component, shows past runs with timestamp, status, output)
- Task 6.1.3: Add "Run Now" button per cron job — calls cron.run, shows toast with result summary
- Task 6.1.4: Add cron.status polling — live status badge on each job row (idle/running/error)
- Task 6.1.5: Run tests (green) + coverage check

Task Group 6.2 — Advanced Cron Options

- Task 6.2.1: Enhance cron create/edit form — add delivery mode selector (announce/webhook/none), stagger input, delete-after-run toggle
- Task 6.2.2: Add agent override fields in cron form — override agent ID, model, thinking mode per job
- Task 6.2.3: Run tests + typecheck
- Task 6.2.4: Commit — feat(cron): run history drawer, manual trigger, advanced options
- Task: Conductor - User Manual Verification 'Phase 6' (Protocol in workflow.md)

---

Phase 7: Skills & Plugin Management Enhancement (ENHANCE)

Sub-Track 7 — Existing Skills page gets install flows, discovery, and API key management.

Task Group 7.1 — Skills Discovery & Install

- Task 7.1.1: Write failing tests for useSkillsStatus hook — skills.status, skills.bins, skills.search
- Task 7.1.2: Enhance frontend/src/features/skills/ — add skills search input (debounced, calls skills.search)
- Task 7.1.3: Create SkillInstallDrawer.tsx — skills.detail info + install button calling skills.install, progress indicator
- Task 7.1.4: Add bin/category filter chips above skills grid
- Task 7.1.5: Run tests (green) + coverage check

Task Group 7.2 — API Key Management

- Task 7.2.1: Write failing tests for API key update flow — validation, skills.update call
- Task 7.2.2: Create SkillApiKeyModal.tsx — Dialog with masked input fields for API keys, Zod validation, calls skills.update
- Task 7.2.3: Show "Configure Keys" button on skills that require API keys (detected from skills.detail schema)
- Task 7.2.4: Run tests + typecheck
- Task 7.2.5: Commit — feat(skills): discovery search, install flow, API key management
- Task: Conductor - User Manual Verification 'Phase 7' (Protocol in workflow.md)

---

Phase 8: Nodes, Devices & TTS (ENHANCE + WEAVE)

Sub-Track 8 — Nodes page gets device pairing tab + TTS woven into Config.

Task Group 8.1 — Nodes Detail & Canvas

- Task 8.1.1: Write failing tests for useNodeDetail hook — node.describe, node.invoke
- Task 8.1.2: Enhance existing Nodes page — add node detail drawer (Sheet) with capabilities list, invoke button + param form
- Task 8.1.3: Add node.canvas.capability.refresh button in drawer — "Refresh Capabilities"
- Task 8.1.4: Implement pending queue panel: node.pending.pull list + node.pending.ack + node.pending.drain (with confirmation)
- Task 8.1.5: Run tests (green) + coverage check

Task Group 8.2 — Device Pairing Tab (WEAVE into Nodes)

- Task 8.2.1: Write failing tests for useDevices hook — device.pair.list, approve, reject, remove, rotate token
- Task 8.2.2: Add "Devices" tab to existing /dashboard/nodes page (Tabs component)
- Task 8.2.3: Create DevicePairingTable.tsx — pending requests (approve/reject actions), paired devices (remove action)
- Task 8.2.4: Add token management: device.token.rotate button + device.token.revoke with confirmation
- Task 8.2.5: Run tests + coverage check

Task Group 8.3 — TTS Settings (WEAVE into Config)

- Task 8.3.1: Write failing tests for useTtsConfig hook — tts.status, tts.providers, enable/disable
- Task 8.3.2: Add "Voice" section to existing /dashboard/config page
- Task 8.3.3: Create TtsConfigSection.tsx — enable/disable toggle, provider dropdown (tts.providers), voice selector, talk.speak test button (plays audio in browser)
- Task 8.3.4: Run tests + typecheck
- Task 8.3.5: Commit — feat(nodes): detail drawer, canvas, pending queues, device pairing, TTS config
- Task: Conductor - User Manual Verification 'Phase 8' (Protocol in workflow.md)

---

Phase 9: Agents Enhancement (ENHANCE)

Sub-Track 9 — Existing Agents page gets file editor, identity/avatar, and model picker.

Task Group 9.1 — Agent File Editor

- Task 9.1.1: Write failing tests for useAgentFiles hook — agents.files.list, agents.files.get, agents.files.set
- Task 9.1.2: Add "Files" tab to agent detail view in /dashboard/agents
- Task 9.1.3: Create AgentFileEditor.tsx — file tree sidebar + CodeMirror 6 editor (monospace, syntax highlight by extension), save button calls agents.files.set,
  unsaved-changes guard
- Task 9.1.4: Run tests (green) + coverage check

Task Group 9.2 — Agent Identity & Avatar

- Task 9.2.1: Write failing tests for agent update form — agents.update Zod validation
- Task 9.2.2: Add "Identity" tab to agent detail: name input, avatar URL input with preview (img + fallback icon), agent ID display
- Task 9.2.3: Add model assignment: ModelSelector component (from Phase 2.4) wired to agents.update
- Task 9.2.4: Add channel assignment multi-select — channels from channels.status RPC
- Task 9.2.5: Run tests + typecheck
- Task 9.2.6: Commit — feat(agents): file editor (CodeMirror), identity/avatar, model + channel assignment
- Task: Conductor - User Manual Verification 'Phase 9' (Protocol in workflow.md)

---

Phase 10: Configuration Parity (ENHANCE)

Sub-Track 10 — Config page gets JSON schema form renderer, apply+restart, and security/update tabs.

Task Group 10.1 — JSON Schema Form Renderer

- Task 10.1.1: Write failing tests for SchemaFormRenderer — renders fields from JSON schema, validates via Zod, emits onChange
- Task 10.1.2: Create frontend/src/components/schema-form/SchemaFormRenderer.tsx — converts Gateway config.schema output into typed form sections: string inputs, number
  inputs, boolean toggles, enum selects, nested object sections, array field lists
- Task 10.1.3: Wire into /dashboard/config — calls config.schema, renders form, on submit calls config.set
- Task 10.1.4: Add "Apply & Restart" button — calls config.apply, shows loading state + success toast
- Task 10.1.5: Run tests (green) + coverage check

Task Group 10.2 — Config Tabs: Security + System

- Task 10.2.1: Add "Security" tab to Config page — Exec Approvals allowlist UI (from Phase 5.2.7 ExecApprovalsCard, reuse it here)
- Task 10.2.2: Add "System" tab — gateway identity display, version info, "Run Update" button calls update.run with confirmation dialog + streaming output
- Task 10.2.3: Add "Secrets" section — secrets.resolve for viewing resolved values, secrets.reload button
- Task 10.2.4: Run tests + typecheck
- Task 10.2.5: Commit — feat(config): JSON schema form renderer, apply+restart, security tab, system tab
- Task: Conductor - User Manual Verification 'Phase 10' (Protocol in workflow.md)

---

Phase 11: Setup Wizard & Onboarding (ADD)

Sub-Track 11 — First-run wizard that replaces the ControlUI wizard flow.

Task Group 11.1 — Wizard Route & Flow Engine

- Task 11.1.1: Write failing tests for useSetupWizard hook — wizard.status, wizard.next, wizard.cancel
- Task 11.1.2: Create frontend/src/features/setup/ directory structure
- Task 11.1.3: Create frontend/src/app/(dashboard)/dashboard/setup/page.tsx — thin page, auto-redirect from home if wizard.status shows incomplete
- Task 11.1.4: Implement wizard state machine (XState-lite via Zustand) — step tracking, back/next, cancel-with-confirm
- Task 11.1.5: Run tests (green)

Task Group 11.2 — Wizard Steps UI

- Task 11.2.1: Create WizardShell.tsx — progress indicator (step dots), animated step transitions (Framer Motion slide), step title + subtitle header
- Task 11.2.2: Implement Step 1: Gateway URL + auth token entry form (Zod validation, test connection via gateway.identity.get)
- Task 11.2.3: Implement Step 2: Channel setup (select channel type, trigger QR login modal from Phase 3 — reuse QRLoginModal)
- Task 11.2.4: Implement Step 3: Agent creation (name, model selection using ModelSelector, avatar)
- Task 11.2.5: Implement Step 4: Completion — summary of configured channels + agents, confetti animation, redirect to /dashboard/home
- Task 11.2.6: Run tests + typecheck
- Task 11.2.7: Commit — feat(setup): multi-step setup wizard with Gateway connection, channel, and agent onboarding
- Task: Conductor - User Manual Verification 'Phase 11' (Protocol in workflow.md)

---

Phase 12: Analytics & Presence Enhancement (ENHANCE + WEAVE)

Sub-Track 12 — Usage page gets time-series charts + instances/presence woven into home.

Task Group 12.1 — Usage Time-Series Charts

- Task 12.1.1: Write failing tests for useUsageTimeseries hook — sessions.usage.timeseries, date range params
- Task 12.1.2: Add time-series chart to /dashboard/usage — recharts AreaChart, day/week/month granularity toggle
- Task 12.1.3: Add cost breakdown pie chart by model provider
- Task 12.1.4: Add session count trend line chart
- Task 12.1.5: Run tests + coverage check

Task Group 12.2 — Instances / Presence Panel (WEAVE into Home)

- Task 12.2.1: Write failing tests for usePresence hook — system-presence polling, last-heartbeat
- Task 12.2.2: Add Presence card to /dashboard/home — active instances list with status dot (online/idle/offline), uptime badge
- Task 12.2.3: Add Gateway identity header to home page — assistant name, avatar, server version
- Task 12.2.4: Run tests + typecheck
- Task 12.2.5: Commit — feat(analytics): usage time-series + cost charts, presence panel in home
- Task: Conductor - User Manual Verification 'Phase 12' (Protocol in workflow.md)

---

Phase 13: ControlUI Deprecation & Removal

Sub-Track 13 — Parity verified, ControlUI deleted from the codebase.

Task Group 13.1 — Parity Smoke Test Suite

- Task 13.1.1: Create frontend/src/e2e/controlui-parity.spec.ts — Playwright tests asserting each ControlUI feature has a corresponding reachable DeXMart route
- Task 13.1.2: Run full Playwright suite against dev server — all 17 feature areas must have green coverage
- Task 13.1.3: Run pnpm test (all unit tests) — must be green, 0 failures
- Task 13.1.4: Run pnpm typecheck (frontend + backend) — zero errors
- Task 13.1.5: Manual walkthrough: Chat → Channels → Sessions → Logs → Config → Cron → Skills → Nodes → Agents → Setup — document any regressions found

Task Group 13.2 — ControlUI Serving Route Removal

- Task 13.2.1: Read src/gateway/control-ui.ts, src/gateway/control-ui-routing.ts, src/gateway/control-ui-http-utils.ts, src/gateway/control-ui-shared.ts,
  src/gateway/control-ui-contract.ts, src/gateway/server-control-ui-root.ts
- Task 13.2.2: Remove all ControlUI HTTP handlers from src/gateway/ — delete the 6 files above
- Task 13.2.3: Remove ControlUI static asset resolution from gateway startup
- Task 13.2.4: Remove gateway.controlUi.\* config keys from Gateway config schema + Zod types
- Task 13.2.5: Remove /**openclaw/control-ui-config.json and /**openclaw\_\_/assistant-media routes
- Task 13.2.6: Run backend tests — must remain green

Task Group 13.3 — ControlUI Config & Docs Cleanup

- Task 13.3.1: Remove controlUi section from any openclaw.json defaults or config schema
- Task 13.3.2: Update docs/PROJECT_RULES.md §0 — remove ControlUI reference, update "Frontend dominates" statement to confirmed fact
- Task 13.3.3: Update docs/architecture/FUSION_STRATEGY.md — mark ControlUI removal complete
- Task 13.3.4: Update conductor/product.md and conductor/tracks.md — mark track complete
- Task 13.3.5: Run full test suite one final time — zero failures
- Task 13.3.6: Commit — feat(dashboard)!: DeXMart dashboard achieves full ControlUI parity — ControlUI removed
- Task: Conductor - User Manual Verification 'Phase 13: ControlUI Deprecation Complete' (Protocol in workflow.md)

---

Critical Files Reference

┌─────────────────────────────────────────────┬───────────────────────────────────────────────────────────┐
│ File │ Role │
├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ frontend/src/app/(dashboard)/layout.tsx │ Add GatewayProvider here │
├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ frontend/src/components/layouts/Sidebar.tsx │ Add new nav items (Chat, Sessions, Logs, Debug) │
├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ frontend/src/app/globals.css │ OKLCH design tokens — do not add new tokens, use existing │
├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ frontend/src/components/ui/ │ 34 shadcn primitives — compose from these only │
├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ frontend/src/features/omnichannel/ │ Enhance for Phase 3 │
├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ frontend/src/features/cron/ │ Enhance for Phase 6 │
├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ frontend/src/features/skills/ │ Enhance for Phase 7 │
├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ frontend/src/features/agents/ │ Enhance for Phase 9 │
├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ frontend/src/features/usage/ │ Enhance for Phase 12 │
├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ src/gateway/control-ui.ts │ DELETE in Phase 13 │
├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ src/gateway/control-ui-routing.ts │ DELETE in Phase 13 │
├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ src/gateway/control-ui-http-utils.ts │ DELETE in Phase 13 │
├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ src/gateway/control-ui-shared.ts │ DELETE in Phase 13 │
├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ src/gateway/control-ui-contract.ts │ DELETE in Phase 13 │
├─────────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ src/gateway/server-control-ui-root.ts │ DELETE in Phase 13 │
└─────────────────────────────────────────────┴───────────────────────────────────────────────────────────┘

---

Verification Strategy

Per-phase: Each phase ends with unit test pass + manual verification checkpoint per conductor workflow.md protocol.

Cross-phase: The ModelSelector component (Phase 2) is reused in Phases 9, 11. The QRLoginModal (Phase 3) is reused in Phase 11. Shared components go in
frontend/src/components/shared/ to avoid duplication.

Final gate (Phase 13.1): Playwright E2E parity suite must pass before ANY ControlUI file is deleted. Deletion is irreversible — test first.

Coverage: All new hooks/ and logic files must hit >80% coverage. UI components tested via Vitest + Testing Library for interaction states.
