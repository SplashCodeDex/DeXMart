# OpenClaw Upstream Sync — Gap Analysis Report

**Generated:** 2026-04-15 01:12:54
**Range:** `v2026.3.2` → `v2026.4.14`
**Upstream Repository:** https://github.com/openclaw/openclaw

---

## 📊 Gap Summary

| Metric | Count |
|--------|-------|
| **Stable Releases** | 19 |
| **Beta/Pre-releases** | 0 |
| **Total Changes (Features)** | 321 |
| **Total Breaking Changes** | 31 |
| **Total Fixes** | 1463 |
| **Versions Touching Injection Points** | 4 |

> [!WARNING]
> **Sync Risk Assessment:**
> - 31 breaking change(s) detected across the version range.
> - 4 version(s) may affect DeXMart injection points.
> 
> Review the **Injection Point Alerts** section and each flagged version carefully before syncing.

---

## 🎯 Injection Point Alerts

These versions contain changes that **may conflict** with DeXMart's modified files:

### v2026.3.7
- **src/config/io.ts** (matched: `loadConfig`)
- **src/plugins/registry.ts** (matched: `registerPlugin`)

### v2026.3.11
- **src/ingress/ingress-service.ts** (matched: `runEmbeddedPiAgent`)

### v2026.3.22
- **src/web/session.ts** (matched: `baileys`)
- **src/ingress/ingress-service.ts** (matched: `runEmbeddedPiAgent`)

### v2026.4.14
- **src/web/session.ts** (matched: `baileys`)

---

## ⚠️ All Breaking Changes

### v2026.3.7
- **BREAKING:** Gateway auth now requires explicit `gateway.auth.mode` when both `gateway.auth.token` and `gateway.auth.password` are configured (including SecretRefs). Set `gateway.auth.mode` to `token` or `password` before upgrade to avoid startup/pairing/TUI failures. (#35094) Thanks @joshavant.

### v2026.3.11
- Cron/doctor: tighten isolated cron delivery so cron jobs can no longer notify through ad hoc agent sends or fallback main-session summaries, and add `openclaw doctor --fix` migration for legacy cron storage and legacy notify/webhook delivery metadata. (#40998) Thanks @mbelinky.

### v2026.3.22
- Plugins/install: bare `openclaw plugins install <package>` now prefers ClawHub before npm for npm-safe names, and only falls back to npm when ClawHub does not have that package or version. Docs: https://docs.openclaw.ai/tools/clawhub
- Browser/Chrome MCP: remove the legacy Chrome extension relay path, bundled extension assets, `driver: "extension"`, and `browser.relayBindHost`. Run `openclaw doctor --fix` to migrate host-local browser config to `existing-session` / `user`; Docker, headless, sandbox, and remote browser flows still use raw CDP. Docs: https://docs.openclaw.ai/gateway/doctor and https://docs.openclaw.ai/tools/browser (#47893) Thanks @vincentkoc.
- Tools/image generation: standardize the stock image create/edit path on the core `image_generate` tool. The old `nano-banana-pro` docs/examples are gone; if you previously copied that sample-skill config, switch to `agents.defaults.imageGenerationModel` for built-in image generation or install a separate third-party skill explicitly.
- Skills/image generation: remove the bundled `nano-banana-pro` skill wrapper. Use `agents.defaults.imageGenerationModel.primary: "google/gemini-3-pro-image-preview"` for the native Nano Banana-style path instead.
- Plugins/SDK: the new public plugin SDK surface is `openclaw/plugin-sdk/*`; `openclaw/extension-api` is removed with no compatibility shim. Bundled plugins must use injected runtime for host-side operations (for example `api.runtime.agent.runEmbeddedPiAgent`) and any remaining direct imports must come from narrow `openclaw/plugin-sdk/*` subpaths instead of the monolithic SDK root. Docs: https://docs.openclaw.ai/plugins/sdk-migration and https://docs.openclaw.ai/plugins/sdk-overview
- Plugins/message discovery: require `ChannelMessageActionAdapter.describeMessageTool(...)` for shared `message` tool discovery. The legacy `listActions`, `getCapabilities`, and `getToolSchema` adapter methods are removed. Plugin authors should migrate message discovery to `describeMessageTool(...)` and keep channel-specific action runtime code inside the owning plugin package. Thanks @gumadeiras.
- Plugins/Matrix: add a new Matrix plugin backed by the official `matrix-js-sdk`. If you are upgrading from the previous public Matrix plugin, follow the migration guide: https://docs.openclaw.ai/install/migrating-matrix Thanks @gumadeiras.
- Config/env: remove legacy `CLAWDBOT_*` and `MOLTBOT_*` compatibility env names across runtime, installers, and test tooling. Use the matching `OPENCLAW_*` env names instead.
- Config/state: remove legacy `.moltbot` state-dir and `moltbot.json` auto-detection/migration fallback. If you still keep state under `~/.moltbot`, move it to `~/.openclaw` or set `OPENCLAW_STATE_DIR` / `OPENCLAW_CONFIG_PATH` explicitly. Docs: https://docs.openclaw.ai/install/migrating and https://docs.openclaw.ai/start/getting-started
- Exec/env sandbox: block build-tool JVM injection (`MAVEN_OPTS`, `SBT_OPTS`, `GRADLE_OPTS`, `ANT_OPTS`), glibc tunable exploitation (`GLIBC_TUNABLES`), and .NET dependency resolution hijack (`DOTNET_ADDITIONAL_DEPS`) from the host exec environment, and restrict Gradle init script redirect (`GRADLE_USER_HOME`) as an override-only block so user-configured Gradle homes still propagate. (#49702)
- Discord/commands: switch native command deployment to Carbon reconcile by default so Discord restarts stop churning slash commands through OpenClaw’s local deploy path. (#46597) Thanks @huntharo and @thewilloftheshadow.
- Security/exec approvals: treat `time` as a transparent dispatch wrapper during allowlist evaluation and allow-always persistence so approved `time ...` commands bind the inner executable instead of the wrapper path. Thanks @YLChen-007 for reporting.
- Voice-call/webhooks: reject missing provider signature headers before body reads, drop the pre-auth body budget to `64 KB` / `5s`, and cap concurrent pre-auth requests per source IP so unauthenticated callers cannot force the old `1 MB` / `30s` buffering path. Thanks @SEORY0 for reporting.
- Plugins/Matrix: stop mention-gated or otherwise dropped room chatter from refreshing focused thread bindings before the message is actually routed, so idle ACP and session bindings can still expire normally in mention-required rooms. Thanks @vincentkoc, @dinakars777 and @mvanhorn.
- Plugins/Matrix: durably dedupe inbound room events across gateway restarts so previously handled Matrix messages are not replayed as new, while preserving clean-restart backlog delivery for unseen events. (#50922) thanks @gumadeiras
- Agents/media replies: migrate the remaining browser, canvas, and nodes snapshot outputs onto `details.media` so generated media keeps attaching to assistant replies after the collect-then-attach refactor. (#51731) Thanks @christianklotz.
- Android/contacts search: escape literal `%` and `_` in contact-name queries so searches like `100%` or `_id` no longer match unrelated contacts through SQL `LIKE` wildcards. (#41891) Thanks @Kaneki-x.
- Gateway/usage: include reset and deleted archived session transcripts in usage totals, session discovery, and archived-only session detail fallback so the Usage view no longer undercounts rotated sessions. (#43215) Thanks @rcrick.

### v2026.3.28
- Providers/Qwen: remove the deprecated `qwen-portal-auth` OAuth integration for `portal.qwen.ai`; migrate to Model Studio with `openclaw onboard --auth-choice modelstudio-api-key`. (#52709) Thanks @pomelo-nwu.
- Config/Doctor: drop automatic config migrations older than two months; very old legacy keys now fail validation instead of being rewritten on load or by `openclaw doctor`.

### v2026.3.31
- Nodes/exec: remove the duplicated `nodes.run` shell wrapper from the CLI and agent `nodes` tool so node shell execution always goes through `exec host=node`, keeping node-specific capabilities on `nodes invoke` and the dedicated media/location/notify actions.
- Plugin SDK: deprecate the legacy provider compat subpaths plus the older bundled provider setup and channel-runtime compatibility shims, emit migration warnings, and keep the current documented `openclaw/plugin-sdk/*` entrypoints plus local `api.ts` / `runtime-api.ts` barrels as the forward path ahead of a future major-release removal.
- Skills/install and Plugins/install: built-in dangerous-code `critical` findings and install-time scan failures now fail closed by default, so plugin installs and gateway-backed skill dependency installs that previously succeeded may now require an explicit dangerous override such as `--dangerously-force-unsafe-install` to proceed.
- Gateway/auth: `trusted-proxy` now rejects mixed shared-token configs, and local-direct fallback requires the configured token instead of implicitly authenticating same-host callers. Thanks @zhangning-agent, @jacobtomlinson, and @vincentkoc.
- Gateway/node commands: node commands now stay disabled until node pairing is approved, so device pairing alone is no longer enough to expose declared node commands. (#57777) Thanks @jacobtomlinson.
- Gateway/node events: node-originated runs now stay on a reduced trusted surface, so notification-driven or node-triggered flows that previously relied on broader host/session tool access may need adjustment. (#57691) Thanks @jacobtomlinson.

### v2026.4.2
- Plugins/xAI: move `x_search` settings from the legacy core `tools.web.x_search.*` path to the plugin-owned `plugins.entries.xai.config.xSearch.*` path, standardize `x_search` auth on `plugins.entries.xai.config.webSearch.apiKey` / `XAI_API_KEY`, and migrate legacy config with `openclaw doctor --fix`. (#59674) Thanks @vincentkoc.
- Plugins/web fetch: move Firecrawl `web_fetch` config from the legacy core `tools.web.fetch.firecrawl.*` path to the plugin-owned `plugins.entries.firecrawl.config.webFetch.*` path, route `web_fetch` fallback through the new fetch-provider boundary instead of a Firecrawl-only core branch, and migrate legacy config with `openclaw doctor --fix`. (#59465) Thanks @vincentkoc.

### v2026.4.5
- Config: remove legacy public config aliases such as `talk.voiceId` / `talk.apiKey`, `agents.*.sandbox.perSession`, `browser.ssrfPolicy.allowPrivateNetwork`, `hooks.internal.handlers`, and channel/group/room `allow` toggles in favor of the canonical public paths and `enabled`, while keeping load-time compatibility and `openclaw doctor --fix` migration support for existing configs. (#60726) Thanks @vincentkoc.

---

## 🔄 Recommended Sync Order

The following is the recommended version-by-version sync sequence.
Each version should be merged, conflicts resolved, and tests run before proceeding to the next.

1. **v2026.3.7** ⚠️ BREAKING — 27 changes, 313 fixes
2. **v2026.3.8** — 11 changes, 46 fixes
3. **v2026.3.11** ⚠️ BREAKING — 15 changes, 92 fixes
4. **v2026.3.12** — 7 changes, 67 fixes
5. **v2026.3.22** ⚠️ BREAKING — 74 changes, 220 fixes
6. **v2026.3.23** — 3 changes, 47 fixes
7. **v2026.3.24** — 18 changes, 15 fixes
8. **v2026.3.28** ⚠️ BREAKING — 21 changes, 97 fixes
9. **v2026.3.31** ⚠️ BREAKING — 29 changes, 60 fixes
10. **v2026.4.1** — 14 changes, 40 fixes
11. **v2026.4.2** ⚠️ BREAKING — 15 changes, 50 fixes
12. **v2026.4.5** ⚠️ BREAKING — 38 changes, 188 fixes
13. **v2026.4.7** — 18 changes, 71 fixes
14. **v2026.4.8** — 0 changes, 8 fixes
15. **v2026.4.9** — 5 changes, 34 fixes
16. **v2026.4.10** — 17 changes, 99 fixes
17. **v2026.4.11** — 9 changes, 16 fixes
18. **v2026.4.12** — 0 changes, 0 fixes
19. **v2026.4.14** 🎯 INJECTION ALERT — 0 changes, 0 fixes

---

## 📋 Detailed Changelogs (Per Version)

---

### 📦 v2026.3.7 (2026-03-08)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.3.7)

> [!CAUTION]
> **Injection Point Impact Detected:**
> - **src/config/io.ts** (matched: `loadConfig`)
> - **src/plugins/registry.ts** (matched: `registerPlugin`)

> [!NOTE]
> **DeXMart-relevant keywords:** `registerHttp`, `whatsapp`, `telegram`, `billing`

#### ⚠️ Breaking Changes

- **BREAKING:** Gateway auth now requires explicit `gateway.auth.mode` when both `gateway.auth.token` and `gateway.auth.password` are configured (including SecretRefs). Set `gateway.auth.mode` to `token` or `password` before upgrade to avoid startup/pairing/TUI failures. (#35094) Thanks @joshavant.

#### Changes (Features)

- Agents/context engine plugin interface: add `ContextEngine` plugin slot with full lifecycle hooks (`bootstrap`, `ingest`, `assemble`, `compact`, `afterTurn`, `prepareSubagentSpawn`, `onSubagentEnded`), slot-based registry with config-driven resolution, `LegacyContextEngine` wrapper preserving existing compaction behavior, scoped subagent runtime for plugin runtimes via `AsyncLocalStorage`, and `sessions.get` gateway method. Enables plugins like `lossless-claw` to provide alternative context management strategies without modifying core compaction logic. Zero behavior change when no context engine plugin is configured. (#22201) thanks @jalehman.
- ACP/persistent channel bindings: add durable Discord channel and Telegram topic binding storage, routing resolution, and CLI/docs support so ACP thread targets survive restarts and can be managed consistently. (#34873) Thanks @dutifulbob.
- Telegram/ACP topic bindings: accept Telegram Mac Unicode dash option prefixes in `/acp spawn`, support Telegram topic thread binding (`--thread here|auto`), route bound-topic follow-ups to ACP sessions, add actionable Telegram approval buttons with prefixed approval-id resolution, and pin successful bind confirmations in-topic. (#36683) Thanks @huntharo.
- Telegram/topic agent routing: support per-topic `agentId` overrides in forum groups and DM topics so topics can route to dedicated agents with isolated sessions. (#33647; based on #31513) Thanks @kesor and @Sid-Qin.
- Web UI/i18n: add Spanish (`es`) locale support in the Control UI, including locale detection, lazy loading, and language picker labels across supported locales. (#35038) Thanks @DaoPromociones.
- Onboarding/web search: add provider selection step and full provider list in configure wizard, with SecretRef ref-mode support during onboarding. (#34009) Thanks @kesku and @thewilloftheshadow.
- Tools/Web search: switch Perplexity provider to Search API with structured results plus new language/region/time filters. (#33822) Thanks @kesku.
- Gateway: add SecretRef support for gateway.auth.token with auth-mode guardrails. (#35094) Thanks @joshavant.
- Docker/Podman extension dependency baking: add `OPENCLAW_EXTENSIONS` so container builds can preinstall selected bundled extension npm dependencies into the image for faster and more reproducible startup in container deployments. (#32223) Thanks @sallyom.
- Plugins/before_prompt_build system-context fields: add `prependSystemContext` and `appendSystemContext` so static plugin guidance can be placed in system prompt space for provider caching and lower repeated prompt token cost. (#35177) thanks @maweibin.
- Plugins/hook policy: add `plugins.entries.<id>.hooks.allowPromptInjection`, validate unknown typed hook names at runtime, and preserve legacy `before_agent_start` model/provider overrides while stripping prompt-mutating fields when prompt injection is disabled. (#36567) thanks @gumadeiras.
- Hooks/Compaction lifecycle: emit `session:compact:before` and `session:compact:after` internal events plus plugin compaction callbacks with session/count metadata, so automations can react to compaction runs consistently. (#16788) thanks @vincentkoc.
- Agents/compaction post-context configurability: add `agents.defaults.compaction.postCompactionSections` so deployments can choose which `AGENTS.md` sections are re-injected after compaction, while preserving legacy fallback behavior when the documented default pair is configured in any order. (#34556) thanks @efe-arv.
- TTS/OpenAI-compatible endpoints: add `messages.tts.openai.baseUrl` config support with config-over-env precedence, endpoint-aware directive validation, and OpenAI TTS request routing to the resolved base URL. (#34321) thanks @RealKai42.
- Slack/DM typing feedback: add `channels.slack.typingReaction` so Socket Mode DMs can show reaction-based processing status even when Slack native assistant typing is unavailable. (#19816) Thanks @dalefrieswthat.
- Discord/allowBots mention gating: add `allowBots: "mentions"` to only accept bot-authored messages that mention the bot. Thanks @thewilloftheshadow.
- Agents/tool-result truncation: preserve important tail diagnostics by using head+tail truncation for oversized tool results while keeping configurable truncation options. (#20076) thanks @jlwestsr.
- Cron/job snapshot persistence: skip backup during normalization persistence in `ensureLoaded` so `jobs.json.bak` keeps the pre-edit snapshot for recovery, while preserving backup creation on explicit user-driven writes. (#35234) Thanks @0xsline.
- CLI: make read-only SecretRef status flows degrade safely (#37023) thanks @joshavant.
- Tools/Diffs guidance: restore a short system-prompt hint for enabled diffs while keeping the detailed instructions in the companion skill, so diffs usage guidance stays out of user-prompt space. (#36904) thanks @gumadeiras.
- Tools/Diffs guidance loading: move diffs usage guidance from unconditional prompt-hook injection to the plugin companion skill path, reducing unrelated-turn prompt noise while keeping diffs tool behavior unchanged. (#32630) thanks @sircrumpet.
- Docs/Web search: remove outdated Brave free-tier wording and replace prescriptive AI ToS guidance with neutral compliance language in Brave setup docs. (#26860) Thanks @HenryLoenwind.
- Config/Compaction safeguard tuning: expose `agents.defaults.compaction.recentTurnsPreserve` and quality-guard retry knobs through the validated config surface and embedded-runner wiring, with regression coverage for real config loading and schema metadata. (#25557) thanks @rodrigouroz.
- iOS/App Store Connect release prep: align iOS bundle identifiers under `ai.openclaw.client`, refresh Watch app icons, add Fastlane metadata/screenshot automation, and support Keychain-backed ASC auth for uploads. (#38936) Thanks @ngutman.
- Mattermost/model picker: add Telegram-style interactive provider/model browsing for `/oc_model` and `/oc_models`, fix picker callback updates, and emit a normal confirmation reply when a model is selected. (#38767) thanks @mukhtharcm.
- Docker/multi-stage build: restructure Dockerfile as a multi-stage build to produce a minimal runtime image without build tools, source code, or Bun; add `OPENCLAW_VARIANT=slim` build arg for a bookworm-slim variant. (#38479) Thanks @sallyom.
- Google/Gemini 3.1 Flash-Lite: add first-class `google/gemini-3.1-flash-lite-preview` support across model-id normalization, default aliases, media-understanding image lookups, Google Gemini CLI forward-compat fallback, and docs.

#### Fixes

- Models/MiniMax: stop advertising removed `MiniMax-M2.5-Lightning` in built-in provider catalogs, onboarding metadata, and docs; keep the supported fast-tier model as `MiniMax-M2.5-highspeed`.
- Security/Config: fail closed when `loadConfig()` hits validation or read errors so invalid configs cannot silently fall back to permissive runtime defaults. (#9040) Thanks @joetomasone.
- Memory/Hybrid search: preserve negative FTS5 BM25 relevance ordering in `bm25RankToScore()` so stronger keyword matches rank above weaker ones instead of collapsing or reversing scores. (#33757) Thanks @lsdcc01.
- LINE/`requireMention` group gating: align inbound and reply-stage LINE group policy resolution across raw, `group:`, and `room:` keys (including account-scoped group config), preserve plugin-backed reply-stage fallback behavior, and add regression coverage for prefixed-only group/room config plus reply-stage policy resolution. (#35847) Thanks @kirisame-wang.
- Onboarding/local setup: default unset local `tools.profile` to `coding` instead of `messaging`, restoring file/runtime tools for fresh local installs while preserving explicit user-set profiles. (from #38241, overlap with #34958) Thanks @cgdusek.
- Gateway/Telegram stale-socket restart guard: only apply stale-socket restarts to channels that publish event-liveness timestamps, preventing Telegram providers from being misclassified as stale solely due to long uptime and avoiding restart/pairing storms after upgrade. (openclaw#38464)
- Onboarding/headless Linux daemon probe hardening: treat `systemctl --user is-enabled` probe failures as non-fatal during daemon install flow so onboarding no longer crashes on SSH/headless VPS environments before showing install guidance. (#37297) Thanks @acarbajal-web.
- Memory/QMD mcporter Windows spawn hardening: when `mcporter.cmd` launch fails with `spawn EINVAL`, retry via bare `mcporter` shell resolution so QMD recall can continue instead of falling back to builtin memory search. (#27402) Thanks @i0ivi0i.
- Tools/web_search Brave language-code validation: align `search_lang` handling with Brave-supported codes (including `zh-hans`, `zh-hant`, `en-gb`, and `pt-br`), map common alias inputs (`zh`, `ja`) to valid Brave values, and reject unsupported codes before upstream requests to prevent 422 failures. (#37260) Thanks @heyanming.
- Models/openai-completions streaming compatibility: force `compat.supportsUsageInStreaming=false` for non-native OpenAI-compatible endpoints during model normalization, preventing usage-only stream chunks from triggering `choices[0]` parser crashes in provider streams. (#8714) Thanks @nonanon1.
- Tools/xAI native web-search collision guard: drop OpenClaw `web_search` from tool registration when routing to xAI/Grok model providers (including OpenRouter `x-ai/*`) to avoid duplicate tool-name request failures against provider-native `web_search`. (#14749) Thanks @realsamrat.
- TUI/token copy-safety rendering: treat long credential-like mixed alphanumeric tokens (including quoted forms) as copy-sensitive in render sanitization so formatter hard-wrap guards no longer inject visible spaces into auth-style values before display. (#26710) Thanks @jasonthane.
- WhatsApp/self-chat response prefix fallback: stop forcing `"[openclaw]"` as the implicit outbound response prefix when no identity name or response prefix is configured, so blank/default prefix settings no longer inject branding text unexpectedly in self-chat flows. (#27962) Thanks @ecanmor.
- Memory/QMD search result decoding: accept `qmd search` hits that only include `file` URIs (for example `qmd://collection/path.md`) without `docid`, resolve them through managed collection roots, and keep multi-collection results keyed by file fallback so valid QMD hits no longer collapse to empty `memory_search` output. (#28181) Thanks @0x76696265.
- Memory/QMD collection-name conflict recovery: when `qmd collection add` fails because another collection already occupies the same `path + pattern`, detect the conflicting collection from `collection list`, remove it, and retry add so agent-scoped managed collections are created deterministically instead of being silently skipped; also add warning-only fallback when qmd metadata is unavailable to avoid destructive guesses. (#25496) Thanks @Ramsbaby.
- Slack/app_mention race dedupe: when `app_mention` dispatch wins while same-`ts` `message` prepare is still in-flight, suppress the later message dispatch so near-simultaneous Slack deliveries do not produce duplicate replies; keep single-retry behavior and add regression coverage for both dropped and successful message-prepare outcomes. (#37033) Thanks @Takhoffman.
- Gateway/chat streaming tool-boundary text retention: merge assistant delta segments into per-run chat buffers so pre-tool text is preserved in live chat deltas/finals when providers emit post-tool assistant segments as non-prefix snapshots. (#36957) Thanks @Datyedyeguy.
- TUI/model indicator freshness: prevent stale session snapshots from overwriting freshly patched model selection (and reset per-session freshness when switching session keys) so `/model` updates reflect immediately instead of lagging by one or more commands. (#21255) Thanks @kowza.
- TUI/final-error rendering fallback: when a chat `final` event has no renderable assistant content but includes envelope `errorMessage`, render the formatted error text instead of collapsing to `"(no output)"`, preserving actionable failure context in-session. (#14687) Thanks @Mquarmoc.
- TUI/session-key alias event matching: treat chat events whose session keys are canonical aliases (for example `agent:<id>:main` vs `main`) as the same session while preserving cross-agent isolation, so assistant replies no longer disappear or surface in another terminal window due to strict key-form mismatch. (#33937) Thanks @yjh1412.
- OpenAI Codex OAuth/login parity: keep `openclaw models auth login --provider openai-codex` on the built-in path even without provider plugins, preserve Pi-generated authorize URLs without local scope rewriting, and stop validating successful Codex sign-ins against the public OpenAI Responses API after callback. (#37558; follow-up to #36660 and #24720) Thanks @driesvints, @Skippy-Gunboat, and @obviyus.
- Agents/config schema lookup: add `gateway` tool action `config.schema.lookup` so agents can inspect one config path at a time before edits without loading the full schema into prompt context. (#37266) Thanks @gumadeiras.
- Onboarding/API key input hardening: strip non-Latin1 Unicode artifacts from normalized secret input (while preserving Latin-1 content and internal spaces) so malformed copied API keys cannot trigger HTTP header `ByteString` construction crashes; adds regression coverage for shared normalization and MiniMax auth header usage. (#24496) Thanks @fa6maalassaf.
- Kimi Coding/Anthropic tools compatibility: normalize `anthropic-messages` tool payloads to OpenAI-style `tools[].function` + compatible `tool_choice` when targeting Kimi Coding endpoints, restoring tool-call workflows that regressed after v2026.3.2. (#37038) Thanks @mochimochimochi-hub.
- Heartbeat/workspace-path guardrails: append explicit workspace `HEARTBEAT.md` path guidance (and `docs/heartbeat.md` avoidance) to heartbeat prompts so heartbeat runs target workspace checklists reliably across packaged install layouts. (#37037) Thanks @stofancy.
- Subagents/kill-complete announce race: when a late `subagent-complete` lifecycle event arrives after an earlier kill marker, clear stale kill suppression/cleanup flags and re-run announce cleanup so finished runs no longer get silently swallowed. (#37024) Thanks @cmfinlan.
- Agents/tool-result cleanup timeout hardening: on embedded runner teardown idle timeouts, clear pending tool-call state without persisting synthetic `missing tool result` entries, preventing timeout cleanups from poisoning follow-up turns; adds regression coverage for timeout clear-vs-flush behavior. (#37081) Thanks @Coyote-Den.
- Agents/openai-completions stream timeout hardening: ensure runtime undici global dispatchers use extended streaming body/header timeouts (including env-proxy dispatcher mode) before embedded runs, reducing forced mid-stream `terminated` failures on long generations; adds regression coverage for dispatcher selection and idempotent reconfiguration. (#9708) Thanks @scottchguard.
- Agents/fallback cooldown probe execution: thread explicit rate-limit cooldown probe intent from model fallback into embedded runner auth-profile selection so same-provider fallback attempts can actually run when all profiles are cooldowned for `rate_limit` (instead of failing pre-run as `No available auth profile`), while preserving default cooldown skip behavior and adding regression tests at both fallback and runner layers. (#13623) Thanks @asfura.
- Cron/OpenAI Codex OAuth refresh hardening: when `openai-codex` token refresh fails specifically on account-id extraction, reuse the cached access token instead of failing the run immediately, with regression coverage to keep non-Codex and unrelated refresh failures unchanged. (#36604) Thanks @laulopezreal.
- TUI/session isolation for `/new`: make `/new` allocate a unique `tui-<uuid>` session key instead of resetting the shared agent session, so multiple TUI clients on the same agent stop receiving each other’s replies; also sanitize `/new` and `/reset` failure text before rendering in-terminal. Landed from contributor PR #39238 by @widingmarcus-cyber. Thanks @widingmarcus-cyber.
- Synology Chat/rate-limit env parsing: honor `SYNOLOGY_RATE_LIMIT=0` as an explicit value while still falling back to the default limit for malformed env values instead of partially parsing them. Landed from contributor PR #39197 by @scoootscooob. Thanks @scoootscooob.
- Voice-call/OpenAI Realtime STT config defaults: honor explicit `vadThreshold: 0` and `silenceDurationMs: 0` instead of silently replacing them with defaults. Landed from contributor PR #39196 by @scoootscooob. Thanks @scoootscooob.
- Voice-call/OpenAI TTS speed config: honor explicit `speed: 0` instead of silently replacing it with the default speed. Landed from contributor PR #39318 by @ql-wade. Thanks @ql-wade.
- launchd/runtime PID parsing: reject `pid <= 0` from `launchctl print` so the daemon state parser no longer treats kernel/non-running sentinel values as real process IDs. Landed from contributor PR #39281 by @mvanhorn. Thanks @mvanhorn.
- Cron/file permission hardening: enforce owner-only (`0600`) cron store/backup/run-log files and harden cron store + run-log directories to `0700`, including pre-existing directories from older installs. (#36078) Thanks @aerelune.
- Gateway/remote WS break-glass hostname support: honor `OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1` for `ws://` hostname URLs (not only private IP literals) across onboarding validation and runtime gateway connection checks, while still rejecting public IP literals and non-unicast IPv6 endpoints. (#36930) Thanks @manju-rn.
- Routing/binding lookup scalability: pre-index route bindings by channel/account and avoid full binding-list rescans on channel-account cache rollover, preventing multi-second `resolveAgentRoute` stalls in large binding configurations. (#36915) Thanks @songchenghao.
- Browser/session cleanup: track browser tabs opened by session-scoped browser tool runs and close tracked tabs during `sessions.reset`/`sessions.delete` runtime cleanup, preventing orphaned tabs and unbounded browser memory growth after session teardown. (#36666) Thanks @Harnoor6693.
- Plugin/hook install rollback hardening: stage installs under the canonical install base, validate and run dependency installs before publish, and restore updates by rename instead of deleting the target path, reducing partial-replace and symlink-rebind risk during install failures.
- Slack/local file upload allowlist parity: propagate `mediaLocalRoots` through the Slack send action pipeline so workspace-rooted attachments pass `assertLocalMediaAllowed` checks while non-allowlisted paths remain blocked. (synthesis: #36656; overlap considered from #36516, #36496, #36493, #36484, #32648, #30888) Thanks @2233admin.
- Agents/compaction safeguard pre-check: skip embedded compaction before entering the Pi SDK when a session has no real conversation messages, avoiding unnecessary LLM API calls on idle sessions. (#36451) thanks @Sid-Qin.
- Config/schema cache key stability: build merged schema cache keys with incremental hashing to avoid large single-string serialization and prevent `RangeError: Invalid string length` on high-cardinality plugin/channel metadata. (#36603) Thanks @powermaster888.
- iMessage/cron completion announces: strip leaked inline reply tags (for example `[[reply_to:6100]]`) from user-visible completion text so announcement deliveries do not expose threading metadata. (#24600) Thanks @vincentkoc.
- Control UI/iMessage duplicate reply routing: keep internal webchat turns on dispatcher delivery (instead of origin-channel reroute) so Control UI chats do not duplicate replies into iMessage, while preserving webchat-provider relayed routing for external surfaces. Fixes #33483. Thanks @alicexmolt.
- Sessions/daily reset transcript archival: archive prior transcript files during stale-session scheduled/daily resets by capturing the previous session entry before rollover, preventing orphaned transcript files on disk. (#35493) Thanks @byungsker.
- Feishu/group slash command detection: normalize group mention wrappers before command-authorization probing so mention-prefixed commands (for example `@Bot/model` and `@Bot /reset`) are recognized as gateway commands instead of being forwarded to the agent. (#35994) Thanks @liuxiaopai-ai.
- Control UI/auth token separation: keep the shared gateway token in browser auth validation while reserving cached device tokens for signed device payloads, preventing false `device token mismatch` disconnects after restart/rotation. Landed from contributor PR #37382 by @FradSer. Thanks @FradSer.
- Gateway/browser auth reconnect hardening: stop counting missing token/password submissions as auth rate-limit failures, and stop auto-reconnecting Control UI clients on non-recoverable auth errors so misconfigured browser tabs no longer lock out healthy sessions. Landed from contributor PR #38725 by @ademczuk. Thanks @ademczuk.
- Gateway/service token drift repair: stop persisting shared auth tokens into installed gateway service units, flag stale embedded service tokens for reinstall, and treat tokenless service env as canonical so token rotation/reboot flows stay aligned with config/env resolution. Landed from contributor PR #28428 by @l0cka. Thanks @l0cka.
- Control UI/agents-page selection: keep the edited agent selected after saving agent config changes and reloading the agents list, so `/agents` no longer snaps back to the default agent. Landed from contributor PR #39301 by @MumuTW. Thanks @MumuTW.
- Gateway/auth follow-up hardening: preserve systemd `EnvironmentFile=` precedence/source provenance in daemon audits and doctor repairs, block shared-password override flows from piggybacking cached device tokens, and fail closed when config-first gateway SecretRefs cannot resolve. Follow-up to #39241.
- Agents/context pruning: guard assistant thinking/text char estimation against malformed blocks (missing `thinking`/`text` strings or null entries) so pruning no longer crashes with malformed provider content. (openclaw#35146) thanks @Sid-Qin.
- Agents/transcript policy: set `preserveSignatures` to Anthropic-only handling in `resolveTranscriptPolicy` so Anthropic thinking signatures are preserved while non-Anthropic providers remain unchanged. (#32813) thanks @Sid-Qin.
- Agents/schema cleaning: detect Venice + Grok model IDs as xAI-proxied targets so unsupported JSON Schema keywords are stripped before requests, preventing Venice/Grok `Invalid arguments` failures. (openclaw#35355) thanks @Sid-Qin.
- Skills/native command deduplication: centralize skill command dedupe by canonical `skillName` in `listSkillCommandsForAgents` so duplicate suffixed variants (for example `_2`) are no longer surfaced across interfaces outside Discord. (#27521) thanks @shivama205.
- Agents/xAI tool-call argument decoding: decode HTML-entity encoded xAI/Grok tool-call argument values (`&amp;`, `&quot;`, `&lt;`, `&gt;`, numeric entities) before tool execution so commands with shell operators and quotes no longer fail with parse errors. (#35276) Thanks @Sid-Qin.
- Linux/WSL2 daemon install hardening: add regression coverage for WSL environment detection, WSL-specific systemd guidance, and `systemctl --user is-enabled` failure paths so WSL2/headless onboarding keeps treating bus-unavailable probes as non-fatal while preserving real permission errors. Related: #36495. Thanks @vincentkoc.
- Linux/systemd status and degraded-session handling: treat degraded-but-reachable `systemctl --user status` results as available, preserve early errors for truly unavailable user-bus cases, and report externally managed running services as running instead of `not installed`. Thanks @vincentkoc.
- Agents/thinking-tag promotion hardening: guard `promoteThinkingTagsToBlocks` against malformed assistant content entries (`null`/`undefined`) before `block.type` reads so malformed provider payloads no longer crash session processing while preserving pass-through behavior. (#35143) thanks @Sid-Qin.
- Gateway/Control UI version reporting: align runtime and browser client version metadata to avoid `dev` placeholders, wait for bootstrap version before first UI websocket connect, and only forward bootstrap `serverVersion` to same-origin gateway targets to prevent cross-target version leakage. (from #35230, #30928, #33928) Thanks @Sid-Qin, @joelnishanth, and @MoerAI.
- Control UI/markdown parser crash fallback: catch `marked.parse()` failures and fall back to escaped plain-text `<pre>` rendering so malformed recursive markdown no longer crashes Control UI session rendering on load. (#36445) Thanks @BinHPdev.
- Control UI/markdown fallback regression coverage: add explicit regression assertions for parser-error fallback behavior so malformed markdown no longer risks reintroducing hard-crash rendering paths in future markdown/parser upgrades. (#36445) Thanks @BinHPdev.
- Web UI/config form: treat `additionalProperties: true` object schemas as editable map entries instead of unsupported fields so Accounts-style maps stay editable in form mode. (#35380, supersedes #32072) Thanks @stakeswky and @liuxiaopai-ai.
- Feishu/streaming card delivery synthesis: unify snapshot and delta streaming merge semantics, apply overlap-aware final merge, suppress duplicate final text delivery (including text+media final packets), prefer topic-thread `message.reply` routing when a reply target exists, and tune card print cadence to avoid duplicate incremental rendering. (from #33245, #32896, #33840) Thanks @rexl2018, @kcinzgg, and @aerelune.
- Feishu/group mention detection: carry startup-probed bot display names through monitor dispatch so `requireMention` checks compare against current bot identity instead of stale config names, fixing missed `@bot` handling in groups while preserving multi-bot false-positive guards. (#36317, #34271) Thanks @liuxiaopai-ai.
- Security/dependency audit: patch transitive Hono vulnerabilities by pinning `hono` to `4.12.5` and `@hono/node-server` to `1.19.10` in production resolution paths. Thanks @shakkernerd.
- Security/dependency audit: bump `tar` to `7.5.10` (from `7.5.9`) to address the high-severity hardlink path traversal advisory (`GHSA-qffp-2rhf-9h96`). Thanks @shakkernerd.
- Cron/announce delivery robustness: bypass pending-descendant announce guards for cron completion sends, ensure named-agent announce routes have outbound session entries, and fall back to direct delivery only when an announce send was actually attempted and failed. (from #35185, #32443, #34987) Thanks @Sid-Qin, @scoootscooob, and @bmendonca3.
- Cron/announce best-effort fallback: run direct outbound fallback after attempted announce failures even when delivery is configured as best-effort, so Telegram cron sends are not left as attempted-but-undelivered after `cron announce delivery failed` warnings.
- Auto-reply/system events: restore runtime system events to the message timeline (`System:` lines), preserve think-hint parsing with prepended events, and carry events into deferred followup/collect/steer-backlog prompts to keep cache behavior stable without dropping queued metadata. (#34794) Thanks @anisoptera.
- Security/audit account handling: avoid prototype-chain account IDs in audit validation by using own-property checks for `accounts`. (#34982) Thanks @HOYALIM.
- Cron/restart catch-up semantics: replay interrupted recurring jobs and missed immediate cron slots on startup without replaying interrupted one-shot jobs, with guarded missed-slot probing to avoid malformed-schedule startup aborts and duplicate-trigger drift after restart. (from #34466, #34896, #34625, #33206) Thanks @dunamismax, @dsantoreis, @Octane0411, and @Sid-Qin.
- Venice/provider onboarding hardening: align per-model Venice completion-token limits with discovery metadata, clamp untrusted discovery values to safe bounds, sync the static Venice fallback catalog with current live model metadata, and disable tool wiring for Venice models that do not support function calling so default Venice setups no longer fail with `max_completion_tokens` or unsupported-tools 400s. Fixes #38168. Thanks @Sid-Qin, @powermaster888 and @vincentkoc.
- Agents/session usage tracking: preserve accumulated usage metadata on embedded Pi runner error exits so failed turns still update session `totalTokens` from real usage instead of stale prior values. (#34275) thanks @RealKai42.
- Slack/reaction thread context routing: carry Slack native DM channel IDs through inbound context and threading tool resolution so reaction targets resolve consistently for DM `To=user:*` sessions (including `toolContext.currentChannelId` fallback behavior). (from #34831; overlaps #34440, #34502, #34483, #32754) Thanks @dunamismax.
- Subagents/announce completion scoping: scope nested direct-child completion aggregation to the current requester run window, harden frozen completion capture for deterministic descendant synthesis, and route completion announce delivery through parent-agent announce turns with provenance-aware internal events. (#35080) Thanks @tyler6204.
- Nodes/system.run approval hardening: use explicit argv-mutation signaling when regenerating prepared `rawCommand`, and cover the `system.run.prepare -> system.run` handoff so direct PATH-based `nodes.run` commands no longer fail with `rawCommand does not match command`. (#33137) thanks @Sid-Qin.
- Models/custom provider headers: propagate `models.providers.<name>.headers` across inline, fallback, and registry-found model resolution so header-authenticated proxies consistently receive configured request headers. (#27490) thanks @Sid-Qin.
- Ollama/remote provider auth fallback: synthesize a local runtime auth key for explicitly configured `models.providers.ollama` entries that omit `apiKey`, so remote Ollama endpoints run without requiring manual dummy-key setup while preserving env/profile/config key precedence and missing-config failures. (#11283) Thanks @cpreecs.
- Ollama/custom provider headers: forward resolved model headers into native Ollama stream requests so header-authenticated Ollama proxies receive configured request headers. (#24337) thanks @echoVic.
- Ollama/compaction and summarization: register custom `api: "ollama"` handling for compaction, branch-style internal summarization, and TTS text summarization on current `main`, so native Ollama models no longer fail with `No API provider registered for api: ollama` outside the main run loop. Thanks @JaviLib.
- Daemon/systemd install robustness: treat `systemctl --user is-enabled` exit-code-4 `not-found` responses as not-enabled by combining stderr/stdout detail parsing, so Ubuntu fresh installs no longer fail with `systemctl is-enabled unavailable`. (#33634) Thanks @Yuandiaodiaodiao.
- Slack/system-event session routing: resolve reaction/member/pin/interaction system-event session keys through channel/account bindings (with sender-aware DM routing) so inbound Slack events target the correct agent session in multi-account setups instead of defaulting to `agent:main`. (#34045) Thanks @paulomcg, @daht-mad and @vincentkoc.
- Slack/native streaming markdown conversion: stop pre-normalizing text passed to Slack native `markdown_text` in streaming start/append/stop paths to prevent Markdown style corruption from double conversion. (#34931)
- Gateway/HTTP tools invoke media compatibility: preserve raw media payload access for direct `/tools/invoke` clients by allowing media `nodes` invoke commands only in HTTP tool context, while keeping agent-context media invoke blocking to prevent base64 prompt bloat. (#34365) Thanks @obviyus.
- Security/archive ZIP hardening: extract ZIP entries via same-directory temp files plus atomic rename, then re-open and reject post-rename hardlink alias races outside the destination root.
- Agents/Nodes media outputs: add dedicated `photos_latest` action handling, block media-returning `nodes invoke` commands, keep metadata-only `camera.list` invoke allowed, and normalize empty `photos_latest` results to a consistent response shape to prevent base64 context bloat. (#34332) Thanks @obviyus.
- TUI/session-key canonicalization: normalize `openclaw tui --session` values to lowercase so uppercase session names no longer drop real-time streaming updates due to gateway/TUI key mismatches. (#33866, #34013) thanks @lynnzc.
- iMessage/echo loop hardening: strip leaked assistant-internal scaffolding from outbound iMessage replies, drop reflected assistant-content messages before they re-enter inbound processing, extend echo-cache text retention for delayed reflections, and suppress repeated loop traffic before it amplifies into queue overflow. (#33295) Thanks @joelnishanth.
- Skills/workspace boundary hardening: reject workspace and extra-dir skill roots or `SKILL.md` files whose realpath escapes the configured source root, and skip syncing those escaped skills into sandbox workspaces.
- Outbound/send config threading: pass resolved SecretRef config through outbound adapters and helper send paths so send flows do not reload unresolved runtime config. (#33987) Thanks @joshavant.
- gateway: harden shared auth resolution across systemd, discord, and node host (#39241) Thanks @joshavant.
- Secrets/models.json persistence hardening: keep SecretRef-managed api keys + headers from persisting in generated models.json, expand audit/apply coverage, and harden marker handling/serialization. (#38955) Thanks @joshavant.
- Sessions/subagent attachments: remove `attachments[].content.maxLength` from `sessions_spawn` schema to avoid llama.cpp GBNF repetition overflow, and preflight UTF-8 byte size before buffer allocation while keeping runtime file-size enforcement unchanged. (#33648) Thanks @anisoptera.
- Runtime/tool-state stability: recover from dangling Anthropic `tool_use` after compaction, serialize long-running Discord handler runs without blocking new inbound events, and prevent stale busy snapshots from suppressing stuck-channel recovery. (from #33630, #33583) Thanks @kevinWangSheng and @theotarr.
- ACP/Discord startup hardening: clean up stuck ACP worker children on gateway restart, unbind stale ACP thread bindings during Discord startup reconciliation, and add per-thread listener watchdog timeouts so wedged turns cannot block later messages. (#33699) Thanks @dutifulbob.
- Extensions/media local-root propagation: consistently forward `mediaLocalRoots` through extension `sendMedia` adapters (Google Chat, Slack, iMessage, Signal, WhatsApp), preserving non-local media behavior while restoring local attachment resolution from configured roots. Synthesis of #33581, #33545, #33540, #33536, #33528. Thanks @bmendonca3.
- Gateway/plugin HTTP auth hardening: require gateway auth when any overlapping matched route needs it, block mixed-auth fallthrough at dispatch, and reject mixed-auth exact/prefix route overlaps during plugin registration.
- Feishu/video media send contract: keep mp4-like outbound payloads on `msg_type: "media"` (including reply and reply-in-thread paths) so videos render as media instead of degrading to file-link behavior, while preserving existing non-video file subtype handling. (from #33720, #33808, #33678) Thanks @polooooo, @dingjianrui, and @kevinWangSheng.
- Gateway/security default response headers: add `Permissions-Policy: camera=(), microphone=(), geolocation=()` to baseline gateway HTTP security headers for all responses. (#30186) thanks @habakan.
- Plugins/startup loading: lazily initialize plugin runtime, split startup-critical plugin SDK imports into `openclaw/plugin-sdk/core` and `openclaw/plugin-sdk/telegram`, and preserve `api.runtime` reflection semantics for plugin compatibility. (#28620) thanks @hmemcpy.
- Plugins/startup performance: reduce bursty plugin discovery/manifest overhead with short in-process caches, skip importing bundled memory plugins that are disabled by slot selection, and speed legacy root `openclaw/plugin-sdk` compatibility via runtime root-alias routing while preserving backward compatibility. Thanks @gumadeiras.
- Build/lazy runtime boundaries: replace ineffective dynamic import sites with dedicated lazy runtime boundaries across Slack slash handling, Telegram audit, CLI send deps, memory fallback, and outbound delivery paths while preserving behavior. (#33690) thanks @gumadeiras.
- Gateway/password CLI hardening: add `openclaw gateway run --password-file`, warn when inline `--password` is used because it can leak via process listings, and document env/file-backed password input as the preferred startup path. Fixes #27948. Thanks @vibewrk and @vincentkoc.
- Config/heartbeat legacy-path handling: auto-migrate top-level `heartbeat` into `agents.defaults.heartbeat` (with merge semantics that preserve explicit defaults), and keep startup failures on non-migratable legacy entries in the detailed invalid-config path instead of generic migration-failed errors. (#32706) thanks @xiwan.
- Plugins/SDK subpath parity: expand plugin SDK subpaths across bundled channels/extensions (Discord, Slack, Signal, iMessage, WhatsApp, LINE, and bundled companion plugins), with build/export/type/runtime wiring so scoped imports resolve consistently in source and dist while preserving compatibility. (#33737) thanks @gumadeiras.
- Google/Gemini Flash model selection: switch built-in `gemini-flash` defaults and docs/examples from the nonexistent `google/gemini-3.1-flash-preview` ID to the working `google/gemini-3-flash-preview`, while normalizing legacy OpenClaw config that still uses the old Flash 3.1 alias.
- Plugins/bundled scoped-import migration: migrate bundled plugins from monolithic `openclaw/plugin-sdk` imports to scoped subpaths (or `openclaw/plugin-sdk/core`) across registration and startup-sensitive runtime files, add CI/release guardrails to prevent regressions, and keep root `openclaw/plugin-sdk` support for external/community plugins. Thanks @gumadeiras.
- Routing/session duplicate suppression synthesis: align shared session delivery-context inheritance, channel-paired route-field merges, and reply-surface target matching so dmScope=main turns avoid cross-surface duplicate replies while thread-aware forwarding keeps intended routing semantics. (from #33629, #26889, #17337, #33250) Thanks @Yuandiaodiaodiao, @kevinwildenradt, @Glucksberg, and @bmendonca3.
- Routing/legacy session route inheritance: preserve external route metadata inheritance for legacy channel session keys (`agent:<agent>:<channel>:<peer>` and `...:thread:<id>`) so `chat.send` does not incorrectly fall back to webchat when valid delivery context exists. Follow-up to #33786.
- Routing/legacy route guard tightening: require legacy session-key channel hints to match the saved delivery channel before inheriting external routing metadata, preventing custom namespaced keys like `agent:<agent>:work:<ticket>` from inheriting stale non-webchat routes.
- Gateway/internal client routing continuity: prevent webchat/TUI/UI turns from inheriting stale external reply routes by requiring explicit `deliver: true` for external delivery, keeping main-session external inheritance scoped to non-Webchat/UI clients, and honoring configured `session.mainKey` when identifying main-session continuity. (from #35321, #34635, #35356) Thanks @alexyyyander and @Octane0411.
- Security/auth labels: remove token and API-key snippets from user-facing auth status labels so `/status` and `/models` do not expose credential fragments. (#33262) thanks @cu1ch3n.
- Models/MiniMax portal vision routing: add `MiniMax-VL-01` to the `minimax-portal` provider, route portal image understanding through the MiniMax VLM endpoint, and align media auto-selection plus Telegram sticker description with the shared portal image provider path. (#33953) Thanks @tars90percent.
- Auth/credential semantics: align profile eligibility + probe diagnostics with SecretRef/expiry rules and harden browser download atomic writes. (#33733) thanks @joshavant.
- Security/audit denyCommands guidance: suggest likely exact node command IDs for unknown `gateway.nodes.denyCommands` entries so ineffective denylist entries are easier to correct. (#29713) thanks @liquidhorizon88-bot.
- Agents/overload failover handling: classify overloaded provider failures separately from rate limits/status timeouts, add short overload backoff before retry/failover, record overloaded prompt/assistant failures as transient auth-profile cooldowns (with probeable same-provider fallback) instead of treating them like persistent auth/billing failures, and keep one-shot cron retry classification aligned so overloaded fallback summaries still count as transient retries.
- Docs/security hardening guidance: document Docker `DOCKER-USER` + UFW policy and add cross-linking from Docker install docs for VPS/public-host setups. (#27613) thanks @dorukardahan.
- Docs/security threat-model links: replace relative `.md` links with Mintlify-compatible root-relative routes in security docs to prevent broken internal navigation. (#27698) thanks @clawdoo.
- Plugins/Update integrity drift: avoid false integrity drift prompts when updating npm-installed plugins from unpinned specs, while keeping drift checks for exact pinned versions. (#37179) Thanks @vincentkoc.
- iOS/Voice timing safety: guard system speech start/finish callbacks to the active utterance to avoid misattributed start events during rapid stop/restart cycles. (#33304) thanks @mbelinky; original implementation direction by @ngutman.
- Gateway/chat.send command scopes: require `operator.admin` for persistent `/config set|unset` writes routed through gateway chat clients while keeping `/config show` available to normal write-scoped operator clients, preserving messaging-channel config command behavior without widening RPC write scope into admin config mutation. Thanks @tdjackey for reporting.
- iOS/Talk incremental speech pacing: allow long punctuation-free assistant chunks to start speaking at safe whitespace boundaries so voice responses begin sooner instead of waiting for terminal punctuation. (#33305) thanks @mbelinky; original implementation by @ngutman.
- iOS/Watch reply reliability: make watch session activation waiters robust under concurrent requests so status/send calls no longer hang intermittently, and align delegate callbacks with Swift 6 actor safety. (#33306) thanks @mbelinky; original implementation by @Rocuts.
- Docs/tool-loop detection config keys: align `docs/tools/loop-detection.md` examples and field names with the current `tools.loopDetection` schema to prevent copy-paste validation failures from outdated keys. (#33182) Thanks @Mylszd.
- Gateway/session agent discovery: include disk-scanned agent IDs in `listConfiguredAgentIds` even when `agents.list` is configured, so disk-only/ACP agent sessions remain visible in gateway session aggregation and listings. (#32831) thanks @Sid-Qin.
- Discord/inbound debouncer: skip bot-own MESSAGE_CREATE events before they reach the debounce queue to avoid self-triggered slowdowns in busy servers. Thanks @thewilloftheshadow.
- Discord/Agent-scoped media roots: pass `mediaLocalRoots` through Discord monitor reply delivery (message + component interaction paths) so local media attachments honor per-agent workspace roots instead of falling back to default global roots. Thanks @thewilloftheshadow.
- Discord/slash command handling: intercept text-based slash commands in channels, register plugin commands as native, and send fallback acknowledgments for empty slash runs so interactions do not hang. Thanks @thewilloftheshadow.
- Discord/thread session lifecycle: reset thread-scoped sessions when a thread is archived so reopening a thread starts fresh without deleting transcript history. Thanks @thewilloftheshadow.
- Discord/presence defaults: send an online presence update on ready when no custom presence is configured so bots no longer appear offline by default. Thanks @thewilloftheshadow.
- Discord/typing cleanup: stop typing indicators after silent/NO_REPLY runs by marking the run complete before dispatch idle cleanup. Thanks @thewilloftheshadow.
- ACP/sandbox spawn parity: block `/acp spawn` from sandboxed requester sessions with the same host-runtime guard already enforced for `sessions_spawn({ runtime: "acp" })`, preserving non-sandbox ACP flows while closing the command-path policy gap. Thanks @patte.
- Discord/config SecretRef typing: align Discord account token config typing with SecretInput so SecretRef tokens typecheck. (#32490) Thanks @scoootscooob.
- Discord/voice messages: request upload slots with JSON fetch calls so voice message uploads no longer fail with content-type errors. Thanks @thewilloftheshadow.
- Discord/voice decoder fallback: drop the native Opus dependency and use opusscript for voice decoding to avoid native-opus installs. Thanks @thewilloftheshadow.
- Discord/auto presence health signal: add runtime availability-driven presence updates plus connected-state reporting to improve health monitoring and operator visibility. (#33277) Thanks @thewilloftheshadow.
- HEIC image inputs: accept HEIC/HEIF `input_image` sources in Gateway HTTP APIs, normalize them to JPEG before provider delivery, and document the expanded default MIME allowlist. Thanks @vincentkoc.
- Gateway/HEIC input follow-up: keep non-HEIC `input_image` MIME handling unchanged, make HEIC tests hermetic, and enforce chat-completions `maxTotalImageBytes` against post-normalization image payload size. Thanks @vincentkoc.
- Telegram/draft-stream boundary stability: materialize DM draft previews at assistant-message/tool boundaries, serialize lane-boundary callbacks before final delivery, and scope preview cleanup to the active preview so multi-step Telegram streams no longer lose, overwrite, or leave stale preview bubbles. (#33842) Thanks @ngutman.
- Telegram/DM draft finalization reliability: require verified final-text draft emission before treating preview finalization as delivered, and fall back to normal payload send when final draft delivery is not confirmed (preventing missing final responses and preserving media/button delivery). (#32118) Thanks @OpenCils.
- Telegram/DM draft final delivery: materialize text-only `sendMessageDraft` previews into one permanent final message and skip duplicate final payload sends, while preserving fallback behavior when materialization fails. (#34318) Thanks @Brotherinlaw-13.
- Telegram/DM draft duplicate display: clear stale DM draft previews after materializing the real final message, including threadless fallback when DM topic lookup fails, so partial streaming no longer briefly shows duplicate replies. (#36746) Thanks @joelnishanth.
- Telegram/draft preview boundary + silent-token reliability: stabilize answer-lane message boundaries across late-partial/message-start races, preserve/reset finalized preview state at the correct boundaries, and suppress `NO_REPLY` lead-fragment leaks without broad heartbeat-prefix false positives. (#33169) Thanks @obviyus.
- Telegram/native commands `commands.allowFrom` precedence: make native Telegram commands honor `commands.allowFrom` as the command-specific authorization source, including group chats, instead of falling back to channel sender allowlists. (#28216) Thanks @toolsbybuddy and @vincentkoc.
- Telegram/`groupAllowFrom` sender-ID validation: restore sender-only runtime validation so negative chat/group IDs remain invalid entries instead of appearing accepted while still being unable to authorize group access. (#37134) Thanks @qiuyuemartin-max and @vincentkoc.
- Telegram/native group command auth: authorize native commands in groups and forum topics against `groupAllowFrom` and per-group/topic sender overrides, while keeping auth rejection replies in the originating topic thread. (#39267) Thanks @edwluo.
- Telegram/named-account DMs: restore non-default-account DM routing when a named Telegram account falls back to the default agent by keeping groups fail-closed but deriving a per-account session key for DMs, including identity-link canonicalization and regression coverage for account isolation. (from #32426; fixes #32351) Thanks @chengzhichao-xydt.
- Discord/audit wildcard warnings: ignore "\*" wildcard keys when counting unresolved guild channels so doctor/status no longer warns on allow-all configs. (#33125) Thanks @thewilloftheshadow.
- Discord/channel resolution: default bare numeric recipients to channels, harden allowlist numeric ID handling with safe fallbacks, and avoid inbound WS heartbeat stalls. (#33142) Thanks @thewilloftheshadow.
- Discord/chunk delivery reliability: preserve chunk ordering when using a REST client and retry chunk sends on 429/5xx using account retry settings. (#33226) Thanks @thewilloftheshadow.
- Discord/mention handling: add id-based mention formatting + cached rewrites, resolve inbound mentions to display names, and add optional ignoreOtherMentions gating (excluding @everyone/@here). (#33224) Thanks @thewilloftheshadow.
- Discord/media SSRF allowlist: allow Discord CDN hostnames (including wildcard domains) in inbound media SSRF policy to prevent proxy/VPN fake-ip blocks. (#33275) Thanks @thewilloftheshadow.
- Telegram/device pairing notifications: auto-arm one-shot notify on `/pair qr`, auto-ping on new pairing requests, and add manual fallback via `/pair approve latest` if the ping does not arrive. (#33299) thanks @mbelinky.
- Exec heartbeat routing: scope exec-triggered heartbeat wakes to agent session keys so unrelated agents are no longer awakened by exec events, while preserving legacy unscoped behavior for non-canonical session keys. (#32724) thanks @altaywtf
- macOS/Tailscale remote gateway discovery: add a Tailscale Serve fallback peer probe path (`wss://<peer>.ts.net`) when Bonjour and wide-area DNS-SD discovery return no gateways, and refresh both discovery paths from macOS onboarding. (#32860) Thanks @ngutman.
- iOS/Gateway keychain hardening: move gateway metadata and TLS fingerprints to device keychain storage with safer migration behavior and rollback-safe writes to reduce credential loss risk during upgrades. (#33029) thanks @mbelinky.
- iOS/Concurrency stability: replace risky shared-state access in camera and gateway connection paths with lock-protected access patterns to reduce crash risk under load. (#33241) thanks @mbelinky.
- iOS/Security guardrails: limit production API-key sourcing to app config and make deep-link confirmation prompts safer by coalescing queued requests instead of silently dropping them. (#33031) thanks @mbelinky.
- iOS/TTS playback fallback: keep voice playback resilient by switching from PCM to MP3 when provider format support is unavailable, while avoiding sticky fallback on generic local playback errors. (#33032) thanks @mbelinky.
- Plugin outbound/text-only adapter compatibility: allow direct-delivery channel plugins that only implement `sendText` (without `sendMedia`) to remain outbound-capable, gracefully fall back to text delivery for media payloads when `sendMedia` is absent, and fail explicitly for media-only payloads with no text fallback. (#32788) thanks @liuxiaopai-ai.
- Telegram/multi-account default routing clarity: warn only for ambiguous (2+) account setups without an explicit default, add `openclaw doctor` warnings for missing/invalid multi-account defaults across channels, and document explicit-default guidance for channel routing and Telegram config. (#32544) thanks @Sid-Qin.
- Telegram/plugin outbound hook parity: run `message_sending` + `message_sent` in Telegram reply delivery, include reply-path hook metadata (`mediaUrls`, `threadId`), and report `message_sent.success=false` when hooks blank text and no outbound message is delivered. (#32649) Thanks @KimGLee.
- CLI/Coding-agent reliability: switch default `claude-cli` non-interactive args to `--permission-mode bypassPermissions`, auto-normalize legacy `--dangerously-skip-permissions` backend overrides to the modern permission-mode form, align coding-agent + live-test docs with the non-PTY Claude path, and emit session system-event heartbeat notices when CLI watchdog no-output timeouts terminate runs. (#28610, #31149, #34055). Thanks @niceysam, @cryptomaltese and @vincentkoc.
- Gateway/OpenAI chat completions: parse active-turn `image_url` content parts (including parameterized data URIs and guarded URL sources), forward them as multimodal `images`, accept image-only user turns, enforce per-request image-part/byte budgets, default URL-based image fetches to disabled unless explicitly enabled by config, and redact image base64 data in cache-trace/provider payload diagnostics. (#17685) Thanks @vincentkoc
- ACP/ACPX session bootstrap: retry with `sessions new` when `sessions ensure` returns no session identifiers so ACP spawns avoid `NO_SESSION`/`ACP_TURN_FAILED` failures on affected agents. (#28786, #31338, #34055). Thanks @Sid-Qin and @vincentkoc.
- ACP/sessions_spawn parent stream visibility: add `streamTo: "parent"` for `runtime: "acp"` to forward initial child-run progress/no-output/completion updates back into the requester session as system events (instead of direct child delivery), and emit a tail-able session-scoped relay log (`<sessionId>.acp-stream.jsonl`, returned as `streamLogPath` when available), improving orchestrator visibility for blocked or long-running harness turns. (#34310, #29909; reopened from #34055). Thanks @vincentkoc.
- Agents/bootstrap truncation warning handling: unify bootstrap budget/truncation analysis across embedded + CLI runtime, `/context`, and `openclaw doctor`; add `agents.defaults.bootstrapPromptTruncationWarning` (`off|once|always`, default `once`) and persist warning-signature metadata so truncation warnings are consistent and deduped across turns. (#32769) Thanks @gumadeiras.
- Agents/Skills runtime loading: propagate run config into embedded attempt and compaction skill-entry loading so explicitly enabled bundled companion skills are discovered consistently when skill snapshots do not already provide resolved entries. Thanks @gumadeiras.
- Agents/Session startup date grounding: substitute `YYYY-MM-DD` placeholders in startup/post-compaction AGENTS context and append runtime current-time lines for `/new` and `/reset` prompts so daily-memory references resolve correctly. (#32381) Thanks @chengzhichao-xydt.
- Agents/Compaction template heading alignment: update AGENTS template section names to `Session Startup`/`Red Lines` and keep legacy `Every Session`/`Safety` fallback extraction so post-compaction context remains intact across template versions. (#25098) thanks @echoVic.
- Agents/Compaction continuity: expand staged-summary merge instructions to preserve active task status, batch progress, latest user request, and follow-up commitments so compaction handoffs retain in-flight work context. (#8903) thanks @joetomasone.
- Agents/Compaction safeguard structure hardening: require exact fallback summary headings, sanitize untrusted compaction instruction text before prompt embedding, and keep structured sections when preserving all turns. (#25555) thanks @rodrigouroz.
- Gateway/status self version reporting: make Gateway self version in `openclaw status` prefer runtime `VERSION` (while preserving explicit `OPENCLAW_VERSION` override), preventing stale post-upgrade app version output. (#32655) thanks @liuxiaopai-ai.
- Memory/QMD index isolation: set `QMD_CONFIG_DIR` alongside `XDG_CONFIG_HOME` so QMD config state stays per-agent despite upstream XDG handling bugs, preventing cross-agent collection indexing and excess disk/CPU usage. (#27028) thanks @HenryLoenwind.
- Memory/QMD collection safety: stop destructive collection rebinds when QMD `collection list` only reports names without path metadata, preventing `memory search` from dropping existing collections if re-add fails. (#36870) Thanks @Adnannnnnnna.
- Memory/QMD duplicate-document recovery: detect `UNIQUE constraint failed: documents.collection, documents.path` update failures, rebuild managed collections once, and retry update so periodic QMD syncs recover instead of failing every run; includes regression coverage to avoid over-matching unrelated unique constraints. (#27649) Thanks @MiscMich.
- Memory/local embedding initialization hardening: add regression coverage for transient initialization retry and mixed `embedQuery` + `embedBatch` concurrent startup to lock single-flight initialization behavior. (#15639) thanks @SubtleSpark.
- CLI/Coding-agent reliability: switch default `claude-cli` non-interactive args to `--permission-mode bypassPermissions`, auto-normalize legacy `--dangerously-skip-permissions` backend overrides to the modern permission-mode form, align coding-agent + live-test docs with the non-PTY Claude path, and emit session system-event heartbeat notices when CLI watchdog no-output timeouts terminate runs. Related to #28261. Landed from contributor PRs #28610 and #31149. Thanks @niceysam, @cryptomaltese and @vincentkoc.
- ACP/ACPX session bootstrap: retry with `sessions new` when `sessions ensure` returns no session identifiers so ACP spawns avoid `NO_SESSION`/`ACP_TURN_FAILED` failures on affected agents. Related to #28786. Landed from contributor PR #31338. Thanks @Sid-Qin and @vincentkoc.
- LINE/auth boundary hardening synthesis: enforce strict LINE webhook authn/z boundary semantics across pairing-store account scoping, DM/group allowlist separation, fail-closed webhook auth/runtime behavior, and replay/duplication controls (including in-flight replay reservation and post-success dedupe marking). (from #26701, #26683, #25978, #17593, #16619, #31990, #26047, #30584, #18777) Thanks @bmendonca3, @davidahmann, @harshang03, @haosenwang1018, @liuxiaopai-ai, @coygeek, and @Takhoffman.
- LINE/media download synthesis: fix file-media download handling and M4A audio classification across overlapping LINE regressions. (from #26386, #27761, #27787, #29509, #29755, #29776, #29785, #32240) Thanks @kevinWangSheng, @loiie45e, @carrotRakko, @Sid-Qin, @codeafridi, and @bmendonca3.
- LINE/context and routing synthesis: fix group/room peer routing and command-authorization context propagation, and keep processing later events in mixed-success webhook batches. (from #21955, #24475, #27035, #28286) Thanks @lailoo, @mcaxtr, @jervyclaw, @Glucksberg, and @Takhoffman.
- LINE/status/config/webhook synthesis: fix status false positives from snapshot/config state and accept LINE webhook HEAD probes for compatibility. (from #10487, #25726, #27537, #27908, #31387) Thanks @BlueBirdBack, @stakeswky, @loiie45e, @puritysb, and @mcaxtr.
- LINE cleanup/test follow-ups: fold cleanup/test learnings into the synthesis review path while keeping runtime changes focused on regression fixes. (from #17630, #17289) Thanks @Clawborn and @davidahmann.
- Mattermost/interactive buttons: add interactive button send/callback support with directory-based channel/user target resolution, and harden callbacks via account-scoped HMAC verification plus sender-scoped DM routing. (#19957) thanks @tonydehnke.
- Feishu/groupPolicy legacy alias compatibility: treat legacy `groupPolicy: "allowall"` as `open` in both schema parsing and runtime policy checks so intended open-group configs no longer silently drop group messages when `groupAllowFrom` is empty. (from #36358) Thanks @Sid-Qin.
- Mattermost/plugin SDK import policy: replace remaining monolithic `openclaw/plugin-sdk` imports in Mattermost mention-gating paths/tests with scoped subpaths (`openclaw/plugin-sdk/compat` and `openclaw/plugin-sdk/mattermost`) so `pnpm check` passes `lint:plugins:no-monolithic-plugin-sdk-entry-imports` on baseline. (#36480) Thanks @Takhoffman.
- Telegram/polls: add Telegram poll action support to channel action discovery and tool/CLI poll flows, with multi-account discoverability gated to accounts that can actually execute polls (`sendMessage` + `poll`). (#36547) thanks @gumadeiras.
- Agents/failover cooldown classification: stop treating generic `cooling down` text as provider `rate_limit` so healthy models no longer show false global cooldown/rate-limit warnings while explicit `model_cooldown` markers still trigger failover. (#32972) thanks @stakeswky.
- Agents/failover service-unavailable handling: stop treating bare proxy/CDN `service unavailable` errors as provider overload while keeping them retryable via the timeout/failover path, so transient outages no longer show false rate-limit warnings or block fallback. (#36646) thanks @jnMetaCode.
- Plugins/HTTP route migration diagnostics: rewrite legacy `api.registerHttpHandler(...)` loader failures into actionable migration guidance so doctor/plugin diagnostics point operators to `api.registerHttpRoute(...)` or `registerPluginHttpRoute(...)`. (#36794) Thanks @vincentkoc
- Doctor/Heartbeat upgrade diagnostics: warn when heartbeat delivery is configured with an implicit `directPolicy` so upgrades pin direct/DM behavior explicitly instead of relying on the current default. (#36789) Thanks @vincentkoc.
- Agents/current-time UTC anchor: append a machine-readable UTC suffix alongside local `Current time:` lines in shared cron-style prompt contexts so agents can compare UTC-stamped workspace timestamps without doing timezone math. (#32423) thanks @jriff.
- Ollama/local model handling: preserve explicit lower `contextWindow` / `maxTokens` overrides during merge refresh, and keep native Ollama streamed replies from surfacing fallback `thinking` / `reasoning` text once real content starts streaming. (#39292) Thanks @vincentkoc.
- TUI/webchat command-owner scope alignment: treat internal-channel gateway sessions with `operator.admin` as owner-authorized in command auth, restoring cron/gateway/connector tool access for affected TUI/webchat sessions while keeping external channels on identity-based owner checks. (from #35666, #35673, #35704) Thanks @Naylenv, @Octane0411, and @Sid-Qin.
- Discord/inbound timeout isolation: separate inbound worker timeout tracking from listener timeout budgets so queued Discord replies are no longer dropped when listener watchdog windows expire mid-run. (#36602) Thanks @dutifulbob.
- Memory/doctor SecretRef handling: treat SecretRef-backed memory-search API keys as configured, and fail embedding setup with explicit unresolved-secret errors instead of crashing. (#36835) Thanks @joshavant.
- Memory/flush default prompt: ban timestamped variant filenames during default memory flush runs so durable notes stay in the canonical daily `memory/YYYY-MM-DD.md` file. (#34951) thanks @zerone0x.
- Agents/reply delivery timing: flush embedded Pi block replies before waiting on compaction retries so already-generated assistant replies reach channels before compaction wait completes. (#35489) thanks @Sid-Qin.
- Agents/gateway config guidance: stop exposing `config.schema` through the agent `gateway` tool, remove prompt/docs guidance that told agents to call it, and keep agents on `config.get` plus `config.patch`/`config.apply` for config changes. (#7382) thanks @kakuteki.
- Provider/KiloCode: Keep duplicate models after malformed discovery rows, and strip legacy `reasoning_effort` when proxy reasoning injection is skipped. (#32352) Thanks @pandemicsyn and @vincentkoc.
- Agents/failover: classify periodic provider limit exhaustion text (for example `Weekly/Monthly Limit Exhausted`) as `rate_limit` while keeping explicit `402 Payment Required` variants in billing, so failover continues without misclassifying billing-wrapped quota errors. (#33813) thanks @zhouhe-xydt.
- Mattermost/interactive button callbacks: allow external callback base URLs and stop requiring loopback-origin requests so button clicks work when Mattermost reaches the gateway over Tailscale, LAN, or a reverse proxy. (#37543) thanks @mukhtharcm.
- Gateway/chat.send route inheritance: keep explicit external delivery for channel-scoped sessions while preventing shared-main and other channel-agnostic webchat sessions from inheriting stale external routes, so Control UI replies stay on webchat without breaking selected channel-target sessions. (#34669) Thanks @vincentkoc.
- Telegram/Discord media upload caps: make outbound uploads honor channel `mediaMaxMb` config, raise Telegram's default media cap to 100MB, and remove MIME fallback limits that kept some Telegram uploads at 16MB. Thanks @vincentkoc.
- Skills/nano-banana-pro resolution override: respect explicit `--resolution` values during image editing and only auto-detect output size from input images when the flag is omitted. (#36880) Thanks @shuofengzhang and @vincentkoc.
- Skills/openai-image-gen CLI validation: validate `--background` and `--style` inputs early, normalize supported values, and warn when those flags are ignored for incompatible models. (#36762) Thanks @shuofengzhang and @vincentkoc.
- Skills/openai-image-gen output formats: validate `--output-format` values early, normalize aliases like `jpg -> jpeg`, and warn when the flag is ignored for incompatible models. (#36648) Thanks @shuofengzhang and @vincentkoc.
- ACP/skill env isolation: strip skill-injected API keys from ACP harness child-process environments so tools like Codex CLI keep their own auth flow instead of inheriting billed provider keys from active skills. (#36316) Thanks @taw0002 and @vincentkoc.
- WhatsApp media upload caps: make outbound media sends and auto-replies honor `channels.whatsapp.mediaMaxMb` with per-account overrides so inbound and outbound limits use the same channel config. Thanks @vincentkoc.
- Windows/Plugin install: when OpenClaw runs on Windows via Bun and `npm-cli.js` is not colocated with the runtime binary, fall back to `npm.cmd`/`npx.cmd` through the existing `cmd.exe` wrapper so `openclaw plugins install` no longer fails with `spawn EINVAL`. (#38056) Thanks @0xlin2023.
- Telegram/send retry classification: retry grammY `Network request ... failed after N attempts` envelopes in send flows without reclassifying plain `Network request ... failed!` wrappers as transient, restoring the intended retry path while keeping broad send-context message matching tight. (#38056) Thanks @0xlin2023.
- Gateway/probes: keep `/health`, `/healthz`, `/ready`, and `/readyz` reachable when the Control UI is mounted at `/`, preserve plugin-owned route precedence on those paths, and make `/ready` and `/readyz` report channel-backed readiness with startup grace plus `503` on disconnected managed channels, while `/health` and `/healthz` stay shallow liveness probes. (#18446) Thanks @vibecodooor, @mahsumaktas, and @vincentkoc.
- Feishu/media downloads: drop invalid timeout fields from SDK method calls now that client-level `httpTimeoutMs` applies to requests. (#38267) Thanks @ant1eicher and @thewilloftheshadow.
- PI embedded runner/Feishu docs: propagate sender identity into embedded attempts so Feishu doc auto-grant restores requester access for embedded-runner executions. (#32915) thanks @cszhouwei.
- Agents/usage normalization: normalize missing or partial assistant usage snapshots before compaction accounting so `openclaw agent --json` no longer crashes when provider payloads omit `totalTokens` or related usage fields. (#34977) thanks @sp-hk2ldn.
- Venice/default model refresh: switch the built-in Venice default to `kimi-k2-5`, update onboarding aliasing, and refresh Venice provider docs/recommendations to match the current private and anonymized catalog. (from #12964) Fixes #20156. Thanks @sabrinaaquino and @vincentkoc.
- Agents/skill API write pacing: add a global prompt guardrail that treats skill-driven external API writes as rate-limited by default, so runners prefer batched writes, avoid tight request loops, and respect `429`/`Retry-After`. Thanks @vincentkoc.
- Google Chat/multi-account webhook auth fallback: when `channels.googlechat.accounts.default` carries shared webhook audience/path settings (for example after config normalization), inherit those defaults for named accounts while preserving top-level and per-account overrides, so inbound webhook verification no longer fails silently for named accounts missing duplicated audience fields. Fixes #38369.
- Models/tool probing: raise the tool-capability probe budget from 32 to 256 tokens so reasoning models that spend tokens on thinking before returning a required tool call are less likely to be misclassified as not supporting tools. (#7521) Thanks @jakobdylanc.
- Gateway/transient network classification: treat wrapped `...: fetch failed` transport messages as transient while avoiding broad matches like `Web fetch failed (404): ...`, preventing Discord reconnect wrappers from crashing the gateway without suppressing non-network tool failures. (#38530) Thanks @xinhuagu.
- ACP/console silent reply suppression: filter ACP `NO_REPLY` lead fragments and silent-only finals before `openclaw agent` logging/delivery so console-backed ACP sessions no longer leak `NO`/`NO_REPLY` placeholders. (#38436) Thanks @ql-wade.
- Feishu/reply delivery reliability: disable block streaming in Feishu reply options so plain-text auto-render replies are no longer silently dropped before final delivery. (#38258) Thanks @xinhuagu.
- Agents/reply MEDIA delivery: normalize local assistant `MEDIA:` paths before block/final delivery, keep media dedupe aligned with message-tool sends, and contain malformed media normalization failures so generated files send reliably instead of falling back to empty responses. (#38572) Thanks @obviyus.
- Sessions/bootstrap cache rollover invalidation: clear cached workspace bootstrap snapshots whenever an existing `sessionKey` rolls to a new `sessionId` across auto-reply, command, and isolated cron session resolvers, so `AGENTS.md`/`MEMORY.md`/`USER.md` updates are reloaded after daily, idle, or forced session resets instead of staying stale until gateway restart. (#38494) Thanks @LivingInDrm.
- Gateway/Telegram polling health monitor: skip stale-socket restarts for Telegram long-polling channels and thread channel identity through shared health evaluation so polling connections are not restarted on the WebSocket stale-socket heuristic. (#38395) Thanks @ql-wade and @Takhoffman.
- Daemon/systemd fresh-install probe: check for OpenClaw's managed user unit before running `systemctl --user is-enabled`, so first-time Linux installs no longer fail on generic missing-unit probe errors. (#38819) Thanks @adaHubble.
- Gateway/container lifecycle: allow `openclaw gateway stop` to SIGTERM unmanaged gateway listeners and `openclaw gateway restart` to SIGUSR1 a single unmanaged listener when no service manager is installed, so container and supervisor-based deployments are no longer blocked by `service disabled` no-op responses. Fixes #36137. Thanks @vincentkoc.
- Gateway/Windows restart supervision: relaunch task-managed gateways through Scheduled Task with quoted helper-script command paths, distinguish restart-capable supervisors per platform, and stop orphaned Windows gateway children during self-restart. (#38825) Thanks @obviyus.
- Telegram/native topic command routing: resolve forum-topic native commands through the same conversation route as inbound messages so topic `agentId` overrides and bound topic sessions target the active session instead of the default topic-parent session. (#38871) Thanks @obviyus.
- Markdown/assistant image hardening: flatten remote markdown images to plain text across the Control UI, exported HTML, and shared Swift chat while keeping inline `data:image/...` markdown renderable, so model output no longer triggers automatic remote image fetches. (#38895) Thanks @obviyus.
- Config/compaction safeguard settings: regression-test `agents.defaults.compaction.recentTurnsPreserve` through `loadConfig()` and cover the new help metadata entry so the exposed preserve knob stays wired through schema validation and config UX. (#25557) thanks @rodrigouroz.
- iOS/Quick Setup presentation: skip automatic Quick Setup when a gateway is already configured (active connect config, last-known connection, preferred gateway, or manual host), so reconnecting installs no longer get prompted to connect again. (#38964) Thanks @ngutman.
- CLI/Docs memory help accuracy: clarify `openclaw memory status --deep` behavior and align memory command examples/docs with the current search options. (#31803) Thanks @JasonOA888 and @Avi974.
- Auto-reply/allowlist store account scoping: keep `/allowlist ... --store` writes scoped to the selected account and clear legacy unscoped entries when removing default-account store access, preventing cross-account default allowlist bleed-through from legacy pairing-store reads. Thanks @tdjackey for reporting and @vincentkoc for the fix.
- Security/Nostr: harden profile mutation/import loopback guards by failing closed on non-loopback forwarded client headers (`x-forwarded-for` / `x-real-ip`) and rejecting `sec-fetch-site: cross-site`; adds regression coverage for proxy-forwarded and browser cross-site mutation attempts.
- CLI/bootstrap Node version hint maintenance: replace hardcoded nvm `22` instructions in `openclaw.mjs` with `MIN_NODE_MAJOR` interpolation so future minimum-Node bumps keep startup guidance in sync automatically. (#39056) Thanks @onstash.
- Discord/native slash command auth: honor `commands.allowFrom.discord` (and `commands.allowFrom["*"]`) in guild slash-command pre-dispatch authorization so allowlisted senders are no longer incorrectly rejected as unauthorized. (#38794) Thanks @jskoiz and @thewilloftheshadow.
- Outbound/message target normalization: ignore empty legacy `to`/`channelId` fields when explicit `target` is provided so valid target-based sends no longer fail legacy-param validation; includes regression coverage. (#38944) Thanks @Narcooo.
- Models/auth token prompts: guard cancelled manual token prompts so `Symbol(clack:cancel)` values cannot be persisted into auth profiles; adds regression coverage for cancelled `models auth paste-token`. (#38951) Thanks @MumuTW.
- Gateway/loopback announce URLs: treat `http://` and `https://` aliases with the same loopback/private-network policy as websocket URLs so loopback cron announce delivery no longer fails secure URL validation. (#39064) Thanks @Narcooo.
- Models/default provider fallback: when the hardcoded default provider is removed from `models.providers`, resolve defaults from configured providers instead of reporting stale removed-provider defaults in status output. (#38947) Thanks @davidemanuelDEV.
- Agents/cache-trace stability: guard stable stringify against circular references in trace payloads so near-limit payloads no longer crash with `Maximum call stack size exceeded`; adds regression coverage. (#38935) Thanks @MumuTW.
- Extensions/diffs CI stability: add `headers` to the `localReq` test helper in `extensions/diffs/index.test.ts` so forwarding-hint checks no longer crash with `req.headers` undefined. (supersedes #39063) Thanks @Shennng.
- Agents/compaction thresholding: apply `agents.defaults.contextTokens` cap to the model passed into embedded run and `/compact` session creation so auto-compaction thresholds use the effective context window, not native model max context. (#39099) Thanks @MumuTW.
- Models/merge mode provider precedence: when `models.mode: "merge"` is active and config explicitly sets a provider `baseUrl`, keep config as source of truth instead of preserving stale runtime `models.json` `baseUrl` values; includes normalized provider-key coverage. (#39103) Thanks @BigUncle.
- UI/Control chat tool streaming: render tool events live in webchat without requiring refresh by enabling `tool-events` capability, fixing stream/event correlation, and resetting/reloading stream state around tool results and terminal events. (#39104) Thanks @jakepresent.
- Models/provider apiKey persistence hardening: when a provider `apiKey` value equals a known provider env var value, persist the canonical env var name into `models.json` instead of resolved plaintext secrets. (#38889) Thanks @gambletan.
- Discord/model picker persistence check: add a short post-dispatch settle delay before reading back session model state so picker confirmations stop reporting false mismatch warnings after successful model switches. (#39105) Thanks @akropp.
- Agents/OpenAI WS compat store flag: omit `store` from `response.create` payloads when model compat sets `supportsStore: false`, preventing strict OpenAI-compatible providers from rejecting websocket requests with unknown-field errors. (#39113) Thanks @scoootscooob.
- Config/validation log sanitization: sanitize config-validation issue paths/messages before logging so control characters and ANSI escape sequences cannot inject misleading terminal output from crafted config content. (#39116) Thanks @powermaster888.
- Agents/compaction counter accuracy: count successful overflow-triggered auto-compactions (`willRetry=true`) in the compaction counter while still excluding aborted/no-result events, so `/status` reflects actual safeguard compaction activity. (#39123) Thanks @MumuTW.
- Gateway/chat delta ordering: flush buffered assistant deltas before emitting tool `start` events so pre-tool text is delivered to Control UI before tool cards, avoiding transient text/tool ordering artifacts in streaming. (#39128) Thanks @0xtangping.
- Voice-call plugin schema parity: add missing manifest `configSchema` fields (`webhookSecurity`, `streaming.preStartTimeoutMs|maxPendingConnections|maxPendingConnectionsPerIp|maxConnections`, `staleCallReaperSeconds`) so gateway AJV validation accepts already-supported runtime config instead of failing with `additionalProperties` errors. (#38892) Thanks @giumex.
- Agents/OpenAI WS reconnect retry accounting: avoid double retry scheduling when reconnect failures emit both `error` and `close`, so retry budgets track actual reconnect attempts instead of exhausting early. (#39133) Thanks @scoootscooob.
- Daemon/Windows schtasks runtime detection: use locale-invariant `Last Run Result` running codes (`0x41301`/`267009`) as the primary running signal so `openclaw node status` no longer misreports active tasks as stopped on non-English Windows locales. (#39076) Thanks @ademczuk.
- Usage/token count formatting: round near-million token counts to millions (`1.0m`) instead of `1000k`, with explicit boundary coverage for `999_499` and `999_500`. (#39129) Thanks @CurryMessi.
- Gateway/session bootstrap cache invalidation ordering: clear bootstrap snapshots only after active embedded-run shutdown wait completes, preventing dying runs from repopulating stale cache between `/new`/`sessions.reset` turns. (#38873) Thanks @MumuTW.
- Browser/dispatcher error clarity: preserve dispatcher-side failure context in browser fetch errors while still appending operator guidance and explicit no-retry model hints, preventing misleading `"Can't reach service"` wrapping and avoiding LLM retry loops. (#39090) Thanks @NewdlDewdl.
- Telegram/polling offset safety: confirm persisted offsets before polling startup while validating stored `lastUpdateId` values as non-negative safe integers (with overflow guards) so malformed offset state cannot cause update skipping/dropping. (#39111) Thanks @MumuTW.
- Telegram/status SecretRef read-only resolution: resolve env-backed bot-token SecretRefs in config-only/status inspection while respecting provider source/defaults and env allowlists, so status no longer crashes or reports false-ready tokens for disallowed providers. (#39130) Thanks @neocody.
- Agents/OpenAI WS max-token zero forwarding: treat `maxTokens: 0` as an explicit value in websocket `response.create` payloads (instead of dropping it as falsy), with regression coverage for zero-token forwarding. (#39148) Thanks @scoootscooob.
- Podman/.env gateway bind precedence: evaluate `OPENCLAW_GATEWAY_BIND` after sourcing `.env` in `run-openclaw-podman.sh` so env-file overrides are honored. (#38785) Thanks @majinyu666.
- Models/default alias refresh: bump `gpt` to `openai/gpt-5.4` and Gemini defaults to `gemini-3.1` preview aliases (including normalization/default wiring) to track current model IDs. (#38638) Thanks @ademczuk.
- Config/env substitution degraded mode: convert missing `${VAR}` resolution in config reads from hard-fail to warning-backed degraded behavior, while preventing unresolved placeholders from being accepted as gateway credentials. (#39050) Thanks @akz142857.
- Discord inbound listener non-blocking dispatch: make `MESSAGE_CREATE` listener handoff asynchronous (no per-listener queue blocking), so long runs no longer stall unrelated incoming events. (#39154) Thanks @yaseenkadlemakki.
- Daemon/Windows PATH freeze fix: stop persisting install-time `PATH` snapshots into Scheduled Task scripts so runtime tool lookup follows current host PATH updates; also refresh local TUI history on silent local finals. (#39139) Thanks @Narcooo.
- Gateway/systemd service restart hardening: clear stale gateway listeners by explicit run-port before service bind, add restart stale-pid port-override support, tune systemd start/stop/exit handling, and disable detached child mode only in service-managed runtime so cgroup stop semantics clean up descendants reliably. (#38463) Thanks @spirittechie.
- Discord/plugin native command aliases: let plugins declare provider-specific slash names so native Discord registration can avoid built-in command collisions; the bundled Talk voice plugin now uses `/talkvoice` natively on Discord while keeping text `/voice`.
- Daemon/Windows schtasks status normalization: derive runtime state from locale-neutral numeric `Last Run Result` codes only (without language string matching) and surface unknown when numeric result data is unavailable, preventing locale-specific misclassification drift. (#39153) Thanks @scoootscooob.
- Telegram/polling conflict recovery: reset the polling `webhookCleared` latch on `getUpdates` 409 conflicts so webhook cleanup re-runs on restart cycles and polling avoids infinite conflict loops. (#39205) Thanks @amittell.
- Heartbeat/requests-in-flight scheduling: stop advancing `nextDueMs` and avoid immediate `scheduleNext()` timer overrides on requests-in-flight skips, so wake-layer retry cooldowns are honored and heartbeat cadence no longer drifts under sustained contention. (#39182) Thanks @MumuTW.
- Memory/SQLite contention resilience: re-apply `PRAGMA busy_timeout` on every sync-store and QMD connection open so process restarts/reopens no longer revert to immediate `SQLITE_BUSY` failures under lock contention. (#39183) Thanks @MumuTW.
- Gateway/webchat route safety: block webchat/control-ui clients from inheriting stored external delivery routes on channel-scoped sessions (while preserving route inheritance for UI/TUI clients), preventing cross-channel leakage from scoped chats. (#39175) Thanks @widingmarcus-cyber.
- Telegram error-surface resilience: return a user-visible fallback reply when dispatch/debounce processing fails instead of going silent, while preserving draft-stream cleanup and best-effort thread-scoped fallback delivery. (#39209) Thanks @riftzen-bit.
- Gateway/password auth startup diagnostics: detect unresolved provider-reference objects in `gateway.auth.password` and fail with a specific bootstrap-secrets error message instead of generic misconfiguration output. (#39230) Thanks @ademczuk.
- Agents/OpenAI-responses compatibility: strip unsupported `store` payload fields when `supportsStore=false` (including OpenAI-compatible non-OpenAI providers) while preserving server-compaction payload behavior. (#39219) Thanks @ademczuk.
- Agents/model fallback visibility: warn when configured model IDs cannot be resolved and fallback is applied, with log-safe sanitization of model text to prevent control-sequence injection in warning output. (#39215) Thanks @ademczuk.
- Outbound delivery replay safety: use two-phase delivery ACK markers (`.json` -> `.delivered` -> unlink) and startup marker cleanup so crash windows between send and cleanup do not replay already-delivered messages. (#38668) Thanks @Gundam98.
- Nodes/system.run approval binding: carry prepared approval plans through gateway forwarding and bind interpreter-style script operands across approval to execution, so post-approval script rewrites are denied while unchanged approved script runs keep working. Thanks @tdjackey for reporting.
- Nodes/system.run PowerShell wrapper parsing: treat `pwsh`/`powershell` `-EncodedCommand` forms as shell-wrapper payloads so allowlist mode still requires approval instead of falling back to plain argv analysis. Thanks @tdjackey for reporting.
- Control UI/auth error reporting: map generic browser `Fetch failed` websocket close errors back to actionable gateway auth messages (`gateway token mismatch`, `authentication failed`, `retry later`) so dashboard disconnects stop hiding credential problems. Landed from contributor PR #28608 by @KimGLee. Thanks @KimGLee.
- Media/mime unknown-kind handling: return `undefined` (not `"unknown"`) for missing/unrecognized MIME kinds and use document-size fallback caps for unknown remote media, preventing phantom `<media:unknown>` Signal events from being treated as real messages. (#39199) Thanks @nicolasgrasset.
- Nodes/system.run allow-always persistence: honor shell comment semantics during allowlist analysis so `#`-tailed payloads that never execute are not persisted as trusted follow-up commands. Thanks @tdjackey for reporting.
- Signal/inbound attachment fan-in: forward all successfully fetched inbound attachments through `MediaPaths`/`MediaUrls`/`MediaTypes` (instead of only the first), and improve multi-attachment placeholder summaries in mention-gated pending history. (#39212) Thanks @joeykrug.
- Nodes/system.run dispatch-wrapper boundary: keep shell-wrapper approval classification active at the depth boundary so `env` wrapper stacks cannot reach `/bin/sh -c` execution without the expected approval gate. Thanks @tdjackey for reporting.
- Docker/token persistence on reconfigure: reuse the existing `.env` gateway token during `docker-setup.sh` reruns and align compose token env defaults, so Docker installs stop silently rotating tokens and breaking existing dashboard sessions. Landed from contributor PR #33097 by @chengzhichao-xydt. Thanks @chengzhichao-xydt.
- Agents/strict OpenAI turn ordering: apply assistant-first transcript bootstrap sanitization to strict OpenAI-compatible providers (for example vLLM/Gemma via `openai-completions`) without adding Google-specific session markers, preventing assistant-first history rejections. (#39252) Thanks @scoootscooob.
- Discord/exec approvals gateway auth: pass resolved shared gateway credentials into the Discord exec-approvals gateway client so token-auth installs stop failing approvals with `gateway token mismatch`. Related to #38179. Thanks @0riginal-claw for the adjacent PR #35147 investigation.
- Subagents/workspace inheritance: propagate parent workspace directory to spawned subagent runs so child sessions reliably inherit workspace-scoped instructions (`AGENTS.md`, `SOUL.md`, etc.) without exposing workspace override through tool-call arguments. (#39247) Thanks @jasonQin6.
- Exec approvals/gateway-node policy: honor explicit `ask=off` from `exec-approvals.json` even when runtime defaults are stricter, so trusted full/off setups stop re-prompting on gateway and node exec paths. Landed from contributor PR #26789 by @pandego. Thanks @pandego.
- Exec approvals/config fallback: inherit `ask` from `exec-approvals.json` when `tools.exec.ask` is unset, so local full/off defaults no longer fall back to `on-miss` for exec tool and `nodes run`. Landed from contributor PR #29187 by @Bartok9. Thanks @Bartok9.
- Exec approvals/allow-always shell scripts: persist and match script paths for wrapper invocations like `bash scripts/foo.sh` while still blocking `-c`/`-s` wrapper bypasses. Landed from contributor PR #35137 by @yuweuii. Thanks @yuweuii.
- Queue/followup dedupe across drain restarts: dedupe queued redelivery `message_id` values after queue recreation so busy-session followups no longer duplicate on replayed inbound events. Landed from contributor PR #33168 by @rylena. Thanks @rylena.
- Telegram/preview-final edit idempotence: treat `message is not modified` errors during preview finalization as delivered so partial-stream final replies do not fall back to duplicate sends. Landed from contributor PR #34983 by @HOYALIM. Thanks @HOYALIM.
- Telegram/DM streaming transport parity: use message preview transport for all DM streaming lanes so final delivery can edit the active preview instead of sending duplicate finals. Landed from contributor PR #38906 by @gambletan. Thanks @gambletan.
- Telegram/DM draft streaming restoration: restore native `sendMessageDraft` preview transport for DM answer streaming while keeping reasoning on message transport, with regression coverage to keep draft finalization from sending duplicate finals. (#39398) Thanks @obviyus.
- Telegram/send retry safety: retry non-idempotent send paths only for pre-connect failures and make custom retry predicates strict, preventing ambiguous reconnect retries from sending duplicate messages. Landed from contributor PR #34238 by @hal-crackbot. Thanks @hal-crackbot.
- ACP/run spawn delivery bootstrap: stop reusing requester inline delivery targets for one-shot `mode: "run"` ACP spawns, so fresh run-mode workers bootstrap in isolation instead of inheriting thread-bound session delivery behavior. (#39014) Thanks @lidamao633.
- Discord/DM session-key normalization: rewrite legacy `discord:dm:*` and phantom direct-message `discord:channel:<user>` session keys to `discord:direct:*` when the sender matches, so multi-agent Discord DMs stop falling into empty channel-shaped sessions and resume replying correctly.
- Discord/native slash session fallback: treat empty configured bound-session keys as missing so `/status` and other native commands fall back to the routed slash session and routed channel session instead of blanking Discord session keys in normal channel bindings.
- Agents/tool-call dispatch normalization: normalize provider-prefixed tool names before dispatch across `toolCall`, `toolUse`, and `functionCall` blocks, while preserving multi-segment tool suffixes when stripping provider wrappers so malformed-but-recoverable tool names no longer fail with `Tool not found`. (#39328) Thanks @vincentkoc.
- Agents/parallel tool-call compatibility: honor `parallel_tool_calls` / `parallelToolCalls` extra params only for `openai-completions` and `openai-responses` payloads, preserve higher-precedence alias overrides across config and runtime layers, and ignore invalid non-boolean values so single-tool-call providers like NVIDIA-hosted Kimi stop failing on forced parallel tool-call payloads. (#37048) Thanks @vincentkoc.
- Config/invalid-load fail-closed: stop converting `INVALID_CONFIG` into an empty runtime config, keep valid settings available only through explicit best-effort diagnostic reads, and route read-only CLI diagnostics through that path so unknown keys no longer silently drop security-sensitive config. (#28140) Thanks @bobsahur-robot and @vincentkoc.
- Agents/codex-cli sandbox defaults: switch the built-in Codex backend from `read-only` to `workspace-write` so spawned coding runs can edit files out of the box. Landed from contributor PR #39336 by @0xtangping. Thanks @0xtangping.
- Gateway/health-monitor restart reason labeling: report `disconnected` instead of `stuck` for clean channel disconnect restarts, so operator logs distinguish socket drops from genuinely stuck channels. (#36436) Thanks @Sid-Qin.
- Control UI/agents-page overrides: auto-create minimal per-agent config entries when editing inherited agents, so model/tool/skill changes enable Save and inherited model fallbacks can be cleared by writing a primary-only override. Landed from contributor PR #39326 by @dunamismax. Thanks @dunamismax.
- Gateway/Telegram webhook-mode recovery: add `webhookCertPath` to re-upload self-signed certificates during webhook registration and skip stale-socket detection for webhook-mode channels, so Telegram webhook setups survive health-monitor restarts. Landed from contributor PR #39313 by @fellanH. Thanks @fellanH.
- Discord/config schema parity: add `channels.discord.agentComponents` to the strict Zod config schema so valid `agentComponents.enabled` settings (root and account-scoped) no longer fail with unrecognized-key validation errors. Landed from contributor PR #39378 by @gambletan. Thanks @gambletan and @thewilloftheshadow.
- ACPX/MCP session bootstrap: inject configured MCP servers into ACP `session/new` and `session/load` for acpx-backed sessions, restoring Canva and other external MCP tools. Landed from contributor PR #39337. Thanks @goodspeed-apps.
- Control UI/Telegram sender labels: preserve inbound sender labels in sanitized chat history so dashboard user-message groups split correctly and show real group-member names instead of `You`. (#39414) Thanks @obviyus.

---

### 📦 v2026.3.8 (2026-03-09)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.3.8)

> [!NOTE]
> **DeXMart-relevant keywords:** `telegram`

#### Changes (Features)

- CLI/backup: add `openclaw backup create` and `openclaw backup verify` for local state archives, including `--only-config`, `--no-include-workspace`, manifest/payload validation, and backup guidance in destructive flows. (#40163) thanks @shichangs.
- macOS/onboarding: add a remote gateway token field for remote mode, preserve existing non-plaintext `gateway.remote.token` config values until explicitly replaced, and warn when the loaded token shape cannot be used directly from the macOS app. (#40187, supersedes #34614) Thanks @cgdusek.
- Talk mode: add top-level `talk.silenceTimeoutMs` config so Talk waits a configurable amount of silence before auto-sending the current transcript, while keeping each platform's existing default pause window when unset. (#39607) Thanks @danodoesdesign. Fixes #17147.
- TUI: infer the active agent from the current workspace when launched inside a configured agent workspace, while preserving explicit `agent:` session targets. (#39591) thanks @arceus77-7.
- Tools/Brave web search: add opt-in `tools.web.search.brave.mode: "llm-context"` so `web_search` can call Brave's LLM Context endpoint and return extracted grounding snippets with source metadata, plus config/docs/test coverage. (#33383) Thanks @thirumaleshp.
- CLI/install: include the short git commit hash in `openclaw --version` output when metadata is available, and keep installer version checks compatible with the decorated format. (#39712) thanks @sourman.
- CLI/backup: improve archive naming for date sorting, add config-only backup mode, and harden backup planning, publication, and verification edge cases. (#40163) Thanks @gumadeiras.
- ACP/Provenance: add optional ACP ingress provenance metadata and visible receipt injection (`openclaw acp --provenance off|meta|meta+receipt`) so OpenClaw agents can retain and report ACP-origin context with session trace IDs. (#40473) thanks @mbelinky.
- Tools/web search: alphabetize provider ordering across runtime selection, onboarding/configure pickers, and config metadata, so provider lists stay neutral and multi-key auto-detect now prefers Grok before Kimi. (#40259) thanks @kesku.
- Docs/Web search: restore $5/month free-credit details, replace defunct "Data for Search"/"Data for AI" plan names with current "Search" plan, and note legacy subscription validity in Brave setup docs. Follows up on #26860. (#40111) Thanks @remusao.
- Extensions/ACPX tests: move the shared runtime fixture helper from `src/runtime-internals/` to `src/test-utils/` so the test-only helper no longer looks like shipped runtime code.

#### Fixes

- Update/macOS launchd restart: re-enable disabled LaunchAgent services before updater bootstrap so `openclaw update` can recover from a disabled gateway service instead of leaving the restart step stuck.
- macOS app/chat UI: route browser proxy through the local node browser service, preserve plain-text paste semantics, strip completed assistant trace/debug wrapper noise from transcripts, refresh permission state after returning from System Settings, and tolerate malformed cron rows in the macOS tab. (#39516) Thanks @Imhermes1.
- Android/Play distribution: remove self-update, background location, `screen.record`, and background mic capture from the Android app, narrow the foreground service to `dataSync` only, and clean up the legacy `location.enabledMode=always` preference migration. (#39660) Thanks @obviyus.
- Telegram/DM routing: dedupe inbound Telegram DMs per agent instead of per session key so the same DM cannot trigger duplicate replies when both `agent:main:main` and `agent:main:telegram:direct:<id>` resolve for one agent. Fixes #40005. Supersedes #40116. (#40519) thanks @obviyus.
- Cron/Telegram announce delivery: route text-only announce jobs through the real outbound adapters after finalizing descendant output so plain Telegram targets no longer report `delivered: true` when no message actually reached Telegram. (#40575) thanks @obviyus.
- Matrix/DM routing: add safer fallback detection for broken `m.direct` homeservers, honor explicit room bindings over DM classification, and preserve room-bound agent selection for Matrix DM rooms. (#19736) Thanks @derbronko.
- Feishu/plugin onboarding: clear the short-lived plugin discovery cache before reloading the registry after installing a channel plugin, so onboarding no longer re-prompts to download Feishu immediately after a successful install. Fixes #39642. (#39752) Thanks @GazeKingNuWu.
- Plugins/channel onboarding: prefer bundled channel plugins over duplicate npm-installed copies during onboarding and release-channel sync, preventing bundled plugins from being shadowed by npm installs with the same plugin ID. (#40092)
- Config/runtime snapshots: keep secrets-runtime-resolved config and auth-profile snapshots intact after config writes so follow-up reads still see file-backed secret values while picking up the persisted config update. (#37313) thanks @bbblending.
- Gateway/Control UI: resolve bundled dashboard assets through symlinked global wrappers and auto-detected package roots, while keeping configured and custom roots on the strict hardlink boundary. (#40385) Thanks @LarytheLord.
- Browser/extension relay: add `browser.relayBindHost` so the Chrome relay can bind to an explicit non-loopback address for WSL2 and other cross-namespace setups, while preserving loopback-only defaults. (#39364) Thanks @mvanhorn.
- Browser/CDP: normalize loopback direct WebSocket CDP URLs back to HTTP(S) for `/json/*` tab operations so local `ws://` / `wss://` profiles can still list, focus, open, and close tabs after the new direct-WS support lands. (#31085) Thanks @shrey150.
- Browser/CDP: rewrite wildcard `ws://0.0.0.0` and `ws://[::]` debugger URLs from remote `/json/version` responses back to the external CDP host/port, fixing Browserless-style container endpoints. (#17760) Thanks @joeharouni.
- Browser/extension relay: wait briefly for a previously attached Chrome tab to reappear after transient relay drops before failing with `tab not found`, reducing noisy reconnect flakes. (#32461) Thanks @AaronWander.
- macOS/Tailscale gateway discovery: keep Tailscale Serve probing alive when other remote gateways are already discovered, prefer direct transport for resolved `.ts.net` and Tailscale Serve gateways, and set `TERM=dumb` for GUI-launched Tailscale CLI discovery. (#40167) thanks @ngutman.
- TUI/theme: detect light terminal backgrounds via `COLORFGBG` and pick a WCAG AA-compliant light palette, with `OPENCLAW_THEME=light|dark` override for terminals without auto-detection. (#38636) Thanks @ademczuk and @vincentkoc.
- Agents/openai-codex: normalize `gpt-5.4` fallback transport back to `openai-codex-responses` on `chatgpt.com/backend-api` when config drifts to the generic OpenAI responses endpoint. (#38736) Thanks @0xsline.
- Models/openai-codex GPT-5.4 forward-compat: use the GPT-5.4 1,050,000-token context window and 128,000 max tokens for `openai-codex/gpt-5.4` instead of inheriting stale legacy Codex limits in resolver fallbacks and model listing. (#37876) thanks @yuweuii.
- Tools/web search: restore Perplexity OpenRouter/Sonar compatibility for legacy `OPENROUTER_API_KEY`, `sk-or-...`, and explicit `perplexity.baseUrl` / `model` setups while keeping direct Perplexity keys on the native Search API path. (#39937) Thanks @obviyus.
- Agents/failover: detect Amazon Bedrock `Too many tokens per day` quota errors as rate limits across fallback, cron retry, and memory embeddings while keeping context-window `too many tokens per request` errors out of the rate-limit lane. (#39377) Thanks @gambletan.
- Mattermost replies: keep `root_id` pinned to the existing thread root when an agent replies inside a thread, while still using reply-target threading for top-level posts. (#27744) thanks @hnykda.
- Telegram/DM partial streaming: keep DM preview lanes on real message edits instead of native draft materialization so final replies no longer flash a second duplicate copy before collapsing back to one.
- macOS overlays: fix VoiceWake, Talk, and Notify overlay exclusivity crashes by removing shared `inout` visibility mutation from `OverlayPanelFactory.present`, and add a repeated Talk overlay smoke test. (#39275, #39321) Thanks @fellanH.
- macOS Talk Mode: set the speech recognition request `taskHint` to `.dictation` for mic capture, and add regression coverage for the request defaults. (#38445) Thanks @dmiv.
- macOS release packaging: default `scripts/package-mac-app.sh` to universal binaries for `BUILD_CONFIG=release`, and clarify that `scripts/package-mac-dist.sh` already produces the release zip + DMG. (#33891) Thanks @cgdusek.
- Hooks/session-memory: keep `/new` and `/reset` memory artifacts in the bound agent workspace and align saved reset session keys with that workspace when stale main-agent keys leak into the hook path. (#39875) thanks @rbutera.
- Sessions/model switch: clear stale cached `contextTokens` when a session changes models so status and runtime paths recompute against the active model window. (#38044) thanks @yuweuii.
- ACP/session history: persist transcripts for successful ACP child runs, preserve exact transcript text, record ACP spawned-session lineage, and keep spawn-time transcript-path persistence best-effort so history storage failures do not block execution. (#40137) thanks @mbelinky.
- Docs/browser: add a layered WSL2 + Windows remote Chrome CDP troubleshooting guide, including Control UI origin pitfalls and extension-relay bind-address guidance. (#39407) Thanks @Owlock.
- Context engine registry/bundled builds: share the registry state through a `globalThis` singleton so duplicated bundled module copies can resolve engines registered by each other at runtime, with regression coverage for duplicate-module imports. (#40115) thanks @jalehman.
- Podman/setup: fix `cannot chdir: Permission denied` in `run_as_user` when `setup-podman.sh` is invoked from a directory the target user cannot access, by wrapping user-switch calls in a subshell that cd's to `/tmp` with `/` fallback. (#39435) Thanks @langdon and @jlcbk.
- Podman/SELinux: auto-detect SELinux enforcing/permissive mode and add `:Z` relabel to bind mounts in `run-openclaw-podman.sh` and the Quadlet template, fixing `EACCES` on Fedora/RHEL hosts. Supports `OPENCLAW_BIND_MOUNT_OPTIONS` override. (#39449) Thanks @langdon and @githubbzxs.
- Agents/context-engine plugins: bootstrap runtime plugins once at embedded-run, compaction, and subagent boundaries so plugin-provided context engines and hooks load from the active workspace before runtime resolution. (#40232)
- Docs/Changelog: correct the contributor credit for the bundled Control UI global-install fix to @LarytheLord. (#40420) Thanks @velvet-shark.
- Telegram/media downloads: time out only stalled body reads so polling recovers from hung file downloads without aborting slow downloads that are still streaming data. (#40098) thanks @tysoncung.
- Docker/runtime image: prune dev dependencies, strip build-only dist metadata for smaller Docker images. (#40307) Thanks @vincentkoc.
- Gateway/restart timeout recovery: exit non-zero when restart-triggered shutdown drains time out so launchd/systemd restart the gateway instead of treating the failed restart as a clean stop. Landed from contributor PR #40380 by @dsantoreis. Thanks @dsantoreis.
- Gateway/config restart guard: validate config before service start/restart and keep post-SIGUSR1 startup failures from crashing the gateway process, reducing invalid-config restart loops and macOS permission loss. Landed from contributor PR #38699 by @lml2468. Thanks @lml2468.
- Gateway/launchd respawn detection: treat `XPC_SERVICE_NAME` as a launchd supervision hint so macOS restarts exit cleanly under launchd instead of attempting detached self-respawn. Landed from contributor PR #20555 by @dimat. Thanks @dimat.
- Telegram/poll restart cleanup: abort the in-flight Telegram API fetch when shutdown or forced polling restarts stop a runner, preventing stale `getUpdates` long polls from colliding with the replacement runner. Landed from contributor PR #23950 by @Gkinthecodeland. Thanks @Gkinthecodeland.
- Cron/restart catch-up staggering: limit immediate missed-job replay on startup and reschedule the deferred remainder from the post-catchup clock so restart bursts do not starve the gateway or silently skip overdue recurring jobs. Landed from contributor PR #18925 by @rexlunae. Thanks @rexlunae.
- Cron/owner-only tools: pass trusted isolated cron runs into the embedded agent with owner context so `cron`/`gateway` tooling remains available after the owner-auth hardening narrowed direct-message ownership inference.
- Browser/SSRF: block private-network intermediate redirect hops in strict browser navigation flows and fail closed when remote tab-open paths cannot inspect redirect chains. Thanks @zpbrent.
- MS Teams/authz: keep `groupPolicy: "allowlist"` enforcing sender allowlists even when a team/channel route allowlist is configured, so route matches no longer widen group access to every sender in that route. Thanks @zpbrent.
- Security/system.run: bind approved `bun` and `deno run` script operands to on-disk file snapshots so post-approval script rewrites are denied before execution.
- Skills/download installs: pin the validated per-skill tools root before writing downloaded archives, so rebinding the lexical tools path cannot redirect download writes outside the intended tools directory. Thanks @tdjackey.

---

### 📦 v2026.3.11 (2026-03-12)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.3.11)

> [!CAUTION]
> **Injection Point Impact Detected:**
> - **src/ingress/ingress-service.ts** (matched: `runEmbeddedPiAgent`)

> [!NOTE]
> **DeXMart-relevant keywords:** `telegram`, `billing`

#### ⚠️ Breaking Changes

- Cron/doctor: tighten isolated cron delivery so cron jobs can no longer notify through ad hoc agent sends or fallback main-session summaries, and add `openclaw doctor --fix` migration for legacy cron storage and legacy notify/webhook delivery metadata. (#40998) Thanks @mbelinky.

#### Changes (Features)

- OpenRouter/models: add temporary Hunter Alpha and Healer Alpha entries to the built-in catalog so OpenRouter users can try the new free stealth models during their roughly one-week availability window. (#43642) Thanks @ping-Toven.
- iOS/Home canvas: add a bundled welcome screen with a live agent overview that refreshes on connect, reconnect, and foreground return, and move the compact connection pill off the top-left canvas overlay. (#42456) Thanks @ngutman.
- iOS/Home canvas: replace floating controls with a docked toolbar, make the bundled home scaffold adapt to smaller phones, and open chat in the resolved main session instead of a synthetic `ios` session. (#42456) Thanks @ngutman.
- macOS/chat UI: add a chat model picker, persist explicit thinking-level selections across relaunch, and harden provider-aware session model sync for the shared chat composer. (#42314) Thanks @ImLukeF.
- Onboarding/Ollama: add first-class Ollama setup with Local or Cloud + Local modes, browser-based cloud sign-in, curated model suggestions, and cloud-model handling that skips unnecessary local pulls. (#41529) Thanks @BruceMacD.
- OpenCode/onboarding: add new OpenCode Go provider, treat Zen and Go as one OpenCode setup in the wizard/docs while keeping the runtime providers split, store one shared OpenCode key for both profiles, and stop overriding the built-in `opencode-go` catalog routing. (#42313) Thanks @ImLukeF and @vincentkoc.
- Memory: add opt-in multimodal image and audio indexing for `memorySearch.extraPaths` with Gemini `gemini-embedding-2-preview`, strict fallback gating, and scope-based reindexing. (#43460) Thanks @gumadeiras.
- Memory/Gemini: add `gemini-embedding-2-preview` memory-search support with configurable output dimensions and automatic reindexing when the configured dimensions change. (#42501) Thanks @BillChirico and @gumadeiras.
- macOS/onboarding: detect when remote gateways need a shared auth token, explain where to find it on the gateway host, and clarify when a successful check used paired-device auth instead. (#43100) Thanks @ngutman.
- Discord/auto threads: add `autoArchiveDuration` channel config for auto-created threads so Discord thread archiving can stay at 1 hour, 1 day, 3 days, or 1 week instead of always using the 1-hour default. (#35065) Thanks @davidguttman.
- iOS/TestFlight: add a local beta release flow with Fastlane prepare/archive/upload support, canonical beta bundle IDs, and watch-app archive fixes. (#42991) Thanks @ngutman.
- ACP/sessions_spawn: add optional `resumeSessionId` for `runtime: "acp"` so spawned ACP sessions can resume an existing ACPX/Codex conversation instead of always starting fresh. (#41847) Thanks @pejmanjohn.
- Gateway/node pending work: add narrow in-memory pending-work queue primitives (`node.pending.enqueue` / `node.pending.drain`) and wake-helper reuse as a foundation for dormant-node work delivery. (#41409) Thanks @mbelinky.
- Git/runtime state: ignore the gateway-generated `.dev-state` file so local runtime state does not show up as untracked repo noise. (#41848) Thanks @smysle.
- Exec/child commands: mark child command environments with `OPENCLAW_CLI` so subprocesses can detect when they were launched from the OpenClaw CLI. (#41411) Thanks @vincentkoc.

#### Fixes

- Agents/text sanitization: strip leaked model control tokens (`<|...|>` and full-width `<｜...｜>` variants) from user-facing assistant text, preventing GLM-5 and DeepSeek internal delimiters from reaching end users. (#42173) Thanks @imwyvern.
- iOS/gateway foreground recovery: reconnect immediately on foreground return after stale background sockets are torn down, so the app no longer stays disconnected until a later wake path happens. (#41384) Thanks @mbelinky.
- Gateway/Control UI: keep dashboard auth tokens in session-scoped browser storage so same-tab refreshes preserve remote token auth without restoring long-lived localStorage token persistence, while scoping tokens to the selected gateway URL and fragment-only bootstrap flow. (#40892) thanks @velvet-shark.
- Gateway/macOS launchd restarts: keep the LaunchAgent registered during explicit restarts, hand off self-restarts through a detached launchd helper, and recover config/hot reload restart paths without unloading the service. Fixes #43311, #43406, #43035, and #43049.
- macOS/LaunchAgent install: tighten LaunchAgent directory and plist permissions during install so launchd bootstrap does not fail when the target home path or generated plist inherited group/world-writable modes.
- Discord/reply chunking: resolve the effective `maxLinesPerMessage` config across live reply paths and preserve `chunkMode` in the fast send path so long Discord replies no longer split unexpectedly at the default 17-line limit. (#40133) thanks @rbutera.
- Feishu/local image auto-convert: pass `mediaLocalRoots` through the `sendText` local-image shim so allowed local image paths upload as Feishu images again instead of falling back to raw path text. (#40623) Thanks @ayanesakura.
- Models/Kimi Coding: send `anthropic-messages` tools in native Anthropic format again so `kimi-coding` stops degrading tool calls into XML/plain-text pseudo invocations instead of real `tool_use` blocks. (#38669, #39907, #40552) Thanks @opriz.
- Telegram/outbound HTML sends: chunk long HTML-mode messages, preserve plain-text fallback and silent-delivery params across retries, and cut over to plain text when HTML chunk planning cannot safely preserve the full message. (#42240) thanks @obviyus.
- Telegram/final preview delivery: split active preview lifecycle from cleanup retention so missing archived preview edits avoid duplicate fallback sends without clearing the live preview or blocking later in-place finalization. (#41662) thanks @hougangdev.
- Telegram/final preview delivery followup: keep ambiguous missing-`message_id` finals only when a preview was already visible, while first-preview/no-id cases still fall back so Telegram users do not lose the final reply. (#41932) thanks @hougangdev.
- Telegram/final preview cleanup follow-up: clear stale cleanup-retain state only for transient preview finals so archived-preview retains no longer leave a stale partial bubble beside a later fallback-sent final. (#41763) Thanks @obviyus.
- Gateway/auth: allow one trusted device-token retry on shared-token mismatch with recovery hints to prevent reconnect churn during token drift. (#42507) Thanks @joshavant.
- Gateway/config errors: surface up to three validation issues in top-level `config.set`, `config.patch`, and `config.apply` error messages while preserving structured issue details. (#42664) Thanks @huntharo.
- Agents/Azure OpenAI Responses: include the `azure-openai` provider in the Responses API store override so Azure OpenAI multi-turn cron jobs and embedded agent runs no longer fail with HTTP 400 "store is set to false". (#42934, fixes #42800) Thanks @ademczuk.
- Agents/error rendering: ignore stale assistant `errorMessage` fields on successful turns so background/tool-side failures no longer prepend synthetic billing errors over valid replies. (#40616) Thanks @ingyukoh.
- Agents/billing recovery: probe single-provider billing cooldowns on the existing throttle so topping up credits can recover without a manual gateway restart. (#41422) thanks @altaywtf.
- Agents/fallback: treat HTTP 499 responses as transient in both raw-text and structured failover paths so Anthropic-style client-closed overload responses trigger model fallback reliably. (#41468) thanks @zeroasterisk.
- Agents/fallback: recognize Venice `402 Insufficient USD or Diem balance` billing errors so configured model fallbacks trigger instead of surfacing the raw provider error. (#43205) Thanks @Squabble9.
- Agents/fallback: recognize Poe `402 You've used up your points!` billing errors so configured model fallbacks trigger instead of surfacing the raw provider error. (#42278) Thanks @CryUshio.
- Agents/failover: treat Gemini `MALFORMED_RESPONSE` stop reasons as retryable timeouts so preview-model enum drift falls back cleanly instead of crashing the run, without also reclassifying malformed function-call errors. (#42292) Thanks @jnMetaCode.
- Agents/cooldowns: default cooldown windows with no recorded failure history to `unknown` instead of `rate_limit`, avoiding false API rate-limit warnings while preserving cooldown recovery probes. (#42911) Thanks @VibhorGautam.
- Auth/cooldowns: reset expired auth-profile cooldown error counters before computing the next backoff so stale on-disk counters do not re-escalate into long cooldown loops after expiry. (#41028) thanks @zerone0x.
- Agents/memory flush: forward `memoryFlushWritePath` through `runEmbeddedPiAgent` so memory-triggered flush turns keep the append-only write guard without aborting before tool setup. Follows up on #38574. (#41761) Thanks @frankekn.
- Agents/context pruning: prune image-only tool results during soft-trim, align context-pruning coverage with the new tool-result contract, and extend historical image cleanup to the same screenshot-heavy session path. (#43045) Thanks @MoerAI.
- Sessions/reset model recompute: clear stale runtime model, context-token, and system-prompt metadata before session resets recompute the replacement session, so resets pick up current defaults and explicit overrides instead of reusing old runtime model state. (#41173) thanks @PonyX-lab.
- Channels/allowlists: remove stale matcher caching so same-array allowlist edits and wildcard replacements take effect immediately, with regression coverage for in-place mutation cases.
- Discord/Telegram outbound runtime config: thread runtime-resolved config through Discord and Telegram send paths so SecretRef-based credentials stay resolved during message delivery. (#42352) Thanks @joshavant.
- Tools/web search: treat Brave `llm-context` grounding snippets as plain strings so `web_search` no longer returns empty snippet arrays in LLM Context mode. (#41387) thanks @zheliu2.
- Tools/web search: recover OpenRouter Perplexity citation extraction from `message.annotations` when chat-completions responses omit top-level citations. (#40881) Thanks @laurieluo.
- CLI/skills JSON: strip ANSI and C1 control bytes from `skills list --json`, `skills info --json`, and `skills check --json` so machine-readable output stays valid for terminals and skill metadata with embedded control characters. Fixes #27530. Related #27557. Thanks @Jimmy-xuzimo and @vincentkoc.
- CLI/tables: default shared tables to ASCII borders on legacy Windows consoles while keeping Unicode borders on modern Windows terminals, so commands like `openclaw skills` stop rendering mojibake under GBK/936 consoles. Fixes #40853. Related #41015. Thanks @ApacheBin and @vincentkoc.
- CLI/memory teardown: close cached memory search/index managers in the one-shot CLI shutdown path so watcher-backed memory caches no longer keep completed CLI runs alive after output finishes. (#40389) thanks @Julbarth.
- Control UI/Sessions: restore single-column session table collapse on narrow viewport or container widths by moving the responsive table override next to the base grid rule and enabling inline-size container queries. (#12175) Thanks @benjipeng.
- Telegram/network env-proxy: apply configured transport policy to proxied HTTPS dispatchers as well as direct `NO_PROXY` bypasses, so resolver-scoped IPv4 fallback and network settings work consistently for env-proxied Telegram traffic. (#40740) Thanks @sircrumpet.
- Mattermost/Markdown formatting: preserve first-line indentation when stripping bot mentions so nested list items and indented code blocks keep their structure, and render Mattermost tables natively by default instead of fenced-code fallback. (#18655) thanks @echo931.
- Mattermost/plugin send actions: normalize direct `replyTo` fallback handling so threaded plugin sends trim blank IDs and reuse the correct reply target again. (#41176) Thanks @hnykda.
- MS Teams/allowlist resolution: use the General channel conversation ID as the resolved team key (with Graph GUID fallback) so Bot Framework runtime `channelData.team.id` matching works for team and team/channel allowlist entries. (#41838) Thanks @BradGroux.
- Signal/config schema: accept `channels.signal.accountUuid` in strict config validation so loop-protection configs no longer fail with an unrecognized-key error. (#35578) Thanks @ingyukoh.
- Telegram/config schema: accept `channels.telegram.actions.editMessage` and `createForumTopic` in strict config validation so existing Telegram action toggles no longer fail as unrecognized keys. (#35498) Thanks @ingyukoh.
- Telegram/docs: clarify that `channels.telegram.groups` allowlists chats while `groupAllowFrom` allowlists users inside those chats, and point invalid negative chat IDs at the right config key. (#42451) Thanks @altaywtf.
- Discord/config typing: expose channel-level `autoThread` on the canonical guild-channel config type so strict config loading matches the existing Discord schema and runtime behavior. (#35608) Thanks @ingyukoh.
- fix(models): guard optional model.input capability checks (#42096) thanks @andyliu
- Models/Alibaba Cloud Model Studio: wire `MODELSTUDIO_API_KEY` through shared env auth, implicit provider discovery, and shell-env fallback so onboarding works outside the wizard too. (#40634) Thanks @pomelo-nwu.
- Resolve web tool SecretRefs atomically at runtime. (#41599) Thanks @joshavant.
- Secret files: harden CLI and channel credential file reads against path-swap races by requiring direct regular files for `*File` secret inputs and rejecting symlink-backed secret files.
- Archive extraction: harden TAR and external `tar.bz2` installs against destination symlink and pre-existing child-symlink escapes by extracting into staging first and merging into the canonical destination with safe file opens.
- Secrets/SecretRef: reject exec SecretRef traversal ids across schema, runtime, and gateway. (#42370) Thanks @joshavant.
- Sandbox/fs bridge: pin staged writes to verified parent directories so temporary write files cannot materialize outside the allowed mount before atomic replace. Thanks @tdjackey.
- Gateway/auth: fail closed when local `gateway.auth.*` SecretRefs are configured but unavailable, instead of silently falling back to `gateway.remote.*` credentials in local mode. (#42672) Thanks @joshavant.
- Commands/config writes: enforce `configWrites` against both the originating account and the targeted account scope for `/config` and config-backed `/allowlist` edits, blocking sibling-account mutations while preserving gateway `operator.admin` flows. Thanks @tdjackey for reporting.
- Security/system.run: fail closed for approval-backed interpreter/runtime commands when OpenClaw cannot bind exactly one concrete local file operand, while extending best-effort direct-file binding to additional runtime forms. Thanks @tdjackey for reporting.
- Gateway/session reset auth: split conversation `/new` and `/reset` handling away from the admin-only `sessions.reset` control-plane RPC so write-scoped gateway callers can no longer reach the privileged reset path through `agent`. Thanks @tdjackey for reporting.
- Security/plugin runtime: stop unauthenticated plugin HTTP routes from inheriting synthetic admin gateway scopes when they call `runtime.subagent.*`, so admin-only methods like `sessions.delete` stay blocked without gateway auth.
- Security/session_status: enforce sandbox session-tree visibility and shared agent-to-agent access guards before reading or mutating target session state, so sandboxed subagents can no longer inspect parent session metadata or write parent model overrides via `session_status`.
- Security/nodes: treat the `nodes` agent tool as owner-only fallback policy so non-owner senders cannot reach paired-node approval or invoke paths through the shared tool set.
- Security/external content: treat whitespace-delimited `EXTERNAL UNTRUSTED CONTENT` boundary markers like underscore-delimited variants so prompt wrappers cannot bypass marker sanitization. (#35983) Thanks @urianpaul94.
- Telegram/exec approvals: reject `/approve` commands aimed at other bots, keep deterministic approval prompts visible when tool-result delivery fails, and stop resolved exact IDs from matching other pending approvals by prefix. (#37233) Thanks @huntharo.
- Subagents/authority: persist leaf vs orchestrator control scope at spawn time and route tool plus slash-command control through shared ownership checks, so leaf sessions cannot regain orchestration privileges after restore or flat-key lookups. Thanks @tdjackey.
- ACP/ACPX plugin: bump the bundled `acpx` pin to `0.1.16` so plugin-local installs and strict version checks match the latest published CLI. (#41975) Thanks @dutifulbob.
- ACP/sessions.patch: allow `spawnedBy` and `spawnDepth` lineage fields on ACP session keys so `sessions_spawn` with `runtime: "acp"` no longer fails during child-session setup. Fixes #40971. (#40995) thanks @xaeon2026.
- ACP/stop reason mapping: resolve gateway chat `state: "error"` completions as ACP `end_turn` instead of `refusal` so transient backend failures are not surfaced as deliberate refusals. (#41187) thanks @pejmanjohn.
- ACP/setSessionMode: propagate gateway `sessions.patch` failures back to ACP clients so rejected mode changes no longer return silent success. (#41185) thanks @pejmanjohn.
- ACP/bridge mode: reject unsupported per-session MCP server setup and propagate rejected session-mode changes so IDE clients see explicit bridge limitations instead of silent success. (#41424) Thanks @mbelinky.
- ACP/session UX: replay stored user and assistant text on `loadSession`, expose Gateway-backed session controls and metadata, and emit approximate session usage updates so IDE clients restore context more faithfully. (#41425) Thanks @mbelinky.
- ACP/tool streaming: enrich `tool_call` and `tool_call_update` events with best-effort text content and file-location hints so IDE clients can follow bridge tool activity more naturally. (#41442) Thanks @mbelinky.
- ACP/runtime attachments: forward normalized inbound image attachments into ACP runtime turns so ACPX sessions can preserve image prompt content on the runtime path. (#41427) Thanks @mbelinky.
- ACP/regressions: add gateway RPC coverage for ACP lineage patching, ACPX runtime coverage for image prompt serialization, and an operator smoke-test procedure for live ACP spawn verification. (#41456) Thanks @mbelinky.
- ACP/follow-up hardening: make session restore and prompt completion degrade gracefully on transcript/update failures, enforce bounded tool-location traversal, and skip non-image ACPX turns the runtime cannot serialize. (#41464) Thanks @mbelinky.
- ACP/sessions_spawn: implicitly stream `mode="run"` ACP spawns to parent only for eligible subagent orchestrator sessions (heartbeat `target: "last"` with a usable session-local route), restoring parent progress relays without thread binding. (#42404) Thanks @davidguttman.
- ACP/main session aliases: canonicalize `main` before ACP session lookup so restarted ACP main sessions rehydrate instead of failing closed with `Session is not ACP-enabled: main`. (#43285, fixes #25692)
- Plugins/context-engine model auth: expose `runtime.modelAuth` and plugin-sdk auth helpers so plugins can resolve provider/model API keys through the normal auth pipeline. (#41090) thanks @xinhuagu.
- Hooks/plugin context parity followup: pass `trigger` and `channelId` through embedded `llm_input`, `agent_end`, and `llm_output` hook contexts so plugins receive the same agent metadata across hook phases. (#42362) Thanks @zhoulf1006.
- Plugins/global hook runner: harden singleton state handling so shared global hook runner reuse does not leak or corrupt runner state across executions. (#40184) Thanks @vincentkoc.
- Context engine/tests: add bundled-registry regression coverage for cross-chunk resolution, plugin-sdk re-exports, and concurrent chunk registration. (#40460) thanks @dsantoreis.
- Agents/embedded runner: bound compaction retry waiting and drain embedded runs during SIGUSR1 restart so session lanes recover instead of staying blocked behind compaction. (#40324) thanks @cgdusek.
- Agents/embedded logs: add structured, sanitized lifecycle and failover observation events so overload and provider failures are easier to tail and filter. (#41336) thanks @altaywtf.
- Agents/embedded overload logs: include the failing model and provider in error-path console output, with lifecycle regression coverage for the rendered and sanitized `consoleMessage`. (#41236) thanks @jiarung.
- Agents/fallback observability: add structured, sanitized model-fallback decision and auth-profile failure-state events with correlated run IDs so cooldown probes and failover paths are easier to trace in logs. (#41337) thanks @altaywtf.
- Logging/probe observations: suppress structured embedded and model-fallback probe warnings on the console without hiding error or fatal output. (#41338) thanks @altaywtf.
- Agents/context-engine compaction: guard thrown engine-owned overflow compaction attempts and fire compaction hooks for `ownsCompaction` engines so overflow recovery no longer crashes and plugin subscribers still observe compact runs. (#41361) thanks @davidrudduck.
- Gateway/node pending drain followup: keep `hasMore` true when the deferred baseline status item still needs delivery, and avoid allocating empty pending-work state for drain-only nodes with no queued work. (#41429) Thanks @mbelinky.
- Protocol/Swift model sync: regenerate pending node work Swift bindings after the landed `node.pending.*` schema additions so generated protocol artifacts are consistent again. (#41477) Thanks @mbelinky.
- Cron/subagent followup: do not misclassify empty or `NO_REPLY` cron responses as interim acknowledgements that need a rerun, so deliberately silent cron jobs are no longer retried. (#41383) thanks @jackal092927.
- Cron/state errors: record `lastErrorReason` in cron job state and keep the gateway schema aligned with the full failover-reason set, including regression coverage for protocol conformance. (#14382) thanks @futuremind2026.
- Browser/Browserbase 429 handling: surface stable no-retry rate-limit guidance without buffering discarded HTTP 429 response bodies from remote browser services. (#40491) thanks @mvanhorn.
- CI/CodeQL Swift toolchain: select Xcode 26.1 before installing Swift build tools so the CodeQL Swift job uses Swift tools 6.2 on `macos-latest`. (#41787) thanks @BunsDev.
- Sandbox/subagents: pass the real configured workspace through `sessions_spawn` inheritance when a parent agent runs in a copied-workspace sandbox, so child `/agent` mounts point at the configured workspace instead of the parent sandbox copy. (#40757) Thanks @dsantoreis.
- Agents/fallback cooldown probing: cap cooldown-bypass probing to one attempt per provider per fallback run so multi-model same-provider cooldown chains can continue to cross-provider fallbacks instead of repeatedly stalling on duplicate cooldown probes. (#41711) Thanks @cgdusek.
- Telegram/direct delivery: bridge direct delivery sends to internal `message:sent` hooks so internal hook listeners observe successful Telegram deliveries. (#40185) Thanks @vincentkoc.
- Dependencies: refresh workspace dependencies except the pinned Carbon package, and harden ACP session-config writes against non-string SDK values so newer ACP clients fail fast instead of tripping type/runtime mismatches.
- Telegram/polling restarts: clear bounded cleanup timeout handles after `runner.stop()` and `bot.stop()` settle so stall recovery no longer leaves stray 15-second timers behind on clean shutdown. (#43188) thanks @kyohwang.

---

### 📦 v2026.3.12 (2026-03-13)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.3.12)

> [!NOTE]
> **DeXMart-relevant keywords:** `whatsapp`, `telegram`

#### Changes (Features)

- Control UI/dashboard-v2: refresh the gateway dashboard with modular overview, chat, config, agent, and session views, plus a command palette, mobile bottom tabs, and richer chat tools like slash commands, search, export, and pinned messages. (#41503) Thanks @BunsDev.
- OpenAI/GPT-5.4 fast mode: add configurable session-level fast toggles across `/fast`, TUI, Control UI, and ACP, with per-model config defaults and OpenAI/Codex request shaping.
- Anthropic/Claude fast mode: map the shared `/fast` toggle and `params.fastMode` to direct Anthropic API-key `service_tier` requests, with live verification for both Anthropic and OpenAI fast-mode tiers.
- Models/plugins: move Ollama, vLLM, and SGLang onto the provider-plugin architecture, with provider-owned onboarding, discovery, model-picker setup, and post-selection hooks so core provider wiring is more modular.
- Docs/Kubernetes: Add a starter K8s install path with raw manifests, Kind setup, and deployment docs. Thanks @sallyom @dzianisv @egkristi
- Agents/subagents: add `sessions_yield` so orchestrators can end the current turn immediately, skip queued tool work, and carry a hidden follow-up payload into the next session turn. (#36537) thanks @jriff
- Slack/agent replies: support `channelData.slack.blocks` in the shared reply delivery path so agents can send Block Kit messages through standard Slack outbound delivery. (#44592) Thanks @vincentkoc.

#### Fixes

- Security/device pairing: switch `/pair` and `openclaw qr` setup codes to short-lived bootstrap tokens so the next release no longer embeds shared gateway credentials in chat or QR pairing payloads. Thanks @lintsinghua.
- Security/plugins: disable implicit workspace plugin auto-load so cloned repositories cannot execute workspace plugin code without an explicit trust decision. (`GHSA-99qw-6mr3-36qr`)(#44174) Thanks @lintsinghua and @vincentkoc.
- Models/Kimi Coding: send `anthropic-messages` tools in native Anthropic format again so `kimi-coding` stops degrading tool calls into XML/plain-text pseudo invocations instead of real `tool_use` blocks. (#38669, #39907, #40552) Thanks @opriz.
- TUI/chat log: reuse the active assistant message component for the same streaming run so `openclaw tui` no longer renders duplicate assistant replies. (#35364) Thanks @lisitan.
- Telegram/model picker: make inline model button selections persist the chosen session model correctly, clear overrides when selecting the configured default, and include effective fallback models in `/models` button validation. (#40105) Thanks @avirweb.
- Cron/proactive delivery: keep isolated direct cron sends out of the write-ahead resend queue so transient-send retries do not replay duplicate proactive messages after restart. (#40646) Thanks @openperf and @vincentkoc.
- Models/Kimi Coding: send the built-in `User-Agent: claude-code/0.1.0` header by default for `kimi-coding` while still allowing explicit provider headers to override it, so Kimi Code subscription auth can work without a local header-injection proxy. (#30099) Thanks @Amineelfarssi and @vincentkoc.
- Models/OpenAI Codex Spark: keep `gpt-5.3-codex-spark` working on the `openai-codex/*` path via resolver fallbacks and clearer Codex-only handling, while continuing to suppress the stale direct `openai/*` Spark row that OpenAI rejects live.
- Ollama/Kimi Cloud: apply the Moonshot Kimi payload compatibility wrapper to Ollama-hosted Kimi models like `kimi-k2.5:cloud`, so tool routing no longer breaks when thinking is enabled. (#41519) Thanks @vincentkoc.
- Moonshot CN API: respect explicit `baseUrl` (api.moonshot.cn) in implicit provider resolution so platform.moonshot.cn API keys authenticate correctly instead of returning HTTP 401. (#33637) Thanks @chengzhichao-xydt.
- Kimi Coding/provider config: respect explicit `models.providers["kimi-coding"].baseUrl` when resolving the implicit provider so custom Kimi Coding endpoints no longer get overwritten by the built-in default. (#36353) Thanks @2233admin.
- Gateway/main-session routing: keep TUI and other `mode:UI` main-session sends on the internal surface when `deliver` is enabled, so replies no longer inherit the session's persisted Telegram/WhatsApp route. (#43918) Thanks @obviyus.
- BlueBubbles/self-chat echo dedupe: drop reflected duplicate webhook copies only when a matching `fromMe` event was just seen for the same chat, body, and timestamp, preventing self-chat loops without broad webhook suppression. Related to #32166. (#38442) Thanks @vincentkoc.
- iMessage/self-chat echo dedupe: drop reflected duplicate copies only when a matching `is_from_me` event was just seen for the same chat, text, and `created_at`, preventing self-chat loops without broad text-only suppression. Related to #32166. (#38440) Thanks @vincentkoc.
- Subagents/completion announce retries: raise the default announce timeout to 90 seconds and stop retrying gateway-timeout failures for externally delivered completion announces, preventing duplicate user-facing completion messages after slow gateway responses. Fixes #41235. Thanks @vasujain00 and @vincentkoc.
- Mattermost/block streaming: fix duplicate message delivery (one threaded, one top-level) when block streaming is active by excluding `replyToId` from the block reply dedup key and adding an explicit `threading` dock to the Mattermost plugin. (#41362) Thanks @mathiasnagler and @vincentkoc.
- Mattermost/reply media delivery: pass agent-scoped `mediaLocalRoots` through shared reply delivery so allowed local files upload correctly from button, slash-command, and model-picker replies. (#44021) Thanks @LyleLiu666.
- macOS/Reminders: add the missing `NSRemindersUsageDescription` to the bundled app so `apple-reminders` can trigger the system permission prompt from OpenClaw.app. (#8559) Thanks @dinakars777.
- Gateway/session discovery: discover disk-only and retired ACP session stores under custom templated `session.store` roots so ACP reconciliation, session-id/session-label targeting, and run-id fallback keep working after restart. (#44176) thanks @gumadeiras.
- Plugins/env-scoped roots: fix plugin discovery/load caches and provenance tracking so same-process `HOME`/`OPENCLAW_HOME` changes no longer reuse stale plugin state or misreport `~/...` plugins as untracked. (#44046) thanks @gumadeiras.
- Models/OpenRouter native ids: canonicalize native OpenRouter model keys across config writes, runtime lookups, fallback management, and `models list --plain`, and migrate legacy duplicated `openrouter/openrouter/...` config entries forward on write.
- Windows/native update: make package installs use the npm update path instead of the git path, carry portable Git into native Windows updates, and mirror the installer's Windows npm env so `openclaw update` no longer dies early on missing `git` or `node-llama-cpp` download setup.
- Sandbox/write: preserve pinned mutation-helper payload stdin so sandboxed `write` no longer reports success while creating empty files. (#43876) Thanks @glitch418x.
- Security/exec approvals: escape invisible Unicode format characters in approval prompts so zero-width command text renders as visible `\u{...}` escapes instead of spoofing the reviewed command. (`GHSA-pcqg-f7rg-xfvv`)(#43687) Thanks @EkiXu and @vincentkoc.
- Hooks/loader: fail closed when workspace hook paths cannot be resolved with `realpath`, so unreadable or broken internal hook paths are skipped instead of falling back to unresolved imports. (#44437) Thanks @vincentkoc.
- Hooks/agent deliveries: dedupe repeated hook requests by optional idempotency key so webhook retries can reuse the first run instead of launching duplicate agent executions. (#44438) Thanks @vincentkoc.
- Security/exec detection: normalize compatibility Unicode and strip invisible formatting code points before obfuscation checks so zero-width and fullwidth command tricks no longer suppress heuristic detection. (`GHSA-9r3v-37xh-2cf6`)(#44091) Thanks @wooluo and @vincentkoc.
- Security/exec allowlist: preserve POSIX case sensitivity and keep `?` within a single path segment so exact-looking allowlist patterns no longer overmatch executables across case or directory boundaries. (`GHSA-f8r2-vg7x-gh8m`)(#43798) Thanks @zpbrent and @vincentkoc.
- Security/commands: require sender ownership for `/config` and `/debug` so authorized non-owner senders can no longer reach owner-only config and runtime debug surfaces. (`GHSA-r7vr-gr74-94p8`)(#44305) Thanks @tdjackey and @vincentkoc.
- Security/gateway auth: clear unbound client-declared scopes on shared-token WebSocket connects so device-less shared-token operators cannot self-declare elevated scopes. (`GHSA-rqpp-rjj8-7wv8`)(#44306) Thanks @LUOYEcode and @vincentkoc.
- Security/browser.request: block persistent browser profile create/delete routes from write-scoped `browser.request` so callers can no longer persist admin-only browser profile changes through the browser control surface. (`GHSA-vmhq-cqm9-6p7q`)(#43800) Thanks @tdjackey and @vincentkoc.
- Security/agent: reject public spawned-run lineage fields and keep workspace inheritance on the internal spawned-session path so external `agent` callers can no longer override the gateway workspace boundary. (`GHSA-2rqg-gjgv-84jm`)(#43801) Thanks @tdjackey and @vincentkoc.
- Security/session_status: enforce sandbox session-tree visibility and shared agent-to-agent access guards before reading or mutating target session state, so sandboxed subagents can no longer inspect parent session metadata or write parent model overrides via `session_status`. (`GHSA-wcxr-59v9-rxr8`)(#43754) Thanks @tdjackey and @vincentkoc.
- Security/agent tools: mark `nodes` as explicitly owner-only and document/test that `canvas` remains a shared trusted-operator surface unless a real boundary bypass exists.
- Security/exec approvals: fail closed for Ruby approval flows that use `-r`, `--require`, or `-I` so approval-backed commands no longer bind only the main script while extra local code-loading flags remain outside the reviewed file snapshot.
- Security/device pairing: cap issued and verified device-token scopes to each paired device's approved scope baseline so stale or overbroad tokens cannot exceed approved access. (`GHSA-2pwv-x786-56f8`)(#43686) Thanks @tdjackey and @vincentkoc.
- Docs/onboarding: align the legacy wizard reference and `openclaw onboard` command docs with the Ollama onboarding flow so all onboarding reference paths now document `--auth-choice ollama`, Cloud + Local mode, and non-interactive usage. (#43473) Thanks @BruceMacD.
- Models/secrets: enforce source-managed SecretRef markers in generated `models.json` so runtime-resolved provider secrets are not persisted when runtime projection is skipped. (#43759) Thanks @joshavant.
- Security/WebSocket preauth: shorten unauthenticated handshake retention and reject oversized pre-auth frames before application-layer parsing to reduce pre-pairing exposure on unsupported public deployments. (`GHSA-jv4g-m82p-2j93`)(#44089) (`GHSA-xwx2-ppv2-wx98`)(#44089) Thanks @ez-lbz and @vincentkoc.
- Security/proxy attachments: restore the shared media-store size cap for persisted browser proxy files so oversized payloads are rejected instead of overriding the intended 5 MB limit. (`GHSA-6rph-mmhp-h7h9`)(#43684) Thanks @tdjackey and @vincentkoc.
- Security/host env: block inherited `GIT_EXEC_PATH` from sanitized host exec environments so Git helper resolution cannot be steered by host environment state. (`GHSA-jf5v-pqgw-gm5m`)(#43685) Thanks @zpbrent and @vincentkoc.
- Security/Feishu webhook: require `encryptKey` alongside `verificationToken` in webhook mode so unsigned forged events are rejected instead of being processed with token-only configuration. (`GHSA-g353-mgv3-8pcj`)(#44087) Thanks @lintsinghua and @vincentkoc.
- Security/Feishu reactions: preserve looked-up group chat typing and fail closed on ambiguous reaction context so group authorization and mention gating cannot be bypassed through synthetic `p2p` reactions. (`GHSA-m69h-jm2f-2pv8`)(#44088) Thanks @zpbrent and @vincentkoc.
- Security/LINE webhook: require signatures for empty-event POST probes too so unsigned requests no longer confirm webhook reachability with a `200` response. (`GHSA-mhxh-9pjm-w7q5`)(#44090) Thanks @TerminalsandCoffee and @vincentkoc.
- Security/Zalo webhook: rate limit invalid secret guesses before auth so weak webhook secrets cannot be brute-forced through unauthenticated churned requests without pre-auth `429` responses. (`GHSA-5m9r-p9g7-679c`)(#44173) Thanks @zpbrent and @vincentkoc.
- Security/Zalouser groups: require stable group IDs for allowlist auth by default and gate mutable group-name matching behind `channels.zalouser.dangerouslyAllowNameMatching`. Thanks @zpbrent.
- Security/Slack and Teams routing: require stable channel and team IDs for allowlist routing by default, with mutable name matching only via each channel's `dangerouslyAllowNameMatching` break-glass flag.
- Security/exec approvals: fail closed for ambiguous inline loader and shell-payload script execution, bind the real script after POSIX shell value-taking flags, and unwrap `pnpm`/`npm exec`/`npx` script runners before approval binding. (`GHSA-57jw-9722-6rf2`)(`GHSA-jvqh-rfmh-jh27`)(`GHSA-x7pp-23xv-mmr4`)(`GHSA-jc5j-vg4r-j5jx`)(#44247) Thanks @tdjackey and @vincentkoc.
- Doctor/gateway service audit: canonicalize service entrypoint paths before comparing them so symlink-vs-realpath installs no longer trigger false "entrypoint does not match the current install" repair prompts. (#43882) Thanks @ngutman.
- Doctor/gateway service audit: earlier groundwork for this fix landed in the superseded #28338 branch. Thanks @realriphub.
- Gateway/session stores: regenerate the Swift push-test protocol models and align Windows native session-store realpath handling so protocol checks and sync session discovery stop drifting on Windows. (#44266) thanks @jalehman.
- Context engine/session routing: forward optional `sessionKey` through context-engine lifecycle calls so plugins can see structured routing metadata during bootstrap, assembly, post-turn ingestion, and compaction. (#44157) thanks @jalehman.
- Agents/failover: classify z.ai `network_error` stop reasons as retryable timeouts so provider connectivity failures trigger fallback instead of surfacing raw unhandled-stop-reason errors. (#43884) Thanks @hougangdev.
- Memory/session sync: add mode-aware post-compaction session reindexing with `agents.defaults.compaction.postIndexSync` plus `agents.defaults.memorySearch.sync.sessions.postCompactionForce`, so compacted session memory can refresh immediately without forcing every deployment into synchronous reindexing. (#25561) thanks @rodrigouroz.
- Telegram/model picker: make inline model button selections persist the chosen session model correctly, clear overrides when selecting the configured default, and include effective fallback models in `/models` button validation. (#40105) Thanks @avirweb.
- Telegram/native command sync: suppress expected `BOT_COMMANDS_TOO_MUCH` retry error noise, add a final fallback summary log, and document the difference between command-menu overflow and real Telegram network failures.
- Mattermost/reply media delivery: pass agent-scoped `mediaLocalRoots` through shared reply delivery so allowed local files upload correctly from button, slash-command, and model-picker replies. (#44021) Thanks @LyleLiu666.
- Plugins/env-scoped roots: fix plugin discovery/load caches and provenance tracking so same-process `HOME`/`OPENCLAW_HOME` changes no longer reuse stale plugin state or misreport `~/...` plugins as untracked. (#44046) thanks @gumadeiras.
- Gateway/session discovery: discover disk-only and retired ACP session stores under custom templated `session.store` roots so ACP reconciliation, session-id/session-label targeting, and run-id fallback keep working after restart. (#44176) thanks @gumadeiras.
- Models/OpenRouter native ids: canonicalize native OpenRouter model keys across config writes, runtime lookups, fallback management, and `models list --plain`, and migrate legacy duplicated `openrouter/openrouter/...` config entries forward on write.
- Gateway/hooks: bucket hook auth failures by forwarded client IP behind trusted proxies and warn when `hooks.allowedAgentIds` leaves hook routing unrestricted.
- Agents/compaction: skip the post-compaction `cache-ttl` marker write when a compaction completed in the same attempt, preventing the next turn from immediately triggering a second tiny compaction. (#28548) thanks @MoerAI.
- Native chat/macOS: add `/new`, `/reset`, and `/clear` reset triggers, keep shared main-session aliases aligned, and ignore stale model-selection completions so native chat state stays in sync across reset and fast model changes. (#10898) Thanks @Nachx639.
- Agents/compaction safeguard: route missing-model and missing-API-key cancellation warnings through the shared subsystem logger so they land in structured and file logs. (#9974) Thanks @dinakars777.
- Cron/doctor: stop flagging canonical `agentTurn` and `systemEvent` payload kinds as legacy cron storage, while still normalizing whitespace-padded and non-canonical variants. (#44012) Thanks @shuicici.
- ACP/client final-message delivery: preserve terminal assistant text snapshots before resolving `end_turn`, so ACP clients no longer drop the last visible reply when the gateway sends the final message body on the terminal chat event. (#17615) Thanks @pjeby.
- Telegram/Discord status reactions: show a temporary compacting reaction during auto-compaction pauses and restore thinking afterward so the bot no longer appears frozen while context is being compacted. (#35474) thanks @Cypherm.

---

### 📦 v2026.3.22 (2026-03-23)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.3.22)

> [!CAUTION]
> **Injection Point Impact Detected:**
> - **src/web/session.ts** (matched: `baileys`)
> - **src/ingress/ingress-service.ts** (matched: `runEmbeddedPiAgent`)

> [!NOTE]
> **DeXMart-relevant keywords:** `whatsapp`, `telegram`

#### ⚠️ Breaking Changes

- Plugins/install: bare `openclaw plugins install <package>` now prefers ClawHub before npm for npm-safe names, and only falls back to npm when ClawHub does not have that package or version. Docs: https://docs.openclaw.ai/tools/clawhub
- Browser/Chrome MCP: remove the legacy Chrome extension relay path, bundled extension assets, `driver: "extension"`, and `browser.relayBindHost`. Run `openclaw doctor --fix` to migrate host-local browser config to `existing-session` / `user`; Docker, headless, sandbox, and remote browser flows still use raw CDP. Docs: https://docs.openclaw.ai/gateway/doctor and https://docs.openclaw.ai/tools/browser (#47893) Thanks @vincentkoc.
- Tools/image generation: standardize the stock image create/edit path on the core `image_generate` tool. The old `nano-banana-pro` docs/examples are gone; if you previously copied that sample-skill config, switch to `agents.defaults.imageGenerationModel` for built-in image generation or install a separate third-party skill explicitly.
- Skills/image generation: remove the bundled `nano-banana-pro` skill wrapper. Use `agents.defaults.imageGenerationModel.primary: "google/gemini-3-pro-image-preview"` for the native Nano Banana-style path instead.
- Plugins/SDK: the new public plugin SDK surface is `openclaw/plugin-sdk/*`; `openclaw/extension-api` is removed with no compatibility shim. Bundled plugins must use injected runtime for host-side operations (for example `api.runtime.agent.runEmbeddedPiAgent`) and any remaining direct imports must come from narrow `openclaw/plugin-sdk/*` subpaths instead of the monolithic SDK root. Docs: https://docs.openclaw.ai/plugins/sdk-migration and https://docs.openclaw.ai/plugins/sdk-overview
- Plugins/message discovery: require `ChannelMessageActionAdapter.describeMessageTool(...)` for shared `message` tool discovery. The legacy `listActions`, `getCapabilities`, and `getToolSchema` adapter methods are removed. Plugin authors should migrate message discovery to `describeMessageTool(...)` and keep channel-specific action runtime code inside the owning plugin package. Thanks @gumadeiras.
- Plugins/Matrix: add a new Matrix plugin backed by the official `matrix-js-sdk`. If you are upgrading from the previous public Matrix plugin, follow the migration guide: https://docs.openclaw.ai/install/migrating-matrix Thanks @gumadeiras.
- Config/env: remove legacy `CLAWDBOT_*` and `MOLTBOT_*` compatibility env names across runtime, installers, and test tooling. Use the matching `OPENCLAW_*` env names instead.
- Config/state: remove legacy `.moltbot` state-dir and `moltbot.json` auto-detection/migration fallback. If you still keep state under `~/.moltbot`, move it to `~/.openclaw` or set `OPENCLAW_STATE_DIR` / `OPENCLAW_CONFIG_PATH` explicitly. Docs: https://docs.openclaw.ai/install/migrating and https://docs.openclaw.ai/start/getting-started
- Exec/env sandbox: block build-tool JVM injection (`MAVEN_OPTS`, `SBT_OPTS`, `GRADLE_OPTS`, `ANT_OPTS`), glibc tunable exploitation (`GLIBC_TUNABLES`), and .NET dependency resolution hijack (`DOTNET_ADDITIONAL_DEPS`) from the host exec environment, and restrict Gradle init script redirect (`GRADLE_USER_HOME`) as an override-only block so user-configured Gradle homes still propagate. (#49702)
- Discord/commands: switch native command deployment to Carbon reconcile by default so Discord restarts stop churning slash commands through OpenClaw’s local deploy path. (#46597) Thanks @huntharo and @thewilloftheshadow.
- Security/exec approvals: treat `time` as a transparent dispatch wrapper during allowlist evaluation and allow-always persistence so approved `time ...` commands bind the inner executable instead of the wrapper path. Thanks @YLChen-007 for reporting.
- Voice-call/webhooks: reject missing provider signature headers before body reads, drop the pre-auth body budget to `64 KB` / `5s`, and cap concurrent pre-auth requests per source IP so unauthenticated callers cannot force the old `1 MB` / `30s` buffering path. Thanks @SEORY0 for reporting.
- Plugins/Matrix: stop mention-gated or otherwise dropped room chatter from refreshing focused thread bindings before the message is actually routed, so idle ACP and session bindings can still expire normally in mention-required rooms. Thanks @vincentkoc, @dinakars777 and @mvanhorn.
- Plugins/Matrix: durably dedupe inbound room events across gateway restarts so previously handled Matrix messages are not replayed as new, while preserving clean-restart backlog delivery for unseen events. (#50922) thanks @gumadeiras
- Agents/media replies: migrate the remaining browser, canvas, and nodes snapshot outputs onto `details.media` so generated media keeps attaching to assistant replies after the collect-then-attach refactor. (#51731) Thanks @christianklotz.
- Android/contacts search: escape literal `%` and `_` in contact-name queries so searches like `100%` or `_id` no longer match unrelated contacts through SQL `LIKE` wildcards. (#41891) Thanks @Kaneki-x.
- Gateway/usage: include reset and deleted archived session transcripts in usage totals, session discovery, and archived-only session detail fallback so the Usage view no longer undercounts rotated sessions. (#43215) Thanks @rcrick.

#### Changes (Features)

- ClawHub/install: add native `openclaw skills search|install|update` flows plus `openclaw plugins install clawhub:<package>` with tracked update metadata, gateway skill-install/update support for ClawHub-backed requests, and regression coverage/docs for the new source path.
- Plugins/marketplaces: add Claude marketplace registry resolution, `plugin@marketplace` installs, marketplace listing, and update support, plus Docker E2E coverage for local and official marketplace flows. (#48058) Thanks @vincentkoc.
- Commands/plugins: add owner-gated `/plugins` and `/plugin` chat commands for plugin list/show and enable/disable flows, alongside explicit `commands.plugins` config gating. Thanks @vincentkoc.
- Install/update: allow package-manager installs from GitHub `main` via `openclaw update --tag main`, installer `--version main`, or direct npm/pnpm git specs. (#47630) Thanks @vincentkoc.
- Plugins/bundles: add compatible Codex, Claude, and Cursor bundle discovery/install support, map bundle skills into OpenClaw skills, and apply Claude bundle `settings.json` defaults to embedded Pi with shell overrides sanitized.
- CLI/hooks: route hook-pack install and update through `openclaw plugins`, keep `openclaw hooks` focused on hook visibility and per-hook controls, and show plugin-managed hook details in CLI output.
- Models/OpenAI: switch the default OpenAI setup model to `openai/gpt-5.4`, keep Codex on `openai-codex/gpt-5.4`, and centralize OpenAI chat, image, TTS, transcription, and embedding defaults in one shared module so future default-model updates stay low-churn. Thanks @vincentkoc.
- Agents: add per-agent thinking/reasoning/fast defaults and auto-revert disallowed model overrides to the agent's default selection. Thanks @xuanmingguo and @vincentkoc.
- Commands/btw: add `/btw` side questions for quick tool-less answers about the current session without changing future session context, with dismissible in-session TUI answers and explicit BTW replies on external channels. (#45444) Thanks @ngutman.
- Sandbox/runtime: add pluggable sandbox backends, ship an OpenShell backend with `mirror` and `remote` workspace modes, and make sandbox list/recreate/prune backend-aware instead of Docker-only.
- Sandbox/SSH: add a core SSH sandbox backend with secret-backed key, certificate, and known_hosts inputs, move shared remote exec/filesystem tooling into core, and keep OpenShell focused on sandbox lifecycle plus optional `mirror` mode.
- Browser/existing-session: support `browser.profiles.<name>.userDataDir` so Chrome DevTools MCP can attach to Brave, Edge, and other Chromium-based browsers through their own user data directories. (#48170) Thanks @velvet-shark.
- Plugins/bundles: make enabled bundle MCP servers expose runnable tools in embedded Pi, and default relative bundle MCP launches to the bundle root so marketplace bundles like Context7 work through Pi instead of stopping at config import.
- Plugins/providers: move OpenRouter, GitHub Copilot, and OpenAI Codex provider/runtime logic into bundled plugins, including dynamic model fallback, runtime auth exchange, stream wrappers, capability hints, and cache-TTL policy.
- Models/Anthropic Vertex: add core `anthropic-vertex` provider support for Claude via Google Vertex AI, including GCP auth/discovery and main run-path routing. (#43356) Thanks @sallyom and @yossiovadia.
- Plugins/Chutes: add a bundled Chutes provider with plugin-owned OAuth/API-key auth, dynamic model discovery, and default-on extension wiring. (#41416) Thanks @Veightor.
- Web tools/Exa: add Exa as a bundled web-search plugin with Exa-native date filters, search-mode selection, and optional content extraction under `plugins.entries.exa.config.webSearch.*`. Thanks @V-Gutierrez and @vincentkoc.
- Web tools/Tavily: add Tavily as a bundled web-search provider with dedicated `tavily_search` and `tavily_extract` tools, using canonical plugin-owned config under `plugins.entries.tavily.config.webSearch.*`. (#49200) thanks @lakshyaag-tavily.
- Web tools/Firecrawl: add Firecrawl as an `onboard`/configure search provider via a bundled plugin, expose explicit `firecrawl_search` and `firecrawl_scrape` tools, and align core `web_fetch` fallback behavior with Firecrawl base-URL/env fallback plus guarded endpoint fetches.
- Models/OpenAI: add native forward-compat support for `gpt-5.4-mini` and `gpt-5.4-nano` in the OpenAI provider catalog, runtime resolution, and reasoning capability gates. Thanks @vincentkoc.
- Control UI/chat: add an expand-to-canvas button on assistant chat bubbles and in-app session navigation from Sessions and Cron views. Thanks @BunsDev.
- Control UI/appearance: unify theme border radii across Claw, Knot, and Dash, and add a Roundness slider to the Appearance settings so users can adjust corner radius from sharp to fully rounded. Thanks @BunsDev.
- Control UI/usage: improve usage overview styling, localization, and responsive chat/context-notice presentation, including safer theme color handling and unclipped usage-header menus. (#51951) Thanks @BunsDev.
- Control UI/usage: drop the empty session-detail placeholder card so the usage view stays single-column until a real session detail panel is selected. (#52013) Thanks @BunsDev.
- Android/mobile: add a system-aware dark theme across onboarding and post-onboarding screens so the app follows the device theme through setup, chat, and voice flows. (#46249) Thanks @sibbl.
- Android/Talk: move Talk speech synthesis behind gateway `talk.speak`, keep Talk secrets on the gateway, and switch Android playback to final-response audio instead of device-local ElevenLabs streaming. (#50849)
- Android/nodes: add `callLog.search` plus shared Call Log permission wiring so Android nodes can search recent call history through the gateway. (#44073) Thanks @lixuankai.
- Android/nodes: add `sms.search` plus shared SMS permission wiring so Android nodes can search device text messages through the gateway. (#48299) Thanks @lixuankai.
- Telegram/apiRoot: add per-account custom Bot API endpoint support across send, probe, setup, doctor repair, and inbound media download paths so proxied or self-hosted Telegram deployments work end to end. (#48842) Thanks @Cypherm.
- Telegram/topics: auto-rename DM forum topics on first message with LLM-generated labels, with per-account and per-DM `autoTopicLabel` overrides. (#51502) Thanks @Lukavyi.
- Telegram/actions: add `topic-edit` for forum-topic renames and icon updates while sharing the same Telegram topic-edit transport used by the plugin runtime. (#47798) Thanks @obviyus.
- Telegram/error replies: add a default-off `channels.telegram.silentErrorReplies` setting so bot error replies can be delivered silently across regular replies, native commands, and fallback sends. (#19776) Thanks @ImLukeF.
- Feishu/cards: add structured interactive approval and quick-action launcher cards, preserve callback user and conversation context through routing, and keep legacy card-action fallback behavior so common actions can run without typing raw commands. (#47873) Thanks @Takhoffman.
- Feishu/ACP: add current-conversation ACP and subagent session binding for supported DMs and topic conversations, including completion delivery back to the originating Feishu conversation. (#46819) Thanks @Takhoffman.
- Feishu/streaming: add `onReasoningStream` and `onReasoningEnd` support to streaming cards, so `/reasoning stream` renders thinking tokens as markdown blockquotes in the same card — matching the Telegram channel's reasoning lane behavior. (#46029) Thanks @day253.
- Feishu/cards: add identity-aware structured card headers and note footers for Feishu replies and direct sends, while keeping that presentation wired through the shared outbound identity path. (#29938) Thanks @nszhsl.
- Plugins/Matrix: add `allowBots` room policy so configured Matrix bot accounts can talk to each other, with optional mention-only gating. Thanks @gumadeiras.
- Plugins/Matrix: add per-account `allowPrivateNetwork` opt-in for private/internal homeservers, while keeping public cleartext homeservers blocked. Thanks @gumadeiras.
- Plugins/MiniMax: add MiniMax-M2.7 and MiniMax-M2.7-highspeed models and update the default model from M2.5 to M2.7. (#49691) Thanks @liyuan97.
- MiniMax/fast mode: map shared `/fast` and `params.fastMode` to MiniMax `-highspeed` models for M2.1, M2.5, and M2.7 API-key and OAuth runs. Thanks @vincentkoc.
- Models/MiniMax defaults: raise bundled MiniMax M2.5/M2.7 context-window, max-token, and pricing metadata to the higher defaults shipped by the current upstream Pi SDK. Thanks @vincentkoc.
- Models/MiniMax: add bundled `MiniMax-M2`, `MiniMax-M2.1`, and `MiniMax-M2.1-highspeed` catalog entries so OpenClaw's provider metadata and OAuth aliases stay aligned with the current upstream Pi SDK. Thanks @vincentkoc.
- Plugins/MiniMax: merge the bundled MiniMax API and MiniMax OAuth plugin surfaces into a single default-on `minimax` plugin, while keeping legacy `minimax-portal-auth` config ids aliased for compatibility.
- Agents/Pi compatibility: align OpenClaw's bundled MiniMax runtime behavior with the current upstream Pi 0.61.1 release so embedded runs stay in sync with the latest published Pi SDK semantics. Thanks @vincentkoc.
- Models/GitHub Copilot: allow forward-compat dynamic model ids without code updates, while preserving configured provider and per-model overrides for those synthetic models. (#51325) Thanks @fuller-stack-dev.
- xAI/models: sync the bundled Grok catalog to current Pi-backed IDs, limits, and pricing metadata, while keeping older Grok fast and 4.20 aliases resolving cleanly at runtime. Thanks @vincentkoc.
- xAI/fast mode: map shared `/fast` and `params.fastMode` to the current xAI Grok fast model family so direct Grok runs can opt into the faster Pi-backed variants. Thanks @vincentkoc.
- CLI/config: expand `config set` with SecretRef and provider builder modes, JSON/batch assignment support, and `--dry-run` validation with structured JSON output. (#49296) Thanks @joshavant.
- Z.AI/models: sync the bundled GLM catalog to current Pi metadata, including newer 4.5/4.6 model families, updated multimodal entries, and current pricing and token limits. Thanks @vincentkoc.
- Mistral/models: sync the bundled default Mistral metadata to current Pi pricing so the built-in default no longer advertises zero-cost usage. Thanks @vincentkoc.
- Plugins/Xiaomi: switch the bundled Xiaomi provider to the `/v1` OpenAI-compatible endpoint and add MiMo V2 Pro plus MiMo V2 Omni to the built-in catalog. (#49214) thanks @DJjjjhao.
- Agents/compaction: notify users when followup auto-compaction starts and finishes, keeping those notices out of TTS and preserving reply threading for the real assistant reply. (#38805) Thanks @zidongdesign.
- Memory/plugins: let the active memory plugin register its own system-prompt section while preserving cache-clear and snapshot-load prompt isolation. (#40126) Thanks @jarimustonen.
- Gateway/health monitor: add configurable stale-event thresholds and restart limits, plus per-channel and per-account `healthMonitor.enabled` overrides, while keeping the existing global disable path on `gateway.channelHealthCheckMinutes=0`. (#42107) Thanks @rstar327.
- Plugins/agent integrations: broaden the plugin surface for app-server integrations with channel-aware commands, interactive callbacks, inbound claims, and Discord/Telegram conversation binding support. (#45318) Thanks @huntharo and @vincentkoc.
- Plugins/binding: add `onConversationBindingResolved(...)` so plugins can react immediately after bind approvals or denies without blocking channel interaction acknowledgements. (#48678) Thanks @huntharo.
- Plugins/context engines: expose `delegateCompactionToRuntime(...)` on the public plugin SDK, refactor the legacy engine to use the shared helper, and clarify `ownsCompaction` delegation semantics for non-owning engines. (#49061) Thanks @jalehman.
- Plugins/context engines: pass the embedded runner `modelId` into context-engine `assemble()` so plugins can adapt context formatting per model. (#47437) thanks @jscianna.
- Plugins/context engines: add transcript maintenance rewrites for context engines, preserve active-branch transcript metadata during rewrites, and harden overflow-recovery truncation to rewrite sessions under the normal session write lock. (#51191) Thanks @jalehman.
- Skills/prompt budget: preserve all registered skills via a compact catalog fallback before dropping entries when the full prompt format exceeds `maxSkillsPromptChars`. (#47553) Thanks @snese.
- Hooks/workspace: keep repo-local `<workspace>/hooks` disabled until explicitly enabled, block workspace hook name collisions from shadowing bundled/managed/plugin hooks, and treat `hooks.internal.load.extraDirs` as trusted managed hook sources.
- Security/plugins: reject remote marketplace manifest entries that expand installation outside the cloned marketplace repo, including external git/GitHub sources, HTTP archives, and absolute paths.
- Gateway/docs: clarify that empty URL input allowlists are treated as unset, document `allowUrl: false` as the deny-all switch, and add regression coverage for the normalization path.
- secrets: harden read-only SecretRef command paths and diagnostics. (#47794) Thanks @joshavant.
- Scope message SecretRef resolution and harden doctor/status paths. (#48728) Thanks @joshavant.
- Build/memory tools: emit `dist/cli/memory-cli.js` as a stable core entry so runtime `memory_search` loading no longer depends on hashed `memory-cli-*` bundle names. (#51759) Thanks @oliviareid-svg.
- Plugins/testing: add a public `openclaw/plugin-sdk/testing` surface for plugin-author test helpers, and move bundled-extension-only test bridges out of `extensions/` into private repo test helpers.
- Agents/steering docs: update embedded Pi steering docs and runner comments for the current upstream behavior, where queued steering is injected after the active assistant turn finishes its tool calls instead of skipping the remaining tools mid-turn. Thanks @vincentkoc.
- Doctor/refactor: start splitting doctor provider checks into `src/commands/doctor/providers/*` by extracting Telegram first-run and group allowlist warnings into a provider-specific module, keeping the current setup guidance and warning behavior intact. Thanks @vincentkoc.
- Refactor/channels: remove the legacy channel shim directories and point channel-specific imports directly at the extension-owned implementations. (#45967) Thanks @scoootscooob.
- Docs/Zalo: clarify the Marketplace-bot support matrix and config guidance so the Zalo channel docs match current Bot Creator behavior more closely. (#47552) Thanks @No898.
- Docs/plugins: add the community DingTalk plugin listing to the docs catalog. (#29913) Thanks @sliverp.
- Docs/plugins: add the community QQbot plugin listing to the docs catalog. (#29898) Thanks @sliverp.
- Docs/plugins: add the community wecom plugin listing to the docs catalog. (#29905) Thanks @sliverp.

#### Fixes

- Web tools/search provider lists: keep onboarding, configure, and docs provider lists alphabetical while preserving the separate runtime auto-detect precedence used for credential-based provider selection.
- Media/Windows security: block remote-host `file://` media URLs and UNC/network paths before local filesystem resolution in core media loading and adjacent prompt/sandbox attachment seams, so the next release no longer allows structured local-media inputs to trigger outbound SMB credential handshakes on Windows. Thanks @RacerZ-fighting for reporting.
- Gateway/discovery: fail closed on unresolved Bonjour and DNS-SD service endpoints in CLI discovery, onboarding, and `gateway status` so TXT-only hints can no longer steer routing or SSH auto-target selection. Thanks @nexrin for reporting.
- Security/pairing: bind iOS setup codes to the intended node profile and reject first-use bootstrap redemption that asks for broader roles or scopes. Thanks @tdjackey.
- Memory/core tools: register `memory_search` and `memory_get` independently so one unavailable memory tool no longer suppresses the other in new sessions. (#50198) Thanks @artwalker.
- Web tools/Exa: align the bundled Exa plugin with the current Exa API by supporting newer search types and richer `contents` options, while fixing the result-count cap to honor Exa's higher limit. Thanks @vincentkoc.
- Plugins/Matrix: move bundled plugin `KeyedAsyncQueue` imports onto the stable `plugin-sdk/core` surface so Matrix Docker/runtime builds do not depend on the brittle keyed-async-queue subpath. Thanks @ecohash-co and @vincentkoc.
- Nostr/security: enforce inbound DM policy before decrypt, route Nostr DMs through the standard reply pipeline, and add pre-crypto rate and size guards so unknown senders cannot bypass pairing or force unbounded crypto work. Thanks @kuranikaran.
- Synology Chat/security: keep reply delivery bound to stable numeric `user_id` by default, and gate mutable username/nickname recipient lookup behind `dangerouslyAllowNameMatching` with new regression coverage. Thanks @nexrin.
- Agents/default timeout: raise the shared default agent timeout from `600s` to `48h` so long-running ACP and agent sessions do not fail unless you configure a shorter limit.
- Gateway/startup: load bundled channel plugins from compiled `dist/extensions` entries in built installs, so gateway boot no longer recompiles bundled extension TypeScript on every startup and WhatsApp-class cold starts drop back to seconds instead of tens of seconds or worse. (#47560) Thanks @ngutman.
- Gateway/startup: prewarm the configured primary model before channel startup and retry one transient provider-runtime miss so the first Telegram or Discord message after boot no longer fails with `Unknown model: openai-codex/gpt-5.4`. Thanks @vincentkoc.
- CLI/startup: lazy-load channel add and root help startup paths to trim avoidable RSS and help latency on constrained hosts. (#46784) Thanks @vincentkoc.
- Configure/startup: move outbound send-deps resolution into a lightweight helper so `openclaw configure` no longer stalls after the banner while eagerly loading channel plugins. (#46301) Thanks @scoootscooob.
- CLI/auth choice: lazy-load plugin/provider fallback resolution so mapped auth choices stay on the static path and only unknown choices pay the heavy provider load. (#47495) Thanks @vincentkoc.
- Gateway/Discord startup: load only configured channel plugins during gateway boot, and lazy-load Discord provider/session runtime setup so startup stops importing unrelated providers and trims cold-start delay. Thanks @vincentkoc.
- Agents/inbound: lazy-load media and link understanding for plain-text turns and cache synced auth stores by auth-file state so ordinary inbound replies avoid unnecessary startup churn. Thanks @vincentkoc.
- Agents/openai-compatible tool calls: deduplicate repeated tool call ids across live assistant messages and replayed history so OpenAI-compatible backends no longer reject duplicate `tool_call_id` values with HTTP 400. (#40996) Thanks @xaeon2026.
- Agents/openai-responses: strip `prompt_cache_key` and `prompt_cache_retention` for non-OpenAI-compatible Responses endpoints while keeping them on direct OpenAI and Azure OpenAI paths, so third-party OpenAI-compatible providers no longer reject those requests with HTTP 400. (#49877) Thanks @ShaunTsai.
- Models/openai-completions: default non-native OpenAI-compatible providers to omit tool-definition `strict` fields unless users explicitly opt back in, so tool calling keeps working on providers that reject that option. (#45497) Thanks @sahancava.
- Models/OpenRouter runtime capabilities: fetch uncatalogued OpenRouter model metadata on first use so newly added vision models keep image input instead of silently degrading to text-only, with top-level capability field fallbacks for `/api/v1/models`. (#45824) Thanks @DJjjjhao.
- Control UI/session routing: preserve established external delivery routes when webchat views or sends in externally originated sessions, so subagent completions still return to the original channel instead of the dashboard. (#47797) Thanks @brokemac79.
- Telegram/replies: set `allow_sending_without_reply` on reply-targeted sends and media-error notices so deleted parent messages no longer drop otherwise valid replies. (#52524) Thanks @moltbot886.
- Telegram/polling: hard-timeout stuck `getUpdates` requests so wedged network paths fail over sooner instead of waiting for the polling stall watchdog. Thanks @vincentkoc.
- Android/location: make current-location requests drop late callbacks after timeout instead of crashing with `Already resumed`. (#52318) Thanks @Kaneki-x.
- Android/pairing: resolve portless secure setup URLs to `443` while preserving direct cleartext gateway defaults and explicit `:80` manual endpoints in onboarding. (#43540) Thanks @fmercurio.
- Android/canvas: ignore bridge messages from pages outside the bundled scaffold and trusted A2UI surfaces. Thanks @vincentkoc.
- CLI/status: keep `status --json` stdout clean by skipping plugin compatibility scans that were not rendered in the JSON payload. (#52449) Thanks @cgdusek.
- WhatsApp/reconnect: restore the append recency filter in the extension inbox monitor and handle protobuf `Long` timestamps correctly, so fresh post-reconnect append messages are processed while stale history sync stays suppressed. (#42588) Thanks @MonkeyLeeT.
- WhatsApp/login: wait for pending creds writes before reopening after Baileys `515` pairing restarts in both QR login and `channels login` flows, and keep the restart coverage pinned to the real wrapped error shape plus per-account creds queues. (#27910) Thanks @asyncjason.
- Android/canvas: serialize A2UI action-status event strings before evaluating WebView JS, so action ids and multiline errors do not break the callback dispatch. (#43784) Thanks @Kaneki-x.
- Android/camera: recycle intermediate and final snap bitmaps in `camera.snap` so repeated captures do not leak native image memory. (#41902) Thanks @Kaneki-x.
- Control UI/logging: make browser-safe logger imports avoid eager temp-dir resolution so the bundled Control UI no longer crashes to a blank screen when logging reaches `tmp-openclaw-dir`. (#48469) Fixes #48062. Thanks @7inspire.
- Control UI/chat sessions: show human-readable labels in the grouped session dropdown again, keep unique scoped fallbacks when metadata is missing, and disambiguate duplicate labels only when needed. (#45130) Thanks @luzhidong.
- Telegram/replies: ignore malformed non-string reply text and caption fields when describing reply context, so unexpected Telegram reply payloads no longer break inbound context assembly. (#50500) Thanks @p3nchan.
- Control UI/dashboard: preserve structured gateway shutdown reasons across restart disconnects so config-triggered restarts no longer fall back to `disconnected (1006): no reason`. (#46580) Fixes #46532. Thanks @vincentkoc.
- Android/chat: theme the thinking dropdown and TLS trust dialogs explicitly so popup surfaces match the active app theme instead of falling back to mismatched Material defaults.
- Node/startup: remove leftover debug `console.log("node host PATH: ...")` that printed the resolved PATH on every `openclaw node run` invocation. (#46515) Fixes #46411. Thanks @ademczuk.
- Slack/startup: harden `@slack/bolt` import interop across current bundled runtime shapes so Slack monitors no longer crash with `App is not a constructor` after plugin-sdk bundling changes. (#45953) Thanks @merc1305.
- Control UI/model switching: preserve the selected provider prefix when switching models from the chat dropdown, so multi-provider setups no longer send `anthropic/gpt-5.2`-style mismatches when the user picked `openai/gpt-5.2`. (#47581) Thanks @chrishham.
- Control UI/storage: scope persisted settings keys by gateway base path, with migration from the legacy shared key, so multiple gateways under one domain stop overwriting each other's dashboard preferences. (#47932) Thanks @bobBot-claw.
- Control UI/overview: keep the language dropdown aligned with the persisted locale during dashboard startup so refreshing the page does not fall back to English before locale hydration completes. (#48019) Thanks @git-jxj.
- macOS/node service startup: use `openclaw node start/stop --json` from the Mac app instead of the removed `openclaw service node ...` command shape, so current CLI installs expose the full node exec surface again. (#46843) Fixes #43171. Thanks @Br1an67.
- ACP/gateway startup: use direct Telegram and Discord startup/status helpers instead of routing probes through the plugin runtime, and prepend the selected daemon Node bin dir to service PATH so plugin-local installs can still find `npm` and `pnpm`.
- WhatsApp/active-listener: pin the active listener registry to a `globalThis` singleton so split WhatsApp bundle chunks share one listener map and outbound sends stop missing the registered session. (#47433) Thanks @clawdia67.
- Gateway/probe: honor caller `--timeout` for active local loopback probes in `gateway status`, keep inactive remote-mode loopback probes fast, and clamp probe timers to JS-safe bounds so slow local/container gateways stop reporting false timeouts. (#47533) Thanks @MonkeyLeeT.
- Config/startup: keep bundled web-search allowlist compatibility on a lightweight manifest path so config validation no longer pulls bundled web-search registry imports into startup, while still avoiding accidental auto-allow of config-loaded override plugins. (#51574) Thanks @RichardCao.
- Gateway/chat.send: persist uploaded image references across reloads and compaction without delaying first-turn dispatch or double-submitting the same image to vision models. (#51324) Thanks @fuller-stack-dev.
- Android/canvas: recycle captured and scaled snapshot bitmaps so repeated canvas snapshots do not leak native image memory. (#41889) Thanks @Kaneki-x.
- Android/theme: switch status bar icon contrast with the active system theme so Android light mode no longer leaves unreadable light icons over the app header. (#51098) Thanks @goweii.
- Gateway/openresponses: preserve assistant commentary and session continuity across hosted-tool `/v1/responses` turns, and emit streamed tool-call payloads before finalization so client tool loops stay resumable. (#52171) Thanks @CharZhou.
- Android/Talk: serialize `TalkModeManager` player teardown so rapid interrupt/restart cycles stop double-releasing or overlapping TTS playback. (#52310) Thanks @Kaneki-x.
- WhatsApp/reconnect: preserve the last inbound timestamp across reconnect attempts so the watchdog can still recycle linked-but-dead listeners after a restart instead of leaving them stuck connected forever.
- Gateway/network discovery: guard LAN, tailnet, and pairing interface enumeration so WSL2 and restricted hosts degrade to missing-address fallbacks instead of crashing on `uv_interface_addresses` errors. (#44180, #47590)
- Gateway/bonjour: suppress the non-fatal `@homebridge/ciao` IPv4-loss assertion during interface churn so WiFi/VPN/sleep-wake changes no longer take down the gateway. (#38628, #47159, #52431)
- Browser/launch: stop forcing an extra blank tab on browser launch so managed browser startup no longer opens an unwanted empty page. (#52451) Thanks @rogerdigital.
- CLI/onboarding: import static provider definitions directly for onboarding model/config helpers so those paths no longer pull provider discovery just for built-in defaults. (#47467) Thanks @vincentkoc.
- Agents/exec: return plain-text failed tool output for timeouts and other non-success exec outcomes so models no longer parrot raw JSON error payloads back to users. (#52508) Thanks @martingarramon.
- CLI/config: make `config set --strict-json` enforce real JSON, prefer `JSON.parse` with JSON5 fallback for machine-written cron/subagent stores, and relabel raw config surfaces as `JSON/JSON5` to match actual compatibility. Related: #48415, #43127, #14529, #21332. Thanks @adhitShet and @vincentkoc.
- CLI/Ollama onboarding: keep the interactive model picker for explicit `openclaw onboard --auth-choice ollama` runs so setup still selects a default model without reintroducing pre-picker auto-pulls. (#49249) Thanks @BruceMacD.
- CLI/configure: clarify fresh-setup memory-search warnings so they say semantic recall needs at least one embedding provider, and scope the initial model allowlist picker to the provider selected in configure. Thanks @vincentkoc.
- Mattermost/threading: honor `replyToMode: "off"` for already-threaded inbound posts so threaded follow-ups can fall back to top-level replies when configured. (#52543) Thanks @RichardCao.
- Onboarding/custom providers: store Azure OpenAI and Azure AI Foundry custom endpoints with the Responses API config shape, normalized `/openai/v1` base URLs, and Azure-safe defaults so TUI and agent runs work after setup. (#49543) Thanks @kunalk16.
- CLI/completion: reduce recursive completion-script string churn and fix nested PowerShell command-path matching so generated nested completions resolve on PowerShell too. (#45537) Thanks @yiShanXin and @vincentkoc.
- macOS/launch at login: stop emitting `KeepAlive` for the desktop app launch agent so OpenClaw no longer relaunches immediately after a manual quit while launch at login remains enabled. (#40213) Thanks @stablegenius49.
- Mattermost/DM send: retry transient direct-channel creation failures for DM deliveries, with configurable backoff and per-request timeout. (#42398) Thanks @JonathanJing.
- Secrets/exec refs: require explicit `--allow-exec` for `secrets apply` write plans that contain exec SecretRefs/providers, and align audit/configure/apply dry-run behavior to skip exec checks unless opted in to prevent unexpected command side effects. (#49417) Thanks @restriction and @joshavant.
- Signal/runtime API: re-export `SignalAccountConfig` so Signal account resolution type-checks again. (#49470) Thanks @scoootscooob.
- Google Chat/runtime API: thin the private runtime barrel onto the curated public SDK surface while keeping public Google Chat exports intact. (#49504) Thanks @scoootscooob.
- Onboarding/custom providers: keep Azure AI Foundry `*.services.ai.azure.com` custom endpoints on the selected compatibility path instead of forcing Responses, so chat-completions Foundry models still work after setup. Fixes #50528. (#50535) Thanks @obviyus.
- make `openclaw update status` explicitly say `up to date` when the local version already matches npm latest, while keeping the availability logic unchanged. (#51409) Thanks @dongzhenye.
- Agents/embedded transport errors: distinguish common network failures like connection refused, DNS lookup failure, and interrupted sockets from true timeouts in embedded-run user messaging and lifecycle diagnostics. (#51419) Thanks @scoootscooob.
- Security/pairing: bind iOS setup codes to the intended node profile and reject first-use bootstrap redemption that asks for broader roles or scopes. Thanks @tdjackey.
- Nostr/security: enforce inbound DM policy before decrypt, route Nostr DMs through the standard reply pipeline, and add pre-crypto rate and size guards so unknown senders cannot bypass pairing or force unbounded crypto work. Thanks @kuranikaran.
- Synology Chat/security: keep reply delivery bound to stable numeric `user_id` by default, and gate mutable username/nickname recipient lookup behind `dangerouslyAllowNameMatching` with new regression coverage. Thanks @nexrin.
- Browser/node proxy: enforce `nodeHost.browserProxy.allowProfiles` across `query.profile` and `body.profile`, block proxy-side profile create/delete when the allowlist is set, and keep the default full proxy surface when the allowlist is empty.
- Security/device pairing: harden `device.token.rotate` deny handling by keeping public failures generic while logging internal deny reasons and preserving approved-baseline enforcement. (`GHSA-7jrw-x62h-64p8`)
- Security/exec safe bins: remove `jq` from the default safe-bin allowlist and fail closed on the `jq` `env` builtin when operators explicitly opt `jq` back in, so `jq -n env` cannot dump host secrets without an explicit trust path. Thanks @gladiator9797 for reporting.
- Security/exec approvals: escape blank Hangul filler code points in approval prompts across gateway/chat and the macOS native approval UI so visually empty Unicode padding cannot hide reviewed command text.
- Security/exec approvals: unify transparent dispatch-wrapper handling across resolution and allow-always persistence so wrapper metadata cannot silently drift and broaden approvals.
- Security/exec: harden macOS allowlist resolution against wrapper and `env` spoofing, require fresh approval for inline interpreter eval with `tools.exec.strictInlineEval`, wrap Discord guild message bodies as untrusted external content, and add audit findings for risky exec approval and open-channel combinations.
- Security/network: harden explicit-proxy SSRF pinning by translating target-hop transport hints onto HTTPS proxy tunnels and failing closed for plain HTTP guarded fetches that cannot preserve pinned DNS.
- Security/Synology Chat: require explicit per-account webhook paths for multi-account setups by default, reject duplicate exact webhook paths fail-closed, and keep inherited-path behavior behind an explicit dangerous opt-in so shared routes can no longer collapse DM policy contexts across accounts. Thanks @tdjackey for reporting.
- Browser/remote CDP: honor strict browser SSRF policy during remote CDP reachability and `/json/version` discovery checks, redact sensitive `cdpUrl` tokens from status output, and warn when remote CDP targets private/internal hosts.
- Media/security: bound remote-media error-body snippets with the same streaming caps and idle timeouts as successful downloads, so malicious HTTP error responses cannot force unbounded buffering before OpenClaw throws.
- Gateway/auth: ignore spoofed loopback hops in trusted forwarding chains and block device approvals that request scopes above the caller session. (#46800) Thanks @vincentkoc.
- Gateway/auth: clear self-declared scopes for device-less trusted-proxy Control UI sessions so proxy-authenticated connects cannot claim admin or secrets scopes without a bound device identity.
- Hardening: refresh stale device pairing requests and pending metadata (#50695) Thanks @smaeljaish771 and @joshavant.
- Gateway/auth: add regression coverage that keeps device-less trusted-proxy Control UI sessions off privileged pairing approval RPCs. Thanks @vincentkoc.
- Media/Windows security: block remote-host `file://` media URLs and UNC/network paths before local filesystem resolution in core media loading and adjacent prompt/sandbox attachment seams, so the next release no longer allows structured local-media inputs to trigger outbound SMB credential handshakes on Windows. Thanks @RacerZ-fighting for reporting.
- Web tools/Exa: align the bundled Exa plugin with the current Exa API by supporting newer search types and richer `contents` options, while fixing the result-count cap to honor Exa's higher limit. Thanks @vincentkoc.
- Agents/default timeout: raise the shared default agent timeout from `600s` to `48h` so long-running ACP and agent sessions do not fail unless you configure a shorter limit.
- CLI: avoid loading provider discovery during startup model normalization. (#46522) Thanks @ItsAditya-xyz and @vincentkoc.
- Agents/Telegram: avoid rebuilding the full model catalog on ordinary inbound replies so Telegram message handling no longer pays multi-second core startup latency before reply generation. Thanks @vincentkoc.
- Agents/models: cache `models.json` readiness by config and auth-file state so embedded runner turns stop paying repeated model-catalog startup work before replies. Thanks @vincentkoc.
- Gateway/status: tolerate network interface discovery failures in status, onboarding control-UI links, and self-presence display paths so those surfaces fall back cleanly instead of crashing. (#52195) Thanks @meng-clb.
- Gateway/Linux: auto-detect nvm-managed Node TLS CA bundle needs before CLI startup and refresh installed services that are missing `NODE_EXTRA_CA_CERTS`. (#51146) Thanks @GodsBoy.
- Google auth/Node 25: patch `gaxios` to use native fetch without injecting `globalThis.window`, while translating proxy and mTLS transport settings so Google Vertex and Google Chat auth keep working on Node 25. (#47914) Thanks @pdd-cli.
- Gateway/status: resolve env-backed `gateway.auth.*` SecretRefs before read-only probe auth checks so status no longer reports false probe failures when auth is configured through SecretRef. (#52513) Thanks @CodeForgeNet.
- Gateway/plugins: pin runtime webhook routes to the gateway startup registry so channel webhooks keep working across plugin-registry churn, and make plugin auth + dispatch resolve routes from the same live HTTP-route registry. (#47902) Fixes #46924 and #47041. Thanks @steipete.
- Gateway/restart: defer externally signaled unmanaged restarts through the in-process idle drain, and preserve the restored subagent run as remap fallback during orphan recovery so resumed sessions do not duplicate work. (#47719) Thanks @joeykrug.
- Telegram/setup: seed fresh setups with `channels.telegram.groups["*"].requireMention=true` so new bots stay mention-gated in groups unless you explicitly open them up. Thanks @vincentkoc.
- Inbound policy hardening: tighten callback and webhook sender checks across Mattermost and Google Chat, match Nextcloud Talk rooms by stable room token, and treat explicit empty Twitch allowlists as deny-all. (#46787) Thanks @zpbrent, @ijxpwastaken and @vincentkoc.
- Webhooks/runtime: move auth earlier and tighten pre-auth body limits and timeouts across bundled webhook handlers, including slow-body handling for Mattermost slash commands. (#46802) Thanks @vincentkoc.
- Email/webhook wrapping: sanitize sender and subject metadata before external-content wrapping so metadata fields cannot break the wrapper structure. (#46816) Thanks @vincentkoc.
- Gateway/chat: only reap orphaned stale chat buffers after the abort controller is gone, and clear abort-time streaming metadata so long-running sessions do not lose buffered output while stale maps still get reclaimed. (#52428) Thanks @karanuppal.
- Tools/apply-patch: revalidate workspace-only delete and directory targets immediately before mutating host paths. (#46803) Thanks @vincentkoc.
- Gateway/config views: strip embedded credentials from URL-based endpoint fields before returning read-only account and config snapshots. (#46799) Thanks @vincentkoc.
- ACP/approvals: use canonical tool identity for prompting decisions and fail closed when conflicting tool identity hints are present. (#46817) Thanks @zpbrent and @vincentkoc.
- ACP: require admin scope for mutating internal actions. (#46789) Thanks @tdjackey and @vincentkoc.
- Subagents/follow-ups: require the same controller ownership checks for `/subagents send` as other control actions, so leaf sessions cannot message nested child runs they do not control. (#46801) Thanks @vincentkoc.
- Web search/onboarding: clarify provider labels, key prompts, and missing-key notes so setup/configure more clearly names the required provider credential for Gemini, Kimi, Grok, Brave Search, Firecrawl, Perplexity, and Tavily. Thanks @vincentkoc.
- macOS/canvas actions: keep unattended local agent actions on trusted in-app canvas surfaces only, and stop exposing the deep-link fallback key to arbitrary page scripts. (#46790) Thanks @vincentkoc.
- Agents/compaction: extend the enclosing run deadline once while compaction is actively in flight, and abort the underlying SDK compaction on timeout/cancel so large-session compactions stop freezing mid-run. (#46889) Thanks @asyncjason.
- Gateway/Telegram shutdown: abort stalled Telegram polling fetches on shutdown, clean up per-cycle abort listeners, and keep the in-process watchdog ahead of supervisor stop timeouts so SIGTERM no longer leaves zombie gateways behind. (#51242) Thanks @juliabush.
- Telegram/setup: warn when setup leaves DMs on pairing without an allowlist, and show valid account-scoped remediation commands. (#50710) Thanks @ernestodeoliveira.
- Doctor/Telegram: replace the fresh-install empty group-allowlist false positive with first-run guidance that explains DM pairing approval and the next group setup steps, so new Telegram installs get actionable setup help instead of a broken-config warning. Thanks @vincentkoc.
- Doctor/extensions: keep Matrix DM `allowFrom` repairs on the canonical `dm.allowFrom` path and stop treating Zalouser group sender gating as if it fell back to `allowFrom`, so doctor warnings and `--fix` stay aligned with runtime access control. Thanks @vincentkoc.
- Doctor/refactor: centralize built-in channel doctor semantics in one static capability registry with conservative fallback behavior for unknown/external channels, so future extension changes stop depending on scattered shared string checks. Thanks @vincentkoc.
- Channels/plugins: keep shared interactive payloads merge-ready by fixing Slack custom callback routing and repeat-click dedupe, allowing interactive-only sends, and preserving ordered Discord shared text blocks. (#47715) Thanks @vincentkoc.
- Slack/interactive replies: preserve `channelData.slack.blocks` through live DM delivery and preview-finalized edits so Block Kit button and select directives render instead of falling back to raw text. (#45890) Thanks @vincentkoc.
- Feishu/actions: expand the runtime action surface with message read/edit, explicit thread replies, pinning, and operator-facing chat/member inspection so Feishu can operate more of the workspace directly. (#47968) Thanks @Takhoffman.
- Feishu/topic threads: fetch full thread context, including prior bot replies, when starting a topic-thread session so follow-up turns in Feishu topics keep the right conversation state. (#45254) Thanks @Coobiw.
- Feishu/media: keep native image, file, audio, and video/media handling aligned across outbound sends, inbound downloads, thread replies, directory/action aliases, and capability docs so unsupported areas are explicit instead of implied. (#47968) Thanks @Takhoffman.
- Feishu/webhooks: harden signed webhook verification to use constant-time signature comparison and keep malformed short signatures fail-closed in webhook E2E coverage.
- Telegram/message send: forward `--force-document` through the `sendPayload` path as well as `sendMedia`, so Telegram payload sends with `channelData` keep uploading images as documents instead of silently falling back to compressed photo sends. (#47119) Thanks @thepagent.
- Telegram/message chunking: preserve spaces, paragraph separators, and word boundaries when HTML overflow rechunking splits formatted replies. (#47274) Thanks @obviyus.
- Z.AI/onboarding: detect a working default model even for explicit `zai-coding-*` endpoint choices, so Coding Plan setup can keep the selected endpoint while defaulting to `glm-5` when available or `glm-4.7` as fallback. (#45969) Thanks @obviyus.
- CI/onboarding smoke: surface `ensure-base-commit` fetch failures as workflow warnings and fail the onboarding Docker smoke when expected setup prompts drift instead of continuing silently. Thanks @Takhoffman.
- Z.AI/onboarding: add `glm-5-turbo` to the default Z.AI provider catalog so onboarding-generated configs expose the new model alongside the existing GLM defaults. (#46670) Thanks @tomsun28.
- Zalo Personal/group gating: stop reapplying `dmPolicy.allowFrom` as a sender gate for already-allowlisted groups when `groupAllowFrom` is unset, so any member of an allowed group can trigger replies while DMs stay restricted. (#46663) Fixes #40146. Thanks @Takhoffman.
- Zalo/plugin runtime: export `resolveClientIp` from `openclaw/plugin-sdk/zalo` so installed builds no longer crash on startup when the webhook monitor loads from the packaged extension instead of the monorepo source tree. (#46549) Thanks @No898.
- Docker/live tests: mount external CLI auth homes into writable container copies, derive Codex OAuth expiry from JWT `exp`, refresh synced CLI creds instead of trusting stale cached expiry, and make gateway live probes wait on transcript output so `pnpm test:docker:all` stays green in Linux.
- Gateway/watch mode: restart on bundled-plugin package and manifest metadata changes, rebuild `dist` for extension source and `tsdown.config.ts` changes, and still ignore extension docs. (#47571) Thanks @gumadeiras.
- Gateway/watch mode: recreate bundled plugin runtime metadata after clean or stale `dist` states, so `pnpm gateway:watch` no longer fails on missing `dist/extensions/*/openclaw.plugin.json` manifests after a rebuild. Thanks @gumadeiras.
- Control UI: scope persisted session selection per gateway, prevent stale session bleed across tokenized gateway opens, and cap stored gateway session history. (#47453) Thanks @sallyom.
- Models/OpenAI Codex OAuth: start the remote manual-input race for Codex login and keep the pasted-input prompt aligned with the actual accepted values, so remote/VPS auth no longer stalls waiting on an unreachable localhost callback. (#51631) Thanks @cash-echo-bot.
- Group mention gating: reject invalid and unsafe nested-repetition `mentionPatterns`, reuse the shared safe config-regex compiler across mention stripping and detection, and cache strip-time regex compilation so noisy groups avoid repeated recompiles.
- Browser/profiles: drop the auto-created `chrome-relay` browser profile; users who need the Chrome extension relay must now create their own profile via `openclaw browser create-profile`. (#46596) Fixes #45777. Thanks @odysseus0.
- CI/channel test routing: move the built-in channel suites into `test:channels` and keep them out of `test:extensions`, so extension CI no longer fails after the channel migration while targeted test routing still sends Slack, Signal, and iMessage suites to the right lane. (#46066) Thanks @scoootscooob.
- Gateway/config validation: stop treating the implicit default memory slot as a required explicit plugin config, so startup no longer fails with `plugins.slots.memory: plugin not found: memory-core` when `memory-core` was only inferred. (#47494) Thanks @ngutman.
- Tlon: honor explicit empty allowlists and defer cite expansion. (#46788) Thanks @zpbrent and @vincentkoc.
- Tlon/DM auth: defer cited-message expansion until after DM authorization and owner command handling, so unauthorized DMs and owner approval/admin commands no longer trigger cross-channel cite fetches before the deny or command path.
- Gateway/agent events: stop broadcasting false end-of-run `seq gap` errors to clients, and isolate node-driven ingress turns with per-turn run IDs so stale tail events cannot leak into later session runs. (#43751) Thanks @caesargattuso.
- Nodes/pending actions: re-check queued foreground actions against the current node command policy before returning them to the node. (#46815) Thanks @zpbrent and @vincentkoc.
- Windows/gateway status: accept `schtasks` `Last Result` output as an alias for `Last Run Result`, so running scheduled-task installs no longer show `Runtime: unknown`. (#47844) Thanks @MoerAI.
- ACP/acpx: resolve the bundled plugin root from the actual plugin directory so plugin-local installs stay under `dist/extensions/acpx` instead of escaping to `dist/extensions` and failing runtime setup. (#47601) Thanks @ngutman.
- Gateway/WS handshake: raise the default pre-auth handshake timeout to 10 seconds and add `OPENCLAW_HANDSHAKE_TIMEOUT_MS` as a runtime override so busy local gateways stop dropping healthy CLI connections at 3 seconds. (#49262) Thanks @fuller-stack-dev.
- Gateway/websocket pairing bypass for disabled auth: skip device-pairing enforcement for Control UI operator sessions when `gateway.auth.mode=none`, so reverse-proxied dashboards no longer get stuck on `pairing required` despite auth being explicitly disabled. (#47148) Thanks @ademczuk.
- Agents/usage tracking: stop forcing `supportsUsageInStreaming: false` on non-native OpenAI-completions providers so compatible backends report token usage and cost again instead of showing all zeros. (#46500) Fixes #46142. Thanks @ademczuk.
- ACP/acpx: keep plugin-local backend installs under `extensions/acpx` in live repo checkouts so rebuilds no longer delete the runtime binary, and avoid package-lock churn during runtime repair.
- Agents/compaction: rerun transcript repair after `session.compact()` so orphaned `tool_result` blocks cannot survive compaction and break later Anthropic requests. (#16095) thanks @claw-sylphx.
- Agents/compaction: trigger overflow recovery from the tool-result guard once post-compaction context still exceeds the safe threshold, so long tool loops compact before the next model call hard-fails. (#29371) thanks @keshav55.
- macOS/exec approvals: harden exec-host request HMAC verification to use a timing-safe compare and keep malformed or truncated signatures fail-closed in focused IPC auth coverage.
- Gateway/exec approvals: surface requested env override keys in gateway-host approval prompts so operators can review surviving env context without inheriting noisy base host env.
- Telegram/network: preserve sticky IPv4 fallback state across polling restarts so hosts with unstable IPv6 to `api.telegram.org` stop re-triggering repeated Telegram timeouts after each restart. (#48282) Thanks @yassinebkr.
- Agents/compaction: write minimal boundary summaries for empty preparations while keeping split-turn prefixes on the normal path, so no-summarizable-message sessions stop retriggering the safeguard loop. (#42215) thanks @lml2468.
- Models/chat commands: keep `/model ...@YYYYMMDD` version suffixes intact by default, but still honor matching stored numeric auth-profile overrides for the same provider. (#48896) Thanks @Alix-007.
- Gateway/channels: serialize per-account channel startup so overlapping starts do not boot the same provider twice, preventing MS Teams `EADDRINUSE` crash loops during startup and restart. (#49583) Thanks @sudie-codes.
- Discord: enforce strict DM component allowlist auth (#49997) Thanks @joshavant.
- Stabilize plugin loader and Docker extension smoke (#50058) Thanks @joshavant.
- Telegram: stabilize pairing/session/forum routing and reply formatting tests (#50155) Thanks @joshavant.
- Gateway: harden OpenResponses file-context escaping (#50782) Thanks @YLChen-007 and @joshavant.
- LINE: harden Express webhook parsing to verified raw body (#51202) Thanks @gladiator9797 and @joshavant.
- Exec: harden host env override handling across gateway and node (#51207) Thanks @gladiator9797 and @joshavant.
- Voice Call: enforce spoken-output contract and fix stream TTS silence regression (#51500) Thanks @joshavant.
- xAI/models: rename the bundled Grok 4.20 catalog entries to the GA IDs and normalize saved deprecated beta IDs at runtime so existing configs and sessions keep resolving. (#50772) thanks @Jaaneek
- Agents/bootstrap warnings: move bootstrap truncation warnings out of the system prompt and into the per-turn prompt body so prompt-cache reuse stays stable when truncation warnings appear or disappear. (#48753) Thanks @scoootscooob and @obviyus.
- Telegram/DM topic session keys: route named-account DM topics through the same per-account base session key across inbound messages, native commands, and session-state lookups so `/status` and thread recovery stop creating phantom `agent:main:main:thread:...` sessions. (#48204) Thanks @vincentkoc.
- ACP/configured bindings: reinitialize configured ACP sessions that are stuck in `error` state instead of reusing the failed runtime.
- Telegram/network: unify API and media fetches under the same sticky IPv4 and pinned-IP fallback chain, and re-validate pinned override addresses against SSRF policy. (#49148) Thanks @obviyus.
- Agents/prompt composition: append bootstrap truncation warnings to the current-turn prompt and add regression coverage for stable system-prompt cache invariants. (#49237) Thanks @scoootscooob.
- Synology Chat/multi-account: scope direct-message sessions by account and sender so identical webhook `user_id` values on different Synology accounts no longer share transcript or delivery state.
- Telegram/security: add regression coverage proving pinned fallback host overrides stay bound to Telegram and delegate non-matching hostnames back to the original lookup path. Thanks @vincentkoc.
- Tools/image generation: add bundled fal image generation support so `image_generate` can target `fal/*` models with `FAL_KEY`, including single-image edit flows via FLUX image-to-image. Thanks @vincentkoc.
- Gateway/hooks: preserve immutable hook ingress provenance across async isolated-agent dispatch so normalized hook session routes keep external wrapping, Gmail-specific policy, and Gmail model selection intact.
- Messages/polls: treat zero-valued poll params on `message.send` as unset defaults while keeping non-zero poll params on the poll validation path. (#52150) Fixes #52118. Thanks @Bartok9.
- xAI/web search: add missing Grok credential metadata so the bundled provider registration type-checks again. (#49472) thanks @scoootscooob.
- Agents/session cache: opportunistically sweep expired embedded-runner session cache entries during later cache activity, so one-shot session files do not accumulate forever. (#52427) Thanks @karanuppal.
- WhatsApp: stabilize inbound monitor and setup tests (#50007) Thanks @joshavant.
- Matrix: make onboarding status runtime-safe (#49995) Thanks @joshavant.
- Channels: stabilize lane harness and monitor tests (#50167) Thanks @joshavant.
- Agents/compaction: add an opt-in post-compaction session JSONL truncation step that drops summarized transcript entries while preserving the retained branch tail and live session metadata. (#41021) thanks @thirumaleshp.
- Telegram/routing: fail loud when `message send` targets an unknown non-default Telegram `accountId`, instead of silently falling back to the channel-level bot token and sending through the wrong bot. (#50853) Thanks @hclsys.
- Web search: align onboarding, configure, and finalize with plugin-owned provider contracts, including disabled-provider recovery, config-aware credential hooks, and runtime-visible summaries. (#50935) Thanks @gumadeiras.
- Agents/replay: sanitize malformed assistant tool-call replay blocks before provider replay so follow-up Anthropic requests do not inherit the downstream `replace` crash. (#50005) Thanks @jalehman.
- Discord/startup logging: report client initialization while the gateway is still connecting instead of claiming Discord is logged in before readiness is reached. (#51425) Thanks @scoootscoob.
- Agents/compaction safeguard: preserve split-turn context and preserved recent turns when capped retry fallback reuses the last successful summary. (#27727) thanks @Pandadadadazxf.
- Agents/memory flush: keep transcript-hash dedup active across memory-flush fallback retries so a write-then-throw flush attempt cannot append duplicate `MEMORY.md` entries before the fallback cycle completes. (#34222) Thanks @lml2468.
- Discord/ACP: forward worker abort signals into ACP turns so timed-out Discord jobs cancel the running turn instead of silently leaving the bound ACP session working in the background.
- ACP/Codex session replay: preserve hidden assistant thinking when loading or rebinding existing ACP sessions so stored thought chunks do not replay into visible assistant text. Thanks @vincentkoc.
- Gateway/commands: keep internal `chat.send` slash-command UX while requiring `operator.admin` before internal callers can persist `/exec` defaults or mutate `phone-control` node policy through `/phone arm|disarm`.
- Plugins/Matrix: move bundled plugin `KeyedAsyncQueue` imports onto the stable `plugin-sdk/core` surface so Matrix Docker/runtime builds do not depend on the brittle keyed-async-queue subpath. Thanks @ecohash-co and @vincentkoc.
- Plugins/context engines: enforce owner-aware context-engine registration on both loader and public SDK paths so plugins cannot spoof privileged ownership, claim the core `legacy` engine id, or overwrite an existing engine id through direct SDK imports. (#47595) Thanks @vincentkoc.
- Plugins/bundler TDZ: fix `RESERVED_COMMANDS` temporal dead zone error that prevented device-pair, phone-control, and talk-voice plugins from registering when the bundler placed the commands module after call sites in the same output chunk. Thanks @BunsDev.
- Plugins/imports: fix stale googlechat runtime-api import paths and signal SDK circular re-exports broken by recent plugin-sdk refactors. Thanks @BunsDev.
- Plugins/install precedence: keep bundled plugins ahead of auto-discovered globals by default, but let an explicitly installed plugin record win its own duplicate-id tie so installed channel plugins load from `~/.openclaw/extensions` after `openclaw plugins install`. (#46722) Thanks @Takhoffman.
- Plugins/scoped ids: preserve scoped plugin ids during install and config keying, and keep bundled plugins ahead of discovered duplicate ids by default so `@scope/name` plugins no longer collide with unscoped installs. (#47413) Thanks @vincentkoc.
- Docs/Mintlify: fix MDX marker syntax on Perplexity, Model Providers, Moonshot, and exec approvals pages so local docs preview no longer breaks rendering or leaves stale pages unpublished. (#46695) Thanks @velvet-shark.
- Plugins/runtime barrels: route bundled extension runtime imports through public `openclaw/plugin-sdk/*` subpaths and block relative cross-package escapes so packaged extensions stop depending on monorepo-only relative paths. (#51939) Thanks @vincentkoc.
- Docs/security audit: spell out that `gateway.controlUi.allowedOrigins: ["*"]` is an explicit allow-all browser-origin policy and should be avoided outside tightly controlled local testing.
- Plugins/subagents: preserve gateway-owned plugin subagent access across runtime, tool, and embedded-runner load paths so gateway plugin tools and context engines can still spawn and manage subagents after the loader cache split. (#46648) Thanks @jalehman.
- Plugins/subagents: forward per-run provider and model overrides through gateway plugin subagent dispatch so plugin-launched agent delegations honor explicit model selection again. (#48277) Thanks @jalehman.
- Tests/OpenAI Codex auth: align login expectations with the default `gpt-5.4` model so CI coverage stays consistent with the current OpenAI Codex default. (#44367) Thanks @jrrcdev.
- Plugins/Matrix TTS: send auto-TTS replies as native Matrix voice bubbles instead of generic audio attachments. (#37080) thanks @Matthew19990919.
- Plugins/discovery: distinguish missing package entry files from package-path escape violations so startup skips absent plugin entry paths without raising false security diagnostics. (#52491) Thanks @hclsys.
- Plugins/Matrix: accept shared send-tool media aliases (`mediaUrl`, `filePath`, `path`) and preserve `asVoice` / `audioAsVoice` through Matrix action dispatch so media-only sends and voice-message intents reach the plugin send layer correctly. Thanks @psacc and @vincentkoc.
- Plugins/runtime-api: pin extension runtime-api export surfaces with explicit guardrail coverage so future surface creep becomes a deliberate diff. Thanks @vincentkoc.
- Plugins/WhatsApp: share split-load singleton state for plugin command registration and active WhatsApp listeners so duplicate module graphs no longer lose native plugin commands or outbound listener state. (#50418) Thanks @huntharo.
- Plugins/update: let `openclaw plugins update <npm-spec>` target tracked npm installs by dist-tag or exact version, and preserve the recorded npm spec for later id-based updates. (#49998) Thanks @huntharo.
- Tests/CLI: reduce command-secret gateway test import pressure while keeping the real protocol payload validator in place, so the isolated lane no longer carries the heavier runtime-web and message-channel graphs. (#50663) Thanks @huntharo.
- Gateway/plugins: share plugin interactive callback routing and plugin bind approval state across duplicate module graphs so Telegram Codex picker buttons and plugin bind approvals no longer fall through to normal inbound message routing. (#50722) Thanks @huntharo.
- Plugins/context engines: retry strict legacy `assemble()` calls without the new `prompt` field when older engines reject it, preserving prompt-aware retrieval compatibility for pre-prompt plugins. (#50848) thanks @danhdoan.
- Plugins/runtime state: share plugin-facing infra singleton state across duplicate module graphs and keep session-binding adapter ownership stable until the active owner unregisters. (#50725) thanks @huntharo.
- Discord/pickers: keep `/codex_resume --browse-projects` picker callbacks alive in Discord by sharing component callback state across duplicate module graphs, preserving callback fallbacks, and acknowledging matched plugin interactions before dispatch. (#51260) Thanks @huntharo.
- Memory/core tools: register `memory_search` and `memory_get` independently so one unavailable memory tool no longer suppresses the other in new sessions. (#50198) Thanks @artwalker.
- Telegram/Mattermost message tool: keep plugin button schemas optional in isolated and cron sessions so plain sends do not fail validation when no current channel is active. (#52589) Thanks @tylerliu612.
- Release/npm publish: fail the npm release check when `dist/control-ui/index.html` is missing from the packed tarball, so broken Control UI asset releases are blocked before publish. Fixes #52808. (#52852) Thanks @kevinheinrichs.
- Slack/embedded delivery: suppress transcript-only `delivery-mirror` assistant messages before embedded re-delivery and raise the default Slack chunk fallback so messages just over 4000 characters stay in a single post. (#45489) Thanks @theo674.
- Slack/embedded delivery: suppress transcript-only `delivery-mirror` assistant messages before embedded re-delivery and raise the default Slack chunk fallback so messages just over 4000 characters stay in a single post. (#45489) Thanks @theo674.

---

### 📦 v2026.3.23 (2026-03-23)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.3.23)

> [!NOTE]
> **DeXMart-relevant keywords:** `whatsapp`, `telegram`, `billing`

#### Changes (Features)

- ModelStudio/Qwen: add standard (pay-as-you-go) DashScope endpoints for China and global Qwen API keys alongside the existing Coding Plan endpoints, and relabel the provider group to `Qwen (Alibaba Cloud Model Studio)`. (#43878)
- UI/clarity: consolidate button primitives (`btn--icon`, `btn--ghost`, `btn--xs`), refine the Knot theme to a black-and-red palette with WCAG 2.1 AA contrast, add config icons for Diagnostics/CLI/Secrets/ACP/MCP sections, replace the roundness slider with discrete stops, and improve accessibility with aria-labels across usage filters. (#53272) Thanks @BunsDev.
- CSP/Control UI: compute SHA-256 hashes for inline `<script>` blocks in the served `index.html` and include them in the `script-src` CSP directive, keeping inline scripts blocked by default while allowing explicitly hashed bootstrap code. (#53307) Thanks @BunsDev.

#### Fixes

- Plugins/bundled runtimes: ship bundled plugin runtime sidecars like WhatsApp `light-runtime-api.js`, Matrix `runtime-api.js`, and other plugin runtime entry files in the npm package again, so global installs stop failing on missing bundled plugin runtime surfaces.
- CLI/channel auth: auto-select the single configured login-capable channel for `channels login`/`logout`, harden channel ids against prototype-chain and control-character abuse, and fall back cleanly to catalog-backed channel installs, so channel auth works again for single-channel setups and on-demand channel installs. (#53254) Thanks @BunsDev.
- Auth/OpenAI tokens: stop live gateway auth-profile writes from reverting freshly saved credentials back to stale in-memory values, and make `models auth paste-token` write to the resolved agent store, so Configure, Onboard, and token-paste flows stop snapping back to expired OpenAI tokens. Fixes #53207. Related to #45516.
- Control UI/auth: preserve operator scopes through the device-auth bypass path, ignore cached under-scoped operator tokens, and show a clear `operator.read` fallback message when a connection really lacks read scope, so operator sessions stop failing or blanking on read-backed pages. (#53110) Thanks @BunsDev.
- Plugins/ClawHub: resolve plugin API compatibility against the active runtime version at install time, and add regression coverage for current `>=2026.3.22` ClawHub package checks so installs no longer fail behind the stale `1.2.0` constant. (#53157) Thanks @futhgar.
- Plugins/uninstall: accept installed `clawhub:` specs and versionless ClawHub package names as uninstall targets, so `openclaw plugins uninstall clawhub:<package>` works again even when the recorded install was pinned to a version.
- Browser/Chrome MCP: wait for existing-session browser tabs to become usable after attach instead of treating the initial Chrome MCP handshake as ready, which reduces user-profile timeouts and repeated consent churn on macOS Chrome attach flows. Fixes #52930. Thanks @vincentkoc.
- Browser/CDP: reuse an already-running loopback browser after a short initial reachability miss instead of immediately falling back to relaunch detection, which fixes second-run browser start/open regressions on slower headless Linux setups. Fixes #53004. Thanks @vincentkoc.
- Agents/web_search: use the active runtime `web_search` provider instead of stale/default selection, so agent turns keep hitting the provider you actually configured. Fixes #53020. Thanks @jzakirov.
- Mistral/models: lower bundled Mistral max-token defaults to safe output budgets and teach `openclaw doctor --fix` to repair old persisted Mistral provider configs that still carry context-sized output limits, avoiding deterministic Mistral 422 rejects on fresh and existing setups. Fixes #52599. Thanks @vincentkoc.
- ClawHub/macOS auth: honor macOS auth config and XDG auth paths for saved ClawHub credentials, so `openclaw skills ...` and gateway skill browsing keep using the signed-in auth state instead of silently falling back to unauthenticated mode. Fixes #53034.
- ClawHub/macOS: read the local ClawHub login from the macOS Application Support path and still honor XDG config on macOS, so skill browsing uses the logged-in token on both default and XDG-style setups. Fixes #52949. Thanks @scoootscooob.
- ClawHub/skills: resolve the local ClawHub auth token for gateway skill browsing and switch browse-all requests to search so ClawControl stops falling into unauthenticated 429s and empty authenticated skill lists. Fixes #52949. Thanks @vincentkoc.
- Config/warnings: suppress the confusing “newer OpenClaw” warning when a config written by a same-base correction release like `2026.3.23-2` is read by `2026.3.23`, while still warning for truly newer or incompatible versions.
- CLI/cron: make `openclaw cron add|edit --at ... --tz <iana>` honor the requested local wall-clock time for offset-less one-shot datetimes, including DST boundaries, and keep `--tz` rejected for `--every`. (#53224) Thanks @RolfHegr.
- Commands/auth: stop slash-command authorization from crashing or dropping valid allowlists when channel `allowFrom` resolution hits unresolved SecretRef-backed accounts, and fail closed only for the affected provider inference path. (#52791) Thanks @Lukavyi.
- Agents/failover: classify generic `api_error` payloads as retryable only when they include transient failure signals, so MiniMax-style backend failures still trigger model fallback without misclassifying billing, auth, or format/context errors. (#49611) Thanks @ayushozha.
- LINE/runtime-api: pre-export overlapping runtime symbols before the `line-runtime` star export so jiti no longer throws `TypeError: Cannot redefine property` on startup. (#53221) Thanks @Drickon.
- Telegram/threading: populate `currentThreadTs` in the threading tool-context fallback for Telegram DM topics so thread-aware tools still receive the active topic context when the main thread metadata is missing. (#52217)
- Diagnostics/cache trace: strip credential fields from cache-trace JSONL output while preserving non-sensitive diagnostic fields and image redaction metadata.
- Docs/Feishu: replace `botName` with `name` in the channel config examples so the docs match the strict account schema for per-account display names. (#52753) Thanks @haroldfabla2-hue.
- Doctor/plugins: make `openclaw doctor --fix` remove stale `plugins.allow` and `plugins.entries` refs left behind after plugin removal. Thanks @sallyom
- Agents/replay: canonicalize malformed assistant transcript content before session-history sanitization so legacy or corrupted assistant turns stop crashing Pi replay and subagent recovery paths.
- ClawHub/skills: keep updating already-tracked legacy Unicode slugs after the ASCII-only slug hardening, so older installs do not get stuck behind `Invalid skill slug` errors during `openclaw skills update`. (#53206) Thanks @drobison00.
- Infra/exec trust: preserve shell-multiplexer wrapper binaries for policy checks without breaking approved-command reconstruction, so BusyBox/ToyBox allowlist and audit flows bind to the real wrapper while execution plans stay coherent. (#53134) Thanks @vincentkoc.
- Plugins/message tool: make Discord `components` and Slack `blocks` optional again, and route Feishu `message(..., media=...)` sends through the outbound media path, so pin/unpin/react flows stop failing schema validation and Feishu file/image attachments actually send. Fixes #52970 and #52962. Thanks @vincentkoc.
- Gateway/model pricing: stop `openrouter/auto` pricing refresh from recursing indefinitely during bootstrap, so OpenRouter auto routes can populate cached pricing and `usage.cost` again. Fixes #53035. Thanks @vincentkoc.
- Models/OpenAI Codex OAuth: bootstrap the env-configured HTTP/HTTPS proxy dispatcher on the stored-credential refresh path before token renewal runs, so expired Codex OAuth profiles can refresh successfully in proxy-required environments instead of locking users out after the first token expiry.
- Models/OpenAI Codex OAuth and Plugins/MiniMax OAuth: ensure env-configured HTTP/HTTPS proxy dispatchers are initialized before OAuth preflight and token exchange requests so proxy-required environments can complete MiniMax and OpenAI Codex sign-in flows again. (#52228; fixes #51619, #51569) Thanks @openperf.
- Plugins/memory-lancedb: bootstrap LanceDB into plugin runtime state on first use when the bundled npm install does not already have it, so `plugins.slots.memory="memory-lancedb"` works again after global npm installs without moving LanceDB into OpenClaw core dependencies. Fixes #26100.
- Config/plugins: treat stale unknown `plugins.allow` ids as warnings instead of fatal config errors, so recovery commands like `plugins install`, `doctor --fix`, and `status` still run when a plugin is missing locally. Fixes #52992. Thanks @vincentkoc.
- Doctor/WhatsApp: stop auto-enable from appending built-in channel ids like `whatsapp` to `plugins.allow`, so `openclaw doctor --fix` no longer writes schema-invalid plugin allowlist entries when repairing built-in channels. Fixes #52931. Thanks @vincentkoc.
- Telegram/auto-reply: preserve same-chat inbound debounce order without stranding stale busy-session followups, and keep same-key overflow turns ordered when tracked debounce keys are saturated. (#52998) Thanks @osolmaz.
- Telegram/message tool: add `asDocument` as a user-facing alias for `forceDocument` on image and GIF sends, while preserving explicit `forceDocument` precedence when both flags are present. (#52461) Thanks @bakhtiersizhaev.
- Discord/commands: return an explicit unauthorized reply for privileged native slash commands instead of falling through to Discord's misleading generic completion when auth gates reject the sender. Fixes #53041. Thanks @scoootscooob.
- Channels/catalog: let external channel catalogs override shipped fallback metadata and honor overridden npm specs during channel setup, so custom channel catalogs no longer fall back to bundled packages when a channel id matches. (#52988)
- Voice-call/Plivo: stabilize Plivo v2 replay keys so webhook retries and replay protection stop colliding on valid follow-up deliveries.
- Agents/skills: prefer the active resolved runtime snapshot for embedded skill config and env injection, so `skills.entries.<skill>.apiKey` SecretRefs resolve correctly during embedded startup instead of failing on raw source config. Fixes #53098. Thanks @vincentkoc.
- Agents/subagents: recheck timed-out worker waits against the latest runtime snapshot before sending completion events, so fast-finishing workers stop being reported as timed out when they actually succeeded. Fixes #53106. Thanks @vincentkoc.
- Agents/Anthropic: preserve latest assistant thinking and redacted-thinking block ordering during transcript image sanitization so follow-up turns do not trip Anthropic's unmodified-thinking validation. (#52961) Thanks @vincentkoc.
- Plugins/DeepSeek: refactor the bundled DeepSeek provider onto the shared single-provider plugin entry, move its coverage into the extension test lane, and keep bundled auth env-var metadata on the generated manifest path. (#48762) Thanks @07akioni.
- Plugins/Matrix: avoid duplicate `resolveMatrixAccountStringValues` runtime-api exports under Jiti so bundled Matrix installs no longer crash at startup with `Cannot redefine property: resolveMatrixAccountStringValues`. Fixes #52909 and #52891. Thanks @vincentkoc.
- Security/exec approvals: keep shell-wrapper positional-argv allowlist matching on real direct carriers only by rejecting single-quoted `$0`/`$n` tokens, disallowing newline-separated `exec`, and still accepting `exec --` carrier forms. Thanks @vincentkoc.
- Gateway/probe: stop successful gateway handshakes from timing out as unreachable while post-connect detail RPCs are still loading, so slow devices report a reachable RPC failure instead of a false negative dead gateway. Fixes #52927. Thanks @vincentkoc.
- Gateway/supervision: stop lock conflicts from crash-looping under launchd and systemd by keeping the duplicate process in a retry wait instead of exiting as a failure while another healthy gateway still owns the lock. Fixes #52922. Thanks @vincentkoc.
- Gateway/auth: require auth for canvas routes and admin scope for agent session reset, so anonymous canvas access and non-admin reset requests fail closed.
- Release/install: keep previously released bundled plugins and Control UI assets in published openclaw npm installs, and fail release checks when those shipped artifacts are missing. Thanks @vincentkoc.

---

### 📦 v2026.3.24 (2026-03-25)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.3.24)

> [!NOTE]
> **DeXMart-relevant keywords:** `whatsapp`, `telegram`

#### Changes (Features)

- Gateway/OpenAI compatibility: add `/v1/models` and `/v1/embeddings`, and forward explicit model overrides through `/v1/chat/completions` and `/v1/responses` for broader client and RAG compatibility. Thanks @vincentkoc.
- Agents/tools: make `/tools` show the tools the current agent can actually use right now, add a compact default view with an optional detailed mode, and add a live "Available Right Now" section in the Control UI so it is easier to see what will work before you ask.
- Microsoft Teams: migrate to the official Teams SDK and add AI-agent UX best practices including streaming 1:1 replies, welcome cards with prompt starters, feedback/reflection, informative status updates, typing indicators, and native AI labeling. (#51808)
- Microsoft Teams: add message edit and delete support for sent messages, including in-thread fallbacks when no explicit target is provided. (#49925)
- Skills/install metadata: add one-click install recipes to bundled skills (coding-agent, gh-issues, openai-whisper-api, session-logs, tmux, trello, weather) so the CLI and Control UI can offer dependency installation when requirements are missing. (#53411) Thanks @BunsDev.
- Control UI/skills: add status-filter tabs (All / Ready / Needs Setup / Disabled) with counts, replace inline skill cards with a click-to-detail dialog showing requirements, toggle switch, install action, API key entry, source metadata, and homepage link. (#53411) Thanks @BunsDev.
- Slack/interactive replies: restore rich reply parity for direct deliveries, auto-render simple trailing `Options:` lines as buttons/selects, improve Slack interactive setup defaults, and isolate reply controls from plugin interactive handlers. (#53389) Thanks @vincentkoc.
- CLI/containers: add `--container` and `OPENCLAW_CONTAINER` to run `openclaw` commands inside a running Docker or Podman OpenClaw container. (#52651) Thanks @sallyom.
- Discord/auto threads: add optional `autoThreadName: "generated"` naming so new auto-created threads can be renamed asynchronously with concise LLM-generated titles while keeping the existing message-based naming as the default. (#43366) Thanks @davidguttman.
- Plugins/hooks: add `before_dispatch` with canonical inbound metadata and route handled replies through the normal final-delivery path, preserving TTS and routed delivery semantics. (#50444) Thanks @gfzhx.
- Control UI/agents: convert agent workspace file rows to expandable `<details>` with lazy-loaded inline markdown preview, and add comprehensive `.sidebar-markdown` styles for headings, lists, code blocks, tables, blockquotes, and details/summary elements. (#53411) Thanks @BunsDev.
- Control UI/markdown preview: restyle the agent workspace file preview dialog with a frosted backdrop, sized panel, and styled header, and integrate `@create-markdown/preview` v2 system theme for rich markdown rendering (headings, tables, code blocks, callouts, blockquotes) that auto-adapts to the app's light/dark design tokens. (#53411) Thanks @BunsDev.
- macOS app/config: replace horizontal pill-based subsection navigation with a collapsible tree sidebar using disclosure chevrons and indented subsection rows. (#53411) Thanks @BunsDev.
- CLI/skills: soften missing-requirements label from "missing" to "needs setup" and surface API key setup guidance (where to get a key, CLI save command, storage path) in `openclaw skills info` output. (#53411) Thanks @BunsDev.
- macOS app/skills: add "Get your key" homepage link and storage-path hint to the API key editor dialog, and show the config path in save confirmation messages. (#53411) Thanks @BunsDev.
- Control UI/agents: add a "Not set" placeholder to the default agent model selector dropdown. (#53411) Thanks @BunsDev.
- Runtime/install: lower the supported Node 22 floor to `22.14+` while continuing to recommend Node 24, so npm installs and self-updates do not strand Node 22.14 users on older releases.
- CLI/update: preflight the target npm package `engines.node` before `openclaw update` runs a global package install, so outdated Node runtimes fail with a clear upgrade message instead of attempting an unsupported latest release.

#### Fixes

- Outbound media/local files: align outbound media access with the configured fs policy so host-local files and inbound-media paths keep sending when `workspaceOnly` is off, while strict workspace-only agents remain sandboxed.
- Security/sandbox media dispatch: close the `mediaUrl`/`fileUrl` alias bypass so outbound tool and message actions cannot escape media-root restrictions. (#54034)
- Gateway/restart sentinel: wake the interrupted agent session via heartbeat after restart instead of only sending a best-effort restart note, retry outbound delivery once on transient failure, and preserve explicit thread/topic routing through the wake path so replies land in the correct Telegram topic or Slack thread. (#53940) Thanks @VACInc.
- Docker/setup: avoid the pre-start `openclaw-cli` shared-network namespace loop by routing setup-time onboard/config writes through `openclaw-gateway`, so fresh Docker installs stop failing before the gateway comes up. (#53385) Thanks @amsminn.
- Gateway/channels: keep channel startup sequential while isolating per-channel boot failures, so one broken channel no longer blocks later channels from starting. (#54215) Thanks @JonathanJing.
- Embedded runs/secrets: stop unresolved `SecretRef` config from crashing embedded agent runs by falling back to the resolved runtime snapshot when needed. Fixes #45838.
- WhatsApp/groups: track recent gateway-sent message IDs and suppress only matching group echoes, preserving owner `/status`, `/new`, and `/activation` commands from linked-account `fromMe` traffic. (#53624) Thanks @w-sss.
- WhatsApp/reply-to-bot detection: restore implicit group reply detection by unwrapping `botInvokeMessage` payloads and reading `selfLid` from `creds.json`, so reply-based mentions reach the bot again in linked-account group chats.
- Telegram/forum topics: recover `#General` topic `1` routing when Telegram omits forum metadata, including native commands, interactive callbacks, inbound message context, and fallback error replies. (#53699) thanks @huntharo
- Discord/gateway supervision: centralize gateway error handling behind a lifetime-owned supervisor so early, active, and late-teardown Carbon gateway errors stay classified consistently and stop surfacing as process-killing teardown crashes.
- Discord/timeouts: send a visible timeout reply when the inbound Discord worker times out before a final reply starts, including created auto-thread targets and queued-run ordering. (#53823) Thanks @Kimbo7870.
- ACP/direct chats: always deliver a terminal ACP result when final TTS does not yield audio, even if block text already streamed earlier, and skip redundant empty-text final synthesis. (#53692) Thanks @w-sss.
- Telegram/outbound errors: preserve actionable 403 membership/block/kick details and treat `bot not a member` as a permanent delivery failure so Telegram sends stop retrying doomed chats. (#53635) Thanks @w-sss.
- Telegram/photos: preflight Telegram photo dimension and aspect-ratio rules, and fall back to document sends when image metadata is invalid or unavailable so photo uploads stop failing with `PHOTO_INVALID_DIMENSIONS`. (#52545) Thanks @hnshah.
- Slack/runtime defaults: trim Slack DM reply overhead, restore Codex auto transport, and tighten Slack/web-search runtime defaults around DM preview threading, cache scoping, warning dedupe, and explicit web-search opt-in. (#53957) Thanks @vincentkoc.

---

### 📦 v2026.3.28 (2026-03-29)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.3.28)

> [!NOTE]
> **DeXMart-relevant keywords:** `whatsapp`, `telegram`, `billing`

#### ⚠️ Breaking Changes

- Providers/Qwen: remove the deprecated `qwen-portal-auth` OAuth integration for `portal.qwen.ai`; migrate to Model Studio with `openclaw onboard --auth-choice modelstudio-api-key`. (#52709) Thanks @pomelo-nwu.
- Config/Doctor: drop automatic config migrations older than two months; very old legacy keys now fail validation instead of being rewritten on load or by `openclaw doctor`.

#### Changes (Features)

- xAI/tools: move the bundled xAI provider to the Responses API, add first-class `x_search`, and auto-enable the xAI plugin from owned web-search and tool config so bundled Grok auth/configured search flows work without manual plugin toggles. (#56048) Thanks @huntharo.
- xAI/onboarding: let the bundled Grok web-search plugin offer optional `x_search` setup during `openclaw onboard` and `openclaw configure --section web`, including an x_search model picker with the shared xAI key.
- MiniMax: add image generation provider for `image-01` model, supporting generate and image-to-image editing with aspect ratio control. (#54487) Thanks @liyuan97.
- Plugins/hooks: add async `requireApproval` to `before_tool_call` hooks, letting plugins pause tool execution and prompt the user for approval via the exec approval overlay, Telegram buttons, Discord interactions, or the `/approve` command on any channel. The `/approve` command now handles both exec and plugin approvals with automatic fallback. (#55339) Thanks @vaclavbelak and @joshavant.
- ACP/channels: add current-conversation ACP binds for Discord, BlueBubbles, and iMessage so `/acp spawn codex --bind here` can turn the current chat into a Codex-backed workspace without creating a child thread, and document the distinction between chat surface, ACP session, and runtime workspace.
- OpenAI/apply_patch: enable `apply_patch` by default for OpenAI and OpenAI Codex models, and align its sandbox policy access with `write` permissions.
- Plugins/CLI backends: move bundled Claude CLI, Codex CLI, and Gemini CLI inference defaults onto the plugin surface, add bundled Gemini CLI backend support, and replace `gateway run --claude-cli-logs` with generic `--cli-backend-logs` while keeping the old flag as a compatibility alias.
- Plugins/startup: auto-load bundled provider and CLI-backend plugins from explicit config refs, so bundled Claude CLI, Codex CLI, and Gemini CLI message-provider setups no longer need manual `plugins.allow` entries.
- Podman: simplify the container setup around the current rootless user, install the launch helper under `~/.local/bin`, and document the host-CLI `openclaw --container <name> ...` workflow instead of a dedicated `openclaw` service user.
- Slack/tool actions: add an explicit `upload-file` Slack action that routes file uploads through the existing Slack upload transport, with optional filename/title/comment overrides for channels and DMs.
- Message actions/files: start unifying file-first sends on the canonical `upload-file` action by adding explicit support for Microsoft Teams and Google Chat, and by exposing BlueBubbles file sends through `upload-file` while keeping the legacy `sendAttachment` alias.
- Plugins/Matrix TTS: send auto-TTS replies as native Matrix voice bubbles instead of generic audio attachments. (#37080) thanks @Matthew19990919.
- CLI: add `openclaw config schema` to print the generated JSON schema for `openclaw.json`. (#54523) Thanks @kvokka.
- Config/TTS: auto-migrate legacy speech config on normal reads and secret resolution, keep legacy diagnostics for Doctor, and remove regular-mode runtime fallback for old bundled `tts.<provider>` API-key shapes.
- Memory/plugins: move the pre-compaction memory flush plan behind the active memory plugin contract so `memory-core` owns flush prompts and target-path policy instead of hardcoded core logic.
- MiniMax: trim model catalog to M2.7 only, removing legacy M2, M2.1, M2.5, and VL-01 models. (#54487) Thanks @liyuan97.
- Plugins/runtime: expose `runHeartbeatOnce` in the plugin runtime `system` namespace so plugins can trigger a single heartbeat cycle with an explicit delivery target override (e.g. `heartbeat: { target: "last" }`). (#40299) Thanks @loveyana.
- Agents/compaction: preserve the post-compaction AGENTS refresh on stale-usage preflight compaction for both immediate replies and queued followups. (#49479) Thanks @jared596.
- Agents/compaction: surface safeguard-specific cancel reasons and relabel benign manual `/compact` no-op cases as skipped instead of failed. (#51072) Thanks @afurm.
- Docs: add `pnpm docs:check-links:anchors` for Mintlify anchor validation while keeping `scripts/docs-link-audit.mjs` as the stable link-audit entrypoint. (#55912) Thanks @velvet-shark.
- Tavily: mark outbound API requests with `X-Client-Source: openclaw` so Tavily can attribute OpenClaw-originated traffic. (#55335) Thanks @lakshyaag-tavily.

#### Fixes

- Agents/Anthropic: recover unhandled provider stop reasons (e.g. `sensitive`) as structured assistant errors instead of crashing the agent run. (#56639)
- Google/models: resolve Gemini 3.1 pro, flash, and flash-lite for all Google provider aliases by passing the actual runtime provider ID and adding a template-provider fallback; fix flash-lite prefix ordering. (#56567)
- OpenAI Codex/image tools: register Codex for media understanding and route image prompts through Codex instructions so image analysis no longer fails on missing provider registration or missing `instructions`. (#54829) Thanks @neeravmakwana.
- Agents/image tool: restore the generic image-runtime fallback when no provider-specific media-understanding provider is registered, so image analysis works again for providers like `openrouter` and `minimax-portal`. (#54858) Thanks @MonkeyLeeT.
- WhatsApp: fix infinite echo loop in self-chat DM mode where the bot's own outbound replies were re-processed as new inbound user messages. (#54570) Thanks @joelnishanth
- Telegram/splitting: replace proportional text estimate with verified HTML-length search so long messages split at word boundaries instead of mid-word; gracefully degrade when tag overhead exceeds the limit. (#56595)
- Telegram/delivery: skip whitespace-only and hook-blanked text replies in bot delivery to prevent GrammyError 400 empty-text crashes. (#56620)
- Telegram/send: validate `replyToMessageId` at all four API sinks with a shared normalizer that rejects non-numeric, NaN, and mixed-content strings. (#56587)
- Mistral: normalize OpenAI-compatible request flags so official Mistral API runs no longer fail with remaining `422 status code (no body)` chat errors.
- Control UI/config: keep sensitive raw config hidden by default, replace the blank blocked editor with an explicit reveal-to-edit state, and restore raw JSON editing without auto-exposing secrets. Fixes #55322.
- CLI/zsh: defer `compdef` registration until `compinit` is available so zsh completion loads cleanly with plugin managers and manual setups. (#56555)
- BlueBubbles/debounce: guard debounce flush against null message text by sanitizing at the enqueue boundary and adding an independent combiner guard. (#56573)
- Auto-reply: suppress JSON-wrapped `{"action":"NO_REPLY"}` control envelopes before channel delivery with a strict single-key detector; preserves media when text is only a silent envelope. (#56612)
- ACP/ACPX agent registry: align OpenClaw's ACPX built-in agent mirror with the latest `openclaw/acpx` command defaults and built-in aliases, pin versioned `npx` built-ins to exact versions, and stop unknown ACP agent ids from falling through to raw `--agent` command execution on the MCP-proxy path. (#28321) Thanks @m0nkmaster and @vincentkoc.
- Security/audit: extend web search key audit to recognize Gemini, Grok/xAI, Kimi, Moonshot, and OpenRouter credentials via a boundary-safe bundled-web-search registry shim. (#56540)
- Docs/FAQ: remove broken Xfinity SSL troubleshooting cross-links from English and zh-CN FAQ entries — both sections already contain the full workaround inline. (#56500)
- Telegram: deliver verbose tool summaries inside forum topic sessions again, so threaded topic chats now match DM verbose behavior. (#43236) Thanks @frankbuild.
- BlueBubbles/CLI agents: restore inbound prompt image refs for CLI routed turns, reapply embedded runner image size guardrails, and cover both CLI image transport paths with regression tests. (#51373)
- BlueBubbles/groups: optionally enrich unnamed participant lists with local macOS Contacts names after group gating passes, so group member context can show names instead of only raw phone numbers.
- Discord/reconnect: drain stale gateway sockets, clear cached resume state before forced fresh reconnects, and fail closed when old sockets refuse to die so Discord recovery stops looping on poisoned resume state. (#54697) Thanks @ngutman.
- iMessage: stop leaking inline `[[reply_to:...]]` tags into delivered text by sending `reply_to` as RPC metadata and stripping stray directive tags from outbound messages. (#39512) Thanks @mvanhorn.
- CLI/plugins: make routed commands use the same auto-enabled bundled-channel snapshot as gateway startup, so configured bundled channels like Slack load without requiring a prior config rewrite. (#54809) Thanks @neeravmakwana.
- CLI/message send: write manual `openclaw message send` deliveries into the resolved agent session transcript again by always threading the default CLI agent through outbound mirroring. (#54187) Thanks @KevInTheCloud5617.
- CLI/onboarding: show the Kimi Code API key option again in the Moonshot setup menu so the interactive picker includes all Kimi setup paths together. Fixes #54412 Thanks @sparkyrider
- Agents/status: use provider-aware context window lookup for fresh Anthropic 4.6 model overrides so `/status` shows the correct 1.0m window instead of an underreported shared-cache minimum. (#54796) Thanks @neeravmakwana.
- OpenAI/WebSocket: preserve reasoning replay metadata and tool-call item ids on WebSocket tool turns, and start a fresh response chain when full-context resend is required. (#53856) Thanks @xujingchen1996.
- OpenAI/WS: restore reasoning blocks for Responses WebSocket runs and keep reasoning/tool-call replay metadata intact so resumed sessions do not lose or break follow-up reasoning-capable turns. (#53856) Thanks @xujingchen1996.
- Agents/errors: surface provider quota/reset details when available, but keep HTML/Cloudflare rate-limit pages on the generic fallback so raw error pages are not shown to users. (#54512) Thanks @bugkill3r.
- Claude CLI: switch the bundled Claude CLI backend to `stream-json` output so watchdogs see progress on long runs, and keep session/usage metadata even when Claude finishes with an empty result line. (#49698) Thanks @felear2022.
- Claude CLI/MCP: always pass a strict generated `--mcp-config` overlay for background Claude CLI runs, including the empty-server case, so Claude does not inherit ambient user/global MCP servers. (#54961) Thanks @markojak.
- Agents/embedded replies: surface mid-turn 429 and overload failures when embedded runs end without a user-visible reply, while preserving successful media-only replies that still use legacy `mediaUrl`. (#50930) Thanks @infichen.
- Chat/UI: move the chat send button onto the shared ghost-button theme styling, while keeping the stop button icon readable on the danger state. (#55075) Thanks @bottenbenny.
- WhatsApp/allowFrom: show a specific allowFrom policy error for valid blocked targets instead of the misleading `<E.164|group JID>` format hint. Thanks @mcaxtr.
- Agents/cooldowns: scope rate-limit cooldowns per model so one 429 no longer blocks every model on the same auth profile, replace the exponential 1 min -> 1 h escalation with a stepped 30 s / 1 min / 5 min ladder, and surface a user-facing countdown message when all models are rate-limited. (#49834) Thanks @kiranvk-2011.
- Agents/embedded transport errors: distinguish common network failures like connection refused, DNS lookup failure, and interrupted sockets from true timeouts in embedded-run user messaging and lifecycle diagnostics. (#51419) Thanks @scoootscooob.
- Telegram/pairing: ignore self-authored DM `message` updates so bot-pinned status cards and similar service updates do not trigger bogus pairing requests or re-enter inbound dispatch. (#54530) thanks @huntharo
- Mattermost/replies: keep pairing replies, slash-command fallback replies, and model-picker messages on the resolved config path so `exec:` SecretRef bot tokens work across all outbound reply branches. (#48347) thanks @mathiasnagler.
- Microsoft Teams/config: accept the existing `welcomeCard`, `groupWelcomeCard`, `promptStarters`, and feedback/reflection keys in strict config validation so already-supported Teams runtime settings stop failing schema checks. (#54679) Thanks @gumclaw.
- MCP/channels: add a Gateway-backed channel MCP bridge with Codex/Claude-facing conversation tools, Claude channel notifications, and safer stdio bridge lifecycle handling for reconnects and routed session discovery.
- Plugins/SDK: thread `moduleUrl` through plugin-sdk alias resolution so user-installed plugins outside the openclaw directory (e.g. `~/.openclaw/extensions/`) correctly resolve `openclaw/plugin-sdk/*` subpath imports, and gate `plugin-sdk:check-exports` in `release:check`. (#54283) Thanks @xieyongliang.
- Config/web fetch: allow the documented `tools.web.fetch.maxResponseBytes` setting in runtime schema validation so valid configs no longer fail with unrecognized-key errors. (#53401) Thanks @erhhung.
- Message tool/buttons: keep the shared `buttons` schema optional in merged tool definitions so plain `action=send` calls stop failing validation when no buttons are provided. (#54418) Thanks @adzendo.
- Agents/openai-compatible tool calls: deduplicate repeated tool call ids across live assistant messages and replayed history so OpenAI-compatible backends no longer reject duplicate `tool_call_id` values with HTTP 400. (#40996) Thanks @xaeon2026.
- Models/openai-completions: default non-native OpenAI-compatible providers to omit tool-definition `strict` fields unless users explicitly opt back in, so tool calling keeps working on providers that reject that option. (#45497) Thanks @sahancava.
- Plugins/context engines: retry strict legacy `assemble()` calls without the new `prompt` field when older engines reject it, preserving prompt-aware retrieval compatibility for pre-prompt plugins. (#50848) thanks @danhdoan.
- CLI/update status: explicitly say `up to date` when the local version already matches npm latest, while keeping the availability logic unchanged. (#51409) Thanks @dongzhenye.
- Daemon/Linux: stop flagging non-gateway systemd services as duplicate gateways just because their unit files mention OpenClaw, reducing false-positive doctor/log noise. (#45328) Thanks @gregretkowski.
- Feishu: close WebSocket connections on monitor stop/abort so ghost connections no longer persist, preventing duplicate event processing and resource leaks across restart cycles. (#52844) Thanks @schumilin.
- Feishu: use the original message `create_time` instead of `Date.now()` for inbound timestamps so offline-retried messages carry the correct authoring time, preventing mis-targeted agent actions on stale instructions. (#52809) Thanks @schumilin.
- Control UI/Skills: open skill detail dialogs with the browser modal lifecycle so clicking a skill row keeps the panel centered instead of rendering it off-screen at the bottom of the page.
- Matrix/replies: include quoted poll question/options in inbound reply context so the agent sees the original poll content when users reply to Matrix poll messages. (#55056) Thanks @alberthild.
- Matrix/plugins: keep plugin bootstrap from crashing when built runtime mixes bare and deep `matrix-js-sdk` entrypoints, so unrelated channels do not get taken down during plugin load. (#56273) Thanks @aquaright1.
- Agents/sandbox: honor `tools.sandbox.tools.alsoAllow`, let explicit sandbox re-allows remove matching built-in default-deny tools, and keep sandbox explain/error guidance aligned with the effective sandbox tool policy. (#54492) Thanks @ngutman.
- Agents/sandbox: make blocked-tool guidance glob-aware again, redact/sanitize session-specific explain hints for safer copy-paste, and avoid leaking control-character session keys in those hints. (#54684) Thanks @ngutman.
- Agents/compaction: trigger timeout recovery compaction before retrying high-context LLM timeouts so embedded runs stop repeating oversized requests. (#46417) thanks @joeykrug.
- Agents/compaction: reconcile `sessions.json.compactionCount` after a late embedded auto-compaction success so persisted session counts catch up once the handler reports completion. (#45493) Thanks @jackal092927.
- Agents/failover: classify Codex accountId token extraction failures as auth errors so model fallback continues to the next configured candidate. (#55206) Thanks @cosmicnet.
- Plugins/runtime: reuse only compatible active plugin registries across tools, providers, web search, and channel bootstrap, align `/tools/invoke` plugin loading with the session workspace, and retry outbound channel recovery when the pinned channel surface changes so plugin tools and channels stop disappearing or re-registering from mismatched runtime loads. Thanks @gumadeiras.
- Talk/macOS: stop direct system-voice failures from replaying system speech, use app-locale fallback for shared watchdog timing, and add regression coverage for the macOS fallback route and language-aware timeout policy. (#53511) thanks @hongsw.
- Discord/gateway cleanup: keep late Carbon reconnect-exhausted errors suppressed through startup/dispose cleanup so Discord monitor shutdown no longer crashes on late gateway close events. (#55373) Thanks @Takhoffman.
- Discord/gateway shutdown: treat expected reconnect-exhausted events during intentional lifecycle stop as clean shutdowns so startup-abort cleanup no longer surfaces false gateway failures. (#55324) Thanks @joelnishanth.
- Discord/gateway shutdown: suppress reconnect-exhausted events that were already buffered before teardown flips `lifecycleStopping`, so stale-socket Discord restarts no longer crash the whole gateway. Fixes #55403 and #55421. Thanks @lml2468 and @vincentkoc.
- GitHub Copilot/auth refresh: treat large `expires_at` values as seconds epochs and clamp far-future runtime auth refresh timers so Copilot token refresh cannot fall into a `setTimeout` overflow hot loop. (#55360) Thanks @michael-abdo.
- Agents/status: use the persisted runtime session model in `session_status` when no explicit override exists, and honor per-agent `thinkingDefault` in both `session_status` and `/status`. (#55425) Thanks @scoootscooob, @xaeon2026, and @ysfbsf.
- Heartbeat/runner: guarantee the interval timer is re-armed after heartbeat runs and unexpected runner errors so scheduled heartbeats do not silently stop after an interrupted cycle. (#52270) Thanks @MiloStack.
- Config/Doctor: rewrite stale bundled plugin load paths from legacy `extensions/*` locations to the packaged bundled path, including directory-name mismatches and slash-suffixed config entries. (#55054) Thanks @SnowSky1.
- WhatsApp/mentions: stop treating mentions embedded in quoted messages as direct mentions so replying to a message that @mentioned the bot no longer falsely triggers mention gating. (#52711) Thanks @lurebat.
- Matrix: keep separate 2-person rooms out of DM routing after `m.direct` seeds successfully, while still honoring explicit `is_direct` state and startup fallback recovery. (#54890) thanks @private-peter
- Agents/ollama fallback: surface non-2xx Ollama HTTP errors with a leading status code so HTTP 503 responses trigger model fallback again. (#55214) Thanks @bugkill3r.
- Feishu/tools: stop synthetic agent ids like `agent-spawner` from being treated as Feishu account ids during tool execution, so tools fall back to the configured/default Feishu account unless the contextual id is a real enabled Feishu account. (#55627) Thanks @MonkeyLeeT.
- Google/tools: strip empty `required: []` arrays from Gemini tool schemas so optional-only tool parameters no longer trigger Google validator 400s. (#52106) Thanks @oliviareid-svg.
- Onboarding/TUI/local gateways: show the resolved gateway port in setup output, clarify no-daemon local health/dashboard messaging, and preserve loopback Control UI auth on reruns and explicit local gateway URLs so local quickstart flows recover cleanly. (#55730) Thanks @shakkernerd.
- TUI/chat log: keep system messages as single logical entries and prune overflow at whole-message boundaries so wrapped system spacing stays intact. (#55732) Thanks @shakkernerd.
- TUI/activation: validate `/activation` arguments in the TUI and reject invalid values instead of silently coercing them to `mention`. (#55733) Thanks @shakkernerd.
- Agents/model switching: apply `/model` changes to active embedded runs at the next safe retry boundary, so overloaded or retrying turns switch to the newly selected model instead of staying pinned to the old provider.
- Agents/Codex fallback: classify Codex `server_error` payloads as failoverable, sanitize `Codex error:` payloads before they reach chat, preserve context-overflow guidance for prefixed `invalid_request_error` payloads, and omit provider `request_id` values from user-facing UI copy. (#42892) Thanks @xaeon2026.
- Memory/search: share memory embedding provider registrations across split plugin runtimes so memory search no longer fails with unknown provider errors after memory-core registers built-in adapters. (#55945) Thanks @glitch418x.
- Discord/Carbon beta: update `@buape/carbon` to the latest beta and pass the new `RateLimitError` request argument so Discord stays compatible with the upstream beta constructor change. (#55980) Thanks @ngutman.
- Plugins/inbound claims: pass full inbound attachment arrays through `inbound_claim` hook metadata while keeping the legacy singular media attachment fields for compatibility. (#55452) Thanks @huntharo.
- Plugins/Matrix: preserve sender filenames for inbound media by forwarding `originalFilename` to `saveMediaBuffer`. (#55692) thanks @esrehmki.
- Matrix/mentions: recognize `matrix.to` mentions whose visible label uses the bot's room display name, so `requireMention: true` rooms respond correctly in modern Matrix clients. (#55393) thanks @nickludlam.
- Ollama/thinking off: route `thinkingLevel=off` through the live Ollama extension request path so thinking-capable Ollama models now receive top-level `think: false` instead of silently generating hidden reasoning tokens. (#53200) Thanks @BruceMacD.
- Plugins/diffs: stage bundled `@pierre/diffs` runtime dependencies during packaged updates so the bundled diff viewer keeps loading after global installs and updates. (#56077) Thanks @gumadeiras.
- Plugins/diffs: load bundled Pierre themes without JSON module imports so diff rendering keeps working on newer Node builds. (#45869) thanks @NickHood1984.
- Plugins/uninstall: remove owned `channels.<id>` config when uninstalling channel plugins, and keep the uninstall preview aligned with explicit channel ownership so built-in channels and shared keys stay intact. (#35915) Thanks @wbxl2000.
- Plugins/Matrix: prefer explicit DM signals when choosing outbound direct rooms and routing unmapped verification summaries, so strict 2-person fallback rooms do not outrank the real DM. (#56076) thanks @gumadeiras
- Plugins/Matrix: resolve env-backed `accessToken` and `password` SecretRefs against the active Matrix config env path during startup, and officially accept SecretRef `accessToken` config values. (#54980) thanks @kakahu2015.
- Microsoft Teams/proactive DMs: prefer the freshest personal conversation reference for `user:<aadObjectId>` sends when multiple stored references exist, so replies stop targeting stale DM threads. (#54702) Thanks @gumclaw.
- Gateway/plugins: reuse the session workspace when building HTTP `/tools/invoke` tool lists and harden tool construction to infer the session agent workspace by default, so workspace plugins do not re-register on repeated HTTP tool calls. (#56101) thanks @neeravmakwana
- Brave/web search: normalize unsupported Brave `country` filters to `ALL` before request and cache-key generation so locale-derived values like `VN` stop failing with upstream 422 validation errors. (#55695) Thanks @chen-zhang-cs-code.
- Discord/replies: preserve leading indentation when stripping inline reply tags so reply-tagged plain text and fenced code blocks keep their formatting. (#55960) Thanks @Nanako0129.
- Daemon/status: surface immediate gateway close reasons from lightweight probes and prefer those concrete auth or pairing failures over generic timeouts in `openclaw daemon status`. (#56282) Thanks @mbelinky.
- Agents/failover: classify HTTP 410 errors as retryable timeouts by default while still preserving explicit session-expired, billing, and auth signals from the payload. (#55201) thanks @nikus-pan.
- Agents/subagents: restore completion announce delivery for extension channels like BlueBubbles. (#56348)
- Plugins/Matrix: load bundled `@matrix-org/matrix-sdk-crypto-nodejs` through `createRequire(...)` so E2EE media send and receive keep the package-local native binding lookup working in packaged ESM builds. (#54566) thanks @joelnishanth.
- Plugins/Matrix: encrypt E2EE image thumbnails with `thumbnail_file` while keeping unencrypted-room previews on `thumbnail_url`, so encrypted Matrix image events keep thumbnail metadata without leaking plaintext previews. (#54711) thanks @frischeDaten.
- Telegram/forum topics: keep native `/new` and `/reset` routed to the active topic by preserving the topic target on forum-thread command context. (#35963)

---

### 📦 v2026.3.31 (2026-03-31)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.3.31)

> [!NOTE]
> **DeXMart-relevant keywords:** `whatsapp`, `telegram`

#### ⚠️ Breaking Changes

- Nodes/exec: remove the duplicated `nodes.run` shell wrapper from the CLI and agent `nodes` tool so node shell execution always goes through `exec host=node`, keeping node-specific capabilities on `nodes invoke` and the dedicated media/location/notify actions.
- Plugin SDK: deprecate the legacy provider compat subpaths plus the older bundled provider setup and channel-runtime compatibility shims, emit migration warnings, and keep the current documented `openclaw/plugin-sdk/*` entrypoints plus local `api.ts` / `runtime-api.ts` barrels as the forward path ahead of a future major-release removal.
- Skills/install and Plugins/install: built-in dangerous-code `critical` findings and install-time scan failures now fail closed by default, so plugin installs and gateway-backed skill dependency installs that previously succeeded may now require an explicit dangerous override such as `--dangerously-force-unsafe-install` to proceed.
- Gateway/auth: `trusted-proxy` now rejects mixed shared-token configs, and local-direct fallback requires the configured token instead of implicitly authenticating same-host callers. Thanks @zhangning-agent, @jacobtomlinson, and @vincentkoc.
- Gateway/node commands: node commands now stay disabled until node pairing is approved, so device pairing alone is no longer enough to expose declared node commands. (#57777) Thanks @jacobtomlinson.
- Gateway/node events: node-originated runs now stay on a reduced trusted surface, so notification-driven or node-triggered flows that previously relied on broader host/session tool access may need adjustment. (#57691) Thanks @jacobtomlinson.

#### Changes (Features)

- ACP/plugins: add an explicit default-off ACPX plugin-tools MCP bridge config, document the trust boundary, and harden the built-in bridge packaging/logging path so global installs and stdio MCP sessions work reliably. (#56867) Thanks @joe2643.
- Agents/LLM: add a configurable idle-stream timeout for embedded runner requests so stalled model streams abort cleanly instead of hanging until the broader run timeout fires. (#55072) Thanks @liuy.
- Agents/MCP: materialize bundle MCP tools with provider-safe names (`serverName__toolName`), support optional `streamable-http` transport selection plus per-server connection timeouts, and preserve real tool results from aborted/error turns unless truncation explicitly drops them. (#49505) Thanks @ziomancer.
- Android/notifications: add notification-forwarding controls with package filtering, quiet hours, rate limiting, and safer picker behavior for forwarded notification events. (#40175) Thanks @nimbleenigma.
- Background tasks: turn tasks into a real shared background-run control plane instead of ACP-only bookkeeping by unifying ACP, subagent, cron, and background CLI execution under one SQLite-backed ledger, routing detached lifecycle updates through the executor seam, adding audit/maintenance/status visibility, tightening auto-cleanup and lost-run recovery, improving task awareness in internal status/tool surfaces, and clarifying the split between heartbeat/main-session automation and detached scheduled runs. Thanks @mbelinky and @vincentkoc.
- Background tasks: add the first linear task flow control surface with `openclaw flows list|show|cancel`, keep manual multi-task flows separate from one-task auto-sync flows, and surface doctor recovery hints for obviously orphaned or broken flow/task linkage. Thanks @mbelinky and @vincentkoc.
- Channels/QQ Bot: add QQ Bot as a bundled channel plugin with multi-account setup, SecretRef-aware credentials, slash commands, reminders, and media send/receive support. (#52986) Thanks @sliverp.
- Diffs: skip unused viewer-versus-file SSR preload work so `diffs` view-only and file-only runs do less render work while keeping mode outputs aligned. (#57909) thanks @gumadeiras.
- Tasks: add a minimal SQLite-backed task flow registry plus task-to-flow linkage scaffolding, so orchestrated work can start gaining a first-class parent record without changing current task delivery behavior. Thanks @mbelinky and @vincentkoc.
- Tasks: persist blocked state on one-task task flows and let the same flow reopen cleanly on retry, so blocked detached work can carry a parent-level reason and continue without fragmenting into a new job. Thanks @mbelinky and @vincentkoc.
- Tasks: route one-task ACP and subagent updates through a parent task-flow owner context, so detached work can emerge back through the intended parent thread/session instead of speaking only as a raw child task. Thanks @mbelinky and @vincentkoc.
- LINE/outbound media: add LINE image, video, and audio outbound sends on the LINE-specific delivery path, including explicit preview/tracking handling for videos while keeping generic media sends on the existing image-only route. (#45826) Thanks @masatohoshino.
- Matrix/history: add optional room history context for Matrix group triggers via `channels.matrix.historyLimit`, with per-agent watermarks and retry-safe snapshots so failed trigger retries do not drift into newer room messages. (#57022) thanks @chain710.
- Matrix/network: add explicit `channels.matrix.proxy` config for routing Matrix traffic through an HTTP(S) proxy, including account-level overrides and matching probe/runtime behavior. (#56931) thanks @patrick-yingxi-pan.
- Matrix/streaming: add draft streaming so partial Matrix replies update the same message in place instead of sending a new message for each chunk. (#56387) Thanks @jrusz.
- Matrix/threads: add per-DM `threadReplies` overrides and keep thread session isolation aligned with the effective room or DM thread policy from the triggering message onward. (#57995) thanks @teconomix.
- MCP: add remote HTTP/SSE server support for `mcp.servers` URL configs, including auth headers and safer config redaction for MCP credentials. (#50396) Thanks @dhananjai1729.
- Memory/QMD: add per-agent `memorySearch.qmd.extraCollections` so agents can opt into cross-agent session search without flattening every transcript collection into one shared QMD namespace. Thanks @vincentkoc.
- Microsoft Teams/member info: add a Graph-backed member info action so Teams automations and tools can resolve channel member details directly from Microsoft Graph. (#57528) Thanks @sudie-codes.
- Nostr/inbound DMs: verify inbound event signatures before pairing or sender-authorization side effects, so forged DM events no longer create pairing requests or trigger reply attempts. Thanks @smaeljaish771 and @vincentkoc.
- OpenAI/Responses: forward configured `text.verbosity` across Responses HTTP and WebSocket transports, surface it in `/status`, and keep per-agent verbosity precedence aligned with runtime behavior. (#47106) Thanks @merc1305 and @vincentkoc.
- Pi/Codex: add native Codex web search support for embedded Pi runs, including config/docs/wizard coverage and managed-tool suppression when native Codex search is active. (#46579) Thanks @Evizero.
- Slack/exec approvals: add native Slack approval routing and approver authorization so exec approval prompts can stay in Slack instead of falling back to the Web UI or terminal. Thanks @vincentkoc.
- TTS: Add structured provider diagnostics and fallback attempt analytics. (#57954) Thanks @joshavant.
- WhatsApp/reactions: agents can now react with emoji on incoming WhatsApp messages, enabling more natural conversational interactions like acknowledging a photo with ❤️ instead of typing a reply. Thanks @mcaxtr.
- Agents/BTW: force `/btw` side questions to disable provider reasoning so Anthropic adaptive-thinking sessions stop failing with `No BTW response generated`. Fixes #55376. Thanks @Catteres and @vincentkoc.
- CLI/onboarding: reset the remote gateway URL prompt to the safe loopback default after declining a discovered endpoint, so onboarding does not keep a previously rejected remote URL. (#57828)
- Agents/exec defaults: honor per-agent `tools.exec` defaults when no inline directive or session override is present, so configured exec host, security, ask, and node settings actually apply. (#57689)
- Sandbox/networking: sanitize SSH subprocess env vars through the shared sandbox policy and route marketplace archive downloads plus Ollama discovery, auth, and pull requests through the guarded fetch path so sandboxed execution and remote fetches follow the repo's trust boundaries. (#57848, #57850)

#### Fixes

- Slack: stop retry-driven duplicate replies when draft-finalization edits fail ambiguously, and log configured allowlisted users/channels by readable name instead of raw IDs.
- Agents/OpenAI Responses: normalize raw bundled MCP tool schemas on the WebSocket/Responses path so bare-object, object-ish, and top-level union MCP tools no longer get rejected by OpenAI during tool registration. (#58299) Thanks @yelog.
- ACP/security: replace ACP's dangerous-tool name override with semantic approval classes, so only narrow readonly reads/searches can auto-approve while indirect exec-capable and control-plane tools always require explicit prompt approval. Thanks @vincentkoc.
- ACP/sessions_spawn: register ACP child runs for completion tracking and lifecycle cleanup, and make registration-failure cleanup explicitly best-effort so callers do not assume an already-started ACP turn was fully aborted. (#40885) Thanks @xaeon2026 and @vincentkoc.
- ACP/tasks: mark cleanly exited ACP runs as blocked when they end on deterministic write or authorization blockers, and wake the parent session with a follow-up instead of falsely reporting success.
- ACPX/runtime: derive the bundled ACPX expected version from the extension package metadata instead of hardcoding a separate literal, so plugin-local ACPX installs stop drifting out of health-check parity after version bumps. (#49089) Thanks @jiejiesks and @vincentkoc.
- Agents/Anthropic failover: treat Anthropic `api_error` payloads with `An unexpected error occurred while processing the response` as transient so retry/fallback can engage instead of surfacing a terminal failure. (#57441) Thanks @zijiess and @vincentkoc.
- Agents/compaction: keep late compaction-retry completions from double-resolving finished compaction futures, so interrupted or timed-out compactions stop surfacing spurious second-completion races. (#57796) Thanks @joshavant.
- Agents/disabled providers: make disabled providers disappear from default model selection and embedded provider fallback, while letting explicitly pinned disabled providers fail with a clear config error instead of silently taking traffic. (#57735) Thanks @rileybrown-dev and @vincentkoc.
- Agents/OAuth output: force exec-host OAuth output readers through the gateway fs policy so embedded gateway runs stop crashing when provider auth writes land outside the current sandbox workspace. (#58249) Thanks @joshavant.
- Agents/system prompt: fix `agent.name` interpolation in the embedded runtime system prompt and make provider/model fallback text reflect the effective runtime selection after start. (#57625) Thanks @StllrSvr and @vincentkoc.
- Android/device info: read the app's version metadata from the package manager instead of hidden APIs so Android 15+ onboarding and device info no longer fail to compile or report placeholder values. (#58126) Thanks @L3ER0Y.
- Android/pairing: stop appending duplicate push receiver entries to `gateway-service.conf` on repeated QR pairing and keep push registration bounded to the current successful pairing, so Android push delivery stays healthy across re-pair and token rotation. (#58256) Thanks @surrealroad.
- App install smoke: pin the latest-release lookup to `latest`, cache the first stable install version across the rerun, and relax prerelease package assertions so the Parallels smoke lane can validate stable-to-main upgrades even when `beta` moves ahead or the guest starts from an older stable. (#58177) Thanks @vincentkoc.
- Auth/profiles: keep the last successful config load in memory for the running process and refresh that snapshot on successful writes/reloads, so hot paths stop reparsing `openclaw.json` between watcher-driven swaps.
- Config/SecretRef + Control UI: harden SecretRef redaction round-trip restore, block unsafe raw fallback (force Form mode when raw is unavailable), and preflight submitted-config SecretRefs before config write RPC persistence. (#58044) Thanks @joshavant.
- Config/Telegram: migrate removed `channels.telegram.groupMentionsOnly` into `channels.telegram.groups[\"*\"].requireMention` on load so legacy configs no longer crash at startup. (#55336) thanks @jameslcowan.
- Config/update: stop `openclaw doctor` write-backs from persisting plugin-injected channel defaults, so `openclaw update` no longer seeds config keys that later break service refresh validation. (#56834) Thanks @openperf.
- Control UI/agents: auto-load agent workspace files on initial Files panel open, and populate overview model/workspace/fallbacks from effective runtime agent metadata so defaulted models no longer show as `Not set`. (#56637) Thanks @dxsx84.
- Control UI/slash commands: make `/steer` and `/redirect` work from the chat command palette with visible pending state for active-run `/steer`, correct redirected-run tracking, and a single canonical `/steer` entry in the command menu. (#54625) Thanks @fuller-stack-dev.
- Cron/announce: preserve all deliverable text payloads for announce mode instead of collapsing to the last chunk, so multi-line cron reports deliver in full to Telegram forum topics.
- Cron/isolated sessions: carry the full live-session provider, model, and auth-profile selection across retry restarts so cron jobs with model overrides no longer fail or loop on mid-run model-switch requests. (#57972) Thanks @issaba1.
- Diffs/config: preserve schema-shaped plugin config parsing from `diffsPluginConfigSchema.safeParse()`, so direct callers keep `defaults` and `security` sections instead of receiving flattened tool defaults. (#57904) Thanks @gumadeiras.
- Diffs: fall back to plain text when `lang` hints are invalid during diff render and viewer hydration, so bad or stale language values no longer break the diff viewer. (#57902) Thanks @gumadeiras.
- Discord/voice: enforce the same guild channel and member allowlist checks on spoken voice ingress before transcription, so joined voice channels no longer accept speech from users outside the configured Discord access policy. Thanks @cyjhhh and @vincentkoc.
- Docker/setup: force BuildKit for local image builds (including sandbox image builds) so `./docker-setup.sh` no longer fails on `RUN --mount=...` when hosts default to Docker's legacy builder. (#56681) Thanks @zhanghui-china.
- Docs/anchors: fix broken English docs links and make Mint anchor audits run against the English-source docs tree. (#57039) thanks @velvet-shark.
- Doctor/plugins: skip false Matrix legacy-helper warnings when no migration plans exist, and keep bundled `enabledByDefault` plugins in the gateway startup set. (#57931) Thanks @dinakars777.
- Exec approvals/macOS: unwrap `arch` and `xcrun` before deriving shell payloads and allow-always patterns, so wrapper approvals stay bound to the carried command instead of the outer carrier. Thanks @tdjackey and @vincentkoc.
- Exec approvals: unwrap `caffeinate` and `sandbox-exec` before persisting allow-always trust so later shell payload changes still require a fresh approval. Thanks @tdjackey and @vincentkoc.
- Exec/approvals: infer Discord and Telegram exec approvers from existing owner config when `execApprovals.approvers` is unset, extend the default approval window to 30 minutes, and clarify approval-unavailable guidance so approvals do not appear to silently disappear.
- Pi/TUI: flush message-boundary replies at `message_end` so turns stop looking stuck until the next nudge when the final reply was already ready. Thanks @vincentkoc.
- Exec/approvals: keep `awk` and `sed` family binaries out of the low-risk `safeBins` fast path, and stop doctor profile scaffolding from treating them like ordinary custom filters. Thanks @vincentkoc.
- Exec/env: block proxy, TLS, and Docker endpoint env overrides in host execution so request-scoped commands cannot silently reroute outbound traffic or trust attacker-supplied certificate settings. Thanks @AntAISecurityLab.
- Exec/env: block Python package index override variables from request-scoped host exec environment sanitization so package fetches cannot be redirected through a caller-supplied index. Thanks @nexrin and @vincentkoc.
- Exec/node: stop gateway-side workdir fallback from rewriting explicit `host=node` cwd values to the gateway filesystem, so remote node exec approval and runs keep using the intended node-local directory. (#50961) Thanks @openperf.
- Exec/runtime: default implicit exec to `host=auto`, resolve that target to sandbox only when a sandbox runtime exists, keep explicit `host=sandbox` fail-closed without sandbox, and show `/exec` effective host state in runtime status/docs.
- Exec: fail closed when the implicit sandbox host has no sandbox runtime, and stop denied async approval followups from reusing prior command output from the same session. (#56800) Thanks @scoootscooob.
- Feishu/groups: keep quoted replies and topic bootstrap context aligned with group sender allowlists so only allowlisted thread messages seed agent context. Thanks @AntAISecurityLab and @vincentkoc.
- Gateway/attachments: offload large inbound images without leaking `media://` markers into text-only runs, preserve mixed attachment order for model input/transcripts, and fail closed when model image capability cannot be resolved. (#55513) Thanks @Syysean.
- Gateway/auth: keep shared-auth rate limiting active during WebSocket handshake attempts even when callers also send device-token candidates, so bogus device-token fields no longer suppress shared-secret brute-force tracking. Thanks @kexinoh and @vincentkoc.
- Gateway/auth: reject mismatched browser `Origin` headers on trusted-proxy HTTP operator requests while keeping origin-less headless proxy clients working. Thanks @AntAISecurityLab and @vincentkoc.
- Gateway/device tokens: disconnect active device sessions after token rotation so newly rotated credentials revoke existing live connections immediately instead of waiting for those sockets to close naturally. Thanks @zsxsoft and @vincentkoc.
- Gateway/health: carry webhook-vs-polling account mode from channel descriptors into runtime snapshots so passive channels like LINE and BlueBubbles skip false stale-socket health failures. (#47488) Thanks @karesansui-u.
- Gateway/pairing: restore QR bootstrap onboarding handoff so fresh `/pair qr` iPhone setup can auto-approve the initial node pairing, receive a reusable node device token, and stop retrying with spent bootstrap auth. (#58382) Thanks @ngutman.
- Gateway/OpenAI compatibility: accept flat Responses API function tool definitions on `/v1/responses` and preserve `strict` when normalizing hosted tools into the embedded runner, so spec-compliant clients like Codex no longer fail validation or silently lose strict tool enforcement. Thanks @malaiwah and @vincentkoc.
- Gateway/OpenAI HTTP: restore default operator scopes for bearer-authenticated requests that omit `x-openclaw-scopes`, so headless `/v1/chat/completions` and session-history callers work again after the recent method-scope hardening. (#57596) Thanks @openperf.
- Gateway/plugins: scope plugin-auth HTTP route runtime clients to read-only access and keep gateway-authenticated plugin routes on write scope, so plugin-owned webhook handlers do not inherit write-capable runtime access by default. Thanks @davidluzsilva and @vincentkoc.
- Gateway/SecretRef: resolve restart token drift checks with merged service/runtime env sources and hard-fail unsupported mutable SecretRef plus OAuth-profile combinations so restart warnings and policy enforcement match runtime behavior. (#58141) Thanks @joshavant.
- Gateway/tools HTTP: tighten HTTP tool-invoke authorization so owner-only tools stay off HTTP invoke paths. (#57773) Thanks @jacobtomlinson.
- Harden async approval followup delivery in webchat-only sessions (#57359) Thanks @joshavant.
- Heartbeat/auth: prevent exec-event heartbeat runs from inheriting owner-only tool access from the session delivery target, so node exec output stays on the non-owner tool surface even when the target session belongs to the owner. Thanks @AntAISecurityLab and @vincentkoc.
- Hooks/config: accept runtime channel plugin ids in `hooks.mappings[].channel` (for example `feishu`) instead of rejecting non-core channels during config validation. (#56226) Thanks @AiKrai001.
- Hooks/session routing: rebind hook-triggered `agent:` session keys to the actual target agent before isolated dispatch so dedicated hook agents keep their own session-scoped tool and plugin identity. Thanks @kexinoh and @vincentkoc.
- Host exec/env: block additional request-scoped env overrides that can redirect Docker endpoints, trust roots, compiler include paths, package resolution, or Python environment roots during approved host runs. Thanks @tdjackey and @vincentkoc.
- Image generation/build: write stable runtime alias files into `dist/` and route provider-auth runtime lookups through those aliases so image-generation providers keep resolving auth/runtime modules after rebuilds instead of crashing on missing hashed chunk files.
- iOS/Live Activities: mark the `ActivityKit` import in `LiveActivityManager.swift` as `@preconcurrency` so Xcode 26.4 / Swift 6 builds stop failing on strict concurrency checks. (#57180) Thanks @ngutman.
- LINE/ACP: add current-conversation binding and inbound binding-routing parity so `/acp spawn ... --thread here`, configured ACP bindings, and active conversation-bound ACP sessions work on LINE like the other conversation channels.
- LINE/markdown: preserve underscores inside Latin, Cyrillic, and CJK words when stripping markdown, while still removing standalone `_italic_` markers on the shared text-runtime path used by LINE and TTS. (#47465) Thanks @jackjin1997.
- Agents/failover: make overloaded same-provider retry count and retry delay configurable via `auth.cooldowns`, default to one retry with no delay, and document the model-fallback behavior.

---

### 📦 v2026.4.1 (2026-04-01)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.4.1)

> [!NOTE]
> **DeXMart-relevant keywords:** `whatsapp`, `telegram`, `billing`

#### Changes (Features)

- Tasks/chat: add `/tasks` as a chat-native background task board for the current session, with recent task details and agent-local fallback counts when no linked tasks are visible. Related #54226. Thanks @vincentkoc.
- Web search/SearXNG: add the bundled SearXNG provider plugin for `web_search` with configurable host support. (#57317) Thanks @cgdusek.
- Amazon Bedrock/Guardrails: add Bedrock Guardrails support to the bundled provider. (#58588) Thanks @MikeORed.
- macOS/Voice Wake: add the Voice Wake option to trigger Talk Mode. (#58490) Thanks @SmoothExec.
- Feishu/comments: add a dedicated Drive comment-event flow with comment-thread context resolution, in-thread replies, and `feishu_drive` comment actions for document collaboration workflows. (#58497) Thanks @wittam-01.
- Gateway/webchat: make `chat.history` text truncation configurable with `gateway.webchat.chatHistoryMaxChars` and per-request `maxChars`, while preserving silent-reply filtering and existing default payload limits. (#58900)
- Agents/default params: add `agents.defaults.params` for global default provider parameters. (#58548) Thanks @lpender.
- Agents/failover: cap prompt-side and assistant-side same-provider auth-profile retries for rate-limit failures before cross-provider model fallback, add the `auth.cooldowns.rateLimitedProfileRotations` knob, and document the new fallback behavior. (#58707) Thanks @Forgely3D
- Cron/tools allowlist: add `openclaw cron --tools` for per-job tool allowlists. (#58504) Thanks @andyk-ms.
- Channels/session routing: move provider-specific session conversation grammar into plugin-owned session-key surfaces, preserving Telegram topic routing and Feishu scoped inheritance across bootstrap, model override, restart, and tool-policy paths.
- WhatsApp/reactions: add `reactionLevel` guidance for agent reactions. Thanks @mcaxtr.
- Telegram/errors: add configurable `errorPolicy` and `errorCooldownMs` controls so Telegram can suppress repeated delivery errors per account, chat, and topic without muting distinct failures. (#51914) Thanks @chinar-amrutkar
- ZAI/models: add `glm-5.1` and `glm-5v-turbo` to the bundled Z.AI provider catalog. (#58793) Thanks @tomsun28
- Agents/compaction: resolve `agents.defaults.compaction.model` consistently for manual `/compact` and other context-engine compaction paths, so engine-owned compaction uses the configured override model across runtime entrypoints. (#56710) Thanks @oliviareid-svg

#### Fixes

- Chat/error replies: stop leaking raw provider/runtime failures into external chat channels, return a friendly retry message instead, and add a specific `/new` hint for Bedrock toolResult/toolUse session mismatches. (#58831) Thanks @ImLukeF.
- Gateway/reload: ignore startup config writes by persisted hash in the config reloader so generated auth tokens and seeded Control UI origins do not trigger a restart loop, while real `gateway.auth.*` edits still require restart. (#58678) Thanks @yelog
- Tasks/gateway: keep the task registry maintenance sweep from stalling the gateway event loop under synchronous SQLite pressure, so upgraded gateways stop hanging about a minute after startup. (#58670) Thanks @openperf
- Tasks/status: hide stale completed background tasks from `/status` and `session_status`, prefer live task context, and show recent failures only when no active work remains. (#58661) Thanks @vincentkoc
- Tasks/gateway: re-check the current task record before maintenance marks runs lost or prunes them, so a task heartbeat or cleanup update that lands during a sweep no longer gets overwritten by stale snapshot state.
- Exec/approvals: honor `exec-approvals.json` security defaults when inline or configured tool policy is unset, and keep Slack and Discord native approval handling aligned with inferred approvers and real channel enablement so remote exec stops falling into false approval timeouts and disabled states. Thanks @scoootscooob and @vincentkoc.
- Exec/approvals: make `allow-always` persist as durable user-approved trust instead of behaving like `allow-once`, reuse exact-command trust on shell-wrapper paths that cannot safely persist an executable allowlist entry, keep static allowlist entries from silently bypassing `ask:"always"`, and require explicit approval when Windows cannot build an allowlist execution plan instead of hard-dead-ending remote exec. Thanks @scoootscooob and @vincentkoc.
- Exec/cron: resolve isolated cron no-route approval dead-ends from the effective host fallback policy when trusted automation is allowed, and make `openclaw doctor` warn when `tools.exec` is broader than `~/.openclaw/exec-approvals.json` so stricter host-policy conflicts are explicit. Thanks @scoootscooob and @vincentkoc.
- Sessions/model switching: keep `/model` changes queued behind busy runs instead of interrupting the active turn, and retarget queued followups so later work picks up the new model as soon as the current turn finishes.
- Gateway/HTTP: skip failing HTTP request stages so one broken facade no longer forces every HTTP endpoint to return 500. (#58746) Thanks @yelog
- Gateway/nodes: stop pinning live node commands to the approved node-pair record. Node pairing remains a trust/token flow, while per-node `system.run` policy stays in that node's exec approvals config. Fixes #58824.
- WebChat/exec approvals: use native approval UI guidance in agent system prompts instead of telling agents to paste manual `/approve` commands in webchat sessions. Thanks @vincentkoc.
- Web UI/OpenResponses: preserve rewritten stream snapshots in webchat and keep OpenResponses final streamed text aligned when models rewind earlier output. (#58641) Thanks @neeravmakwana
- Discord/inbound media: pass Discord attachment and sticker downloads through the shared idle-timeout and worker-abort path so slow or stuck inbound media fetches stop hanging message processing. (#58593) Thanks @aquaright1
- Telegram/retries: keep non-idempotent sends on the strict safe-send path, retry wrapped pre-connect failures, and preserve `429` / `retry_after` backoff for safe delivery retries. (#51895) Thanks @chinar-amrutkar
- Telegram/exec approvals: route topic-aware exec approval followups through Telegram-owned threading and approval-target parsing, so forum-topic approvals stay in the originating topic instead of falling back to the root chat. (#58783)
- Telegram/local Bot API: preserve media MIME types for absolute-path downloads so local audio files still trigger transcription and other MIME-based handling. (#54603) Thanks @jzakirov
- Channels/WhatsApp: pass inbound message timestamp to model context so the AI can see when WhatsApp messages were sent. (#58590) Thanks @Maninae
- Channels/QQ Bot: keep `/bot-logs` export gated behind a truly explicit QQBot allowlist, rejecting wildcard and mixed wildcard entries while preserving the real framework command path. Thanks @vincentkoc.
- Channels/plugins: keep bundled channel plugins loadable from legacy `channels.<id>` config even under restrictive plugin allowlists, and make `openclaw doctor` warn only on real plugin blockers instead of misleading setup guidance. (#58873) Thanks @obviyus
- Plugins/bundled runtimes: restore externalized bundled plugin runtime dependency staging across packed installs, Docker builds, and local runtime staging so bundled plugins keep their declared runtime deps after the 2026.3.31 externalization change. (#58782)
- LINE/runtime: resolve the packaged runtime contract from the built `dist/plugins/runtime` layout so LINE channels start correctly again after global npm installs on `2026.3.31`. (#58799) Thanks @vincentkoc.
- MiniMax/plugins: auto-enable the bundled MiniMax plugin for API-key auth/config so MiniMax image generation and other plugin-owned capabilities load without manual plugin allowlisting. (#57127) Thanks @tars90percent.
- Ollama/model picker: show only Ollama models after provider selection in the CLI picker. (#55290) Thanks @Luckymingxuan.
- CDP/profiles: prefer `cdpPort` over stale WebSocket URLs so browser automation reconnects cleanly. (#58499) Thanks @Mlightsnow.
- Media/paths: resolve relative `MEDIA` paths against the agent workspace so local attachment references keep working. (#58624) Thanks @aquaright1.
- Memory/session indexing: keep full reindexes from skipping session transcripts when sync is triggered by `session-start` or `watch`, so restart-driven reindexes preserve session memory. (#39732) Thanks @upupc
- Memory/QMD: prefer `--mask` over `--glob` when creating QMD collections so default memory collections keep their intended patterns and stop colliding on restart. (#58643) Thanks @GitZhangChi.
- Subagents/tasks: keep subagent completion and cleanup from crashing when task-registry writes fail, so a corrupt or missing task row no longer takes down the gateway during lifecycle finalization. Thanks @vincentkoc.
- Sandbox/browser: compare browser runtime inspection against `agents.defaults.sandbox.browser.image` so `openclaw sandbox list --browser` stops reporting healthy browser containers as image mismatches. (#58759) Thanks @sandpile.
- Plugins/install: forward `--dangerously-force-unsafe-install` through archive and npm-spec plugin installs so the documented override reaches the security scanner on those install paths. (#58879) Thanks @ryanlee-gemini.
- Auto-reply/commands: strip inbound metadata before slash command detection so wrapped `/model`, `/new`, and `/status` commands are recognized. (#58725) Thanks @Mlightsnow.
- Agents/Anthropic: preserve thinking blocks and signatures across replay, cache-control patching, and context pruning so compacted Anthropic sessions continue working instead of failing on later turns. (#58916) Thanks @obviyus
- Agents/failover: unify structured and raw provider error classification so provider-specific `400`/`422` payloads no longer get forced into generic format failures before retry, billing, or compaction logic can inspect them. (#58856) Thanks @aaron-he-zhu.
- Auth profiles/store: coerce misplaced SecretRef objects out of plaintext `key` and `token` fields during store load so agents without ACP runtime stop crashing on `.trim()` after upgrade. (#58923) Thanks @openperf.
- ACPX/runtime: repair `queue owner unavailable` session recovery by replacing dead named sessions and resuming the backend session when ACPX exposes a stable session id, so the first ACP prompt no longer inherits a dead handle. (#58669) Thanks @neeravmakwana
- ACPX/runtime: retry dead-session queue-owner repair without `--resume-session` when the reported ACPX session id is stale, so recovery still creates a fresh named session instead of failing session init. Thanks @obviyus.
- Auth/OpenAI Codex: persist plugin-refreshed OAuth credentials to `auth-profiles.json` before returning them, so rotated Codex refresh tokens survive restart and stop falling into `refresh_token_reused` loops. (#53082)
- Discord/gateway: hand reconnect ownership back to Carbon, keep runtime status aligned with close/reconnect state, and force-stop sockets that open without reaching READY so Discord monitors recover promptly instead of waiting on stale health timeouts. (#59019) Thanks @obviyus
- Config/Telegram: migrate removed `channels.telegram.groupMentionsOnly` into `channels.telegram.groups["*"].requireMention` on load so legacy configs no longer crash at startup. (#55336) thanks @jameslcowan.

---

### 📦 v2026.4.2 (2026-04-02)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.4.2)

> [!NOTE]
> **DeXMart-relevant keywords:** `whatsapp`, `telegram`

#### ⚠️ Breaking Changes

- Plugins/xAI: move `x_search` settings from the legacy core `tools.web.x_search.*` path to the plugin-owned `plugins.entries.xai.config.xSearch.*` path, standardize `x_search` auth on `plugins.entries.xai.config.webSearch.apiKey` / `XAI_API_KEY`, and migrate legacy config with `openclaw doctor --fix`. (#59674) Thanks @vincentkoc.
- Plugins/web fetch: move Firecrawl `web_fetch` config from the legacy core `tools.web.fetch.firecrawl.*` path to the plugin-owned `plugins.entries.firecrawl.config.webFetch.*` path, route `web_fetch` fallback through the new fetch-provider boundary instead of a Firecrawl-only core branch, and migrate legacy config with `openclaw doctor --fix`. (#59465) Thanks @vincentkoc.

#### Changes (Features)

- Tasks/Task Flow: restore the core Task Flow substrate with managed-vs-mirrored sync modes, durable flow state/revision tracking, and `openclaw flows` inspection/recovery primitives so background orchestration can persist and be operated separately from plugin authoring layers. (#58930) Thanks @mbelinky.
- Tasks/Task Flow: add managed child task spawning plus sticky cancel intent, so external orchestrators can stop scheduling immediately and let parent Task Flows settle to `cancelled` once active child tasks finish. (#59610) Thanks @mbelinky.
- Plugins/Task Flow: add a bound `api.runtime.taskFlow` seam so plugins and trusted authoring layers can create and drive managed Task Flows from host-resolved OpenClaw context without passing owner identifiers on each call. (#59622) Thanks @mbelinky.
- Android/assistant: add assistant-role entrypoints plus Google Assistant App Actions metadata so Android can launch OpenClaw from the assistant trigger and hand prompts into the chat composer. (#59596) Thanks @obviyus.
- Exec defaults: make gateway/node host exec default to YOLO mode by requesting `security=full` with `ask=off`, and align host approval-file fallbacks plus docs/doctor reporting with that no-prompt default.
- Providers/runtime: add provider-owned replay hook surfaces for transcript policy, replay cleanup, and reasoning-mode dispatch. (#59143) Thanks @jalehman.
- Plugins/hooks: add `before_agent_reply` so plugins can short-circuit the LLM with synthetic replies after inline actions. (#20067) Thanks @JoshuaLelon.
- Channels/session routing: move provider-specific session conversation grammar into plugin-owned session-key surfaces, preserving Telegram topic routing and Feishu scoped inheritance across bootstrap, model override, restart, and tool-policy paths.
- Feishu/comments: add a dedicated Drive comment-event flow with comment-thread context resolution, in-thread replies, and `feishu_drive` comment actions for document collaboration workflows. (#58497) Thanks @wittam-01.
- Matrix/plugin: emit spec-compliant `m.mentions` metadata across text sends, media captions, edits, poll fallback text, and action-driven edits so Matrix mentions notify reliably in clients like Element. (#59323) Thanks @gumadeiras.
- Diffs: add plugin-owned `viewerBaseUrl` so viewer links can use a stable proxy/public origin without passing `baseUrl` on every tool call. (#59341) Related #59227. Thanks @gumadeiras.
- Agents/compaction: resolve `agents.defaults.compaction.model` consistently for manual `/compact` and other context-engine compaction paths, so engine-owned compaction uses the configured override model across runtime entrypoints. (#56710) Thanks @oliviareid-svg.
- Agents/compaction: add `agents.defaults.compaction.notifyUser` so the `🧹 Compacting context...` start notice is opt-in instead of always being shown. (#54251) Thanks @oguricap0327.
- WhatsApp/reactions: add `reactionLevel` guidance for agent reactions. Thanks @mcaxtr.
- Exec approvals/channels: auto-enable DM-first native chat approvals when supported channels can infer approvers from existing owner config, while keeping channel fanout explicit and clarifying forwarding versus native approval client config.

#### Fixes

- Providers/transport policy: centralize request auth, proxy, TLS, and header shaping across shared HTTP, stream, and websocket paths, block insecure TLS/runtime transport overrides, and keep proxy-hop TLS separate from target mTLS settings. (#59682) Thanks @vincentkoc.
- Providers/Copilot: classify native GitHub Copilot API hosts in the shared provider endpoint resolver and harden token-derived proxy endpoint parsing so Copilot base URL routing stays centralized and fails closed on malformed hints. (#59644) Thanks @vincentkoc.
- Providers/streaming headers: centralize default and attribution header merging across OpenAI websocket, embedded-runner, and proxy stream paths so provider-specific headers stay consistent and caller overrides only win where intended. (#59542) Thanks @vincentkoc.
- Providers/media HTTP: centralize base URL normalization, default auth/header injection, and explicit header override handling across shared OpenAI-compatible audio, Deepgram audio, Gemini media/image, and Moonshot video request paths. (#59469) Thanks @vincentkoc.
- Providers/OpenAI-compatible routing: centralize native-vs-proxy request policy so hidden attribution and related OpenAI-family defaults only apply on verified native endpoints across stream, websocket, and shared audio HTTP paths. (#59433) Thanks @vincentkoc.
- Providers/Anthropic routing: centralize native-vs-proxy endpoint classification for direct Anthropic `service_tier` handling so spoofed or proxied hosts do not inherit native Anthropic defaults. (#59608) Thanks @vincentkoc.
- Gateway/exec loopback: restore legacy-role fallback for empty paired-device token maps and allow silent local role upgrades so local exec and node clients stop failing with pairing-required errors after `2026.3.31`. (#59092) Thanks @openperf.
- Agents/subagents: pin admin-only subagent gateway calls to `operator.admin` while keeping `agent` at least privilege, so `sessions_spawn` no longer dies on loopback scope-upgrade pairing with `close(1008) "pairing required"`. (#59555) Thanks @openperf.
- Exec approvals/config: strip invalid `security`, `ask`, and `askFallback` values from `~/.openclaw/exec-approvals.json` during normalization so malformed policy enums fall back cleanly to the documented defaults instead of corrupting runtime policy resolution. (#59112) Thanks @openperf.
- Exec approvals/doctor: report host policy sources from the real approvals file path and ignore malformed host override values when attributing effective policy conflicts. (#59367) Thanks @gumadeiras.
- Exec/runtime: treat `tools.exec.host=auto` as routing-only, keep implicit no-config exec on sandbox when available or gateway otherwise, and reject per-call host overrides that would bypass the configured sandbox or host target. (#58897) Thanks @vincentkoc.
- Slack/mrkdwn formatting: add built-in Slack mrkdwn guidance in inbound context so Slack replies stop falling back to generic Markdown patterns that render poorly in Slack. (#59100) Thanks @jadewon.
- WhatsApp/presence: send `unavailable` presence on connect in self-chat mode so personal-phone users stop losing all push notifications while the gateway is running. (#59410) Thanks @mcaxtr.
- WhatsApp/media: add HTML, XML, and CSS to the MIME map and fall back gracefully for unknown media types instead of dropping the attachment. (#51562) Thanks @bobbyt74.
- Matrix/onboarding: restore guided setup in `openclaw channels add` and `openclaw configure --section channels`, while keeping custom plugin wizards on the shared `setupWizard` seam. (#59462) Thanks @gumadeiras.
- Matrix/streaming: keep live partial previews for the current assistant block while preserving completed block updates as separate messages when `channels.matrix.blockStreaming` is enabled. (#59384) Thanks @gumadeiras.
- Feishu/comment threads: harden document comment-thread delivery so whole-document comments fall back to `add_comment`, delayed reply lookups retry more reliably, and user-visible replies avoid reasoning/planning spillover. (#59129) Thanks @wittam-01.
- MS Teams/streaming: strip already-streamed text from fallback block delivery when replies exceed the 4000-character streaming limit so long responses stop duplicating content. (#59297) Thanks @bradgroux.
- Slack/thread context: filter thread starter and history by the effective conversation allowlist without dropping valid open-room, DM, or group DM context. (#58380) Thanks @jacobtomlinson.
- Mattermost/probes: route status probes through the SSRF guard and honor `allowPrivateNetwork` so connectivity checks stay safe for self-hosted Mattermost deployments. (#58529) Thanks @mappel-nv.
- Zalo/webhook replay: scope replay dedupe key by chat and sender so reused message IDs across different chats or senders no longer collide, and harden metadata reads for partially missing payloads. (#58444)
- QQBot/structured payloads: restrict local file paths to QQ Bot-owned media storage, block traversal outside that root, reduce path leakage in logs, and keep inline image data URLs working. (#58453) Thanks @jacobtomlinson.
- Image generation/providers: route OpenAI, MiniMax, and fal image requests through the shared provider HTTP transport path so custom base URLs, guarded private-network routing, and provider request defaults stay aligned with the rest of provider HTTP. Thanks @vincentkoc.
- Image generation/providers: stop inferring private-network access from configured OpenAI, MiniMax, and fal image base URLs, and cap shared HTTP error-body reads so hostile or misconfigured endpoints fail closed without relaxing SSRF policy or buffering unbounded error payloads. Thanks @vincentkoc.
- Browser/host inspection: keep static Chrome inspection helpers out of the activated browser runtime so `openclaw doctor browser` and related checks do not eagerly load the bundled browser plugin. (#59471) Thanks @vincentkoc.
- Browser/CDP: normalize trailing-dot localhost absolute-form hosts before loopback checks so remote CDP websocket URLs like `ws://localhost.:...` rewrite back to the configured remote host. (#59236) Thanks @mappel-nv.
- Agents/output sanitization: strip namespaced `antml:thinking` blocks from user-visible text so Anthropic-style internal monologue tags do not leak into replies. (#59550) Thanks @obviyus.
- Kimi Coding/tools: normalize Anthropic tool payloads into the OpenAI-compatible function shape Kimi Coding expects so tool calls stop losing required arguments. (#59440) Thanks @obviyus.
- Image tool/paths: resolve relative local media paths against the agent `workspaceDir` instead of `process.cwd()` so inputs like `inbox/receipt.png` pass the local-path allowlist reliably. (#57222) Thanks Priyansh Gupta.
- Podman/launch: remove noisy container output from `scripts/run-openclaw-podman.sh` and align the Podman install guidance with the quieter startup flow. (#59368) Thanks @sallyom.
- Plugins/runtime: keep LINE reply directives and browser-backed cleanup/reset flows working even when those plugins are disabled while tightening bundled plugin activation guards. (#59412) Thanks @vincentkoc.
- ACP/gateway reconnects: keep ACP prompts alive across transient websocket drops while still failing boundedly when reconnect recovery does not complete. (#59473) Thanks @obviyus.
- ACP/gateway reconnects: reject stale pre-ack ACP prompts after reconnect grace expiry so callers fail cleanly instead of hanging indefinitely when the gateway never confirms the run.
- Gateway/session kill: enforce HTTP operator scopes on session kill requests and gate authorization before session lookup so unauthenticated callers cannot probe session existence. (#59128) Thanks @jacobtomlinson.
- MS Teams/logging: format non-`Error` failures with the shared unknown-error helper so logs stop collapsing caught SDK or Axios objects into `[object Object]`. (#59321) Thanks @bradgroux.
- Channels/setup: ignore untrusted workspace channel plugins during setup resolution so a shadowing workspace plugin cannot override built-in channel setup/login flows unless explicitly trusted in config. (#59158) Thanks @mappel-nv.
- Exec/Windows: restore allowlist enforcement with quote-aware `argPattern` matching across gateway and node exec, and surface accurate dynamic pre-approved executable hints in the exec tool description. (#56285) Thanks @kpngr.
- Gateway: prune empty `node-pending-work` state entries after explicit acknowledgments and natural expiry so the per-node state map no longer grows indefinitely. (#58179) Thanks @gavyngong.
- Webhooks/secret comparison: replace ad-hoc timing-safe secret comparisons across BlueBubbles, Feishu, Mattermost, Telegram, Twilio, and Zalo webhook handlers with the shared `safeEqualSecret` helper and reject empty auth tokens in BlueBubbles. (#58432) Thanks @eleqtrizit.
- OpenShell/mirror: constrain `remoteWorkspaceDir` and `remoteAgentWorkspaceDir` to the managed `/sandbox` and `/agent` roots, and keep mirror sync from overwriting or removing user-added shell roots during config synchronization. (#58515) Thanks @eleqtrizit.
- Plugins/activation: preserve explicit, auto-enabled, and default activation provenance plus reason metadata across CLI, gateway bootstrap, and status surfaces so plugin enablement state stays accurate after auto-enable resolution. (#59641) Thanks @vincentkoc.
- Exec/env: block additional host environment override pivots for package roots, language runtimes, compiler include paths, and credential/config locations so request-scoped exec cannot redirect trusted toolchains or config lookups. (#59233) Thanks @drobison00.
- Dotenv/workspace overrides: block workspace `.env` files from overriding `OPENCLAW_PINNED_PYTHON` and `OPENCLAW_PINNED_WRITE_PYTHON` so trusted helper interpreters cannot be redirected by repo-local env injection. (#58473) Thanks @eleqtrizit.
- Plugins/install: accept JSON5 syntax in `openclaw.plugin.json` and bundle `plugin.json` manifests during install/validation, so third-party plugins with trailing commas, comments, or unquoted keys no longer fail to install. (#59084) Thanks @singleGanghood.
- Telegram/exec approvals: rewrite shared `/approve … allow-always` callback payloads to `/approve … always` before Telegram button rendering so plugin approval IDs still fit Telegram's `callback_data` limit and keep the Allow Always action visible. (#59217) Thanks @jameslcowan.
- Cron/exec timeouts: surface timed-out `exec` and `bash` failures in isolated cron runs even when `verbose: off`, including custom session-target cron jobs, so scheduled runs stop failing silently. (#58247) Thanks @skainguyen1412.
- Telegram/exec approvals: fall back to the origin session key for async approval followups and keep resume-failure status delivery sanitized so Telegram followups still land without leaking raw exec metadata. (#59351) Thanks @seonang.
- Node-host/exec approvals: bind `pnpm dlx` invocations through the approval planner's mutable-script path so the effective runtime command is resolved for approval instead of being left unbound. (#58374)
- Exec/node hosts: stop forwarding the gateway workspace cwd to remote node exec when no workdir was explicitly requested, so cross-platform node approvals fall back to the node default cwd instead of failing with `SYSTEM_RUN_DENIED`. (#58977) Thanks @Starhappysh.
- Exec approvals/channels: decouple initiating-surface approval availability from native delivery enablement so Telegram, Slack, and Discord still expose approvals when approvers exist and native target routing is configured separately. (#59776) Thanks @joelnishanth.

---

### 📦 v2026.4.5 (2026-04-06)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.4.5)

> [!NOTE]
> **DeXMart-relevant keywords:** `whatsapp`, `telegram`, `billing`

#### ⚠️ Breaking Changes

- Config: remove legacy public config aliases such as `talk.voiceId` / `talk.apiKey`, `agents.*.sandbox.perSession`, `browser.ssrfPolicy.allowPrivateNetwork`, `hooks.internal.handlers`, and channel/group/room `allow` toggles in favor of the canonical public paths and `enabled`, while keeping load-time compatibility and `openclaw doctor --fix` migration support for existing configs. (#60726) Thanks @vincentkoc.

#### Changes (Features)

- Agents/video generation: add the built-in `video_generate` tool so agents can create videos through configured providers and return the generated media directly in the reply.
- Agents/music generation: ignore unsupported optional hints such as `durationSeconds` with a warning instead of hard-failing requests on providers like Google Lyria.
- Providers/ComfyUI: add a bundled `comfy` workflow media plugin for local ComfyUI and Comfy Cloud workflows, including shared `image_generate`, `video_generate`, and workflow-backed `music_generate` support, with prompt injection, optional reference-image upload, live tests, and output download.
- Tools/music generation: add the built-in `music_generate` tool with bundled Google (Lyria) and MiniMax providers plus workflow-backed Comfy support, including async task tracking and follow-up delivery of finished audio.
- Providers: add bundled Qwen, Fireworks AI, and StepFun providers, plus MiniMax TTS, Ollama Web Search, and MiniMax Search integrations for chat, speech, and search workflows. (#60032, #55921, #59318, #54648)
- Providers/Amazon Bedrock: add bundled Mantle support plus inference-profile discovery and automatic request-region injection so Bedrock-hosted Claude, GPT-OSS, Qwen, Kimi, GLM, and similar routes work with less manual setup. (#61296, #61299) Thanks @wirjo.
- Control UI/multilingual: add localized control UI support for Simplified Chinese, Traditional Chinese, Brazilian Portuguese, German, Spanish, Japanese, Korean, French, Turkish, Indonesian, Polish, and Ukrainian. Thanks @vincentkoc.
- Plugins: add plugin-config TUI prompts to guided onboarding/setup flows, and add `openclaw plugins install --force` so existing plugin and hook-pack targets can be replaced without using the dangerous-code override flag. (#60590, #60544)
- Control UI/skills: add ClawHub search, detail, and install flows directly in the Skills panel. (#60134) Thanks @samzong.
- iOS/exec approvals: add generic APNs approval notifications that open an in-app exec approval modal, fetch command details only after authenticated operator reconnect, and clear stale notification state when the approval resolves. (#60239) Thanks @ngutman.
- Matrix/exec approvals: add Matrix-native exec approval prompts with account-scoped approvers, channel-or-DM delivery, and room-thread aware resolution handling. (#58635) Thanks @gumadeiras.
- Channels/context visibility: add configurable `contextVisibility` per channel (`all`, `allowlist`, `allowlist_quote`) so supplemental quote, thread, and fetched history context can be filtered by sender allowlists instead of always passing through as received.
- Providers/request overrides: add shared model and media request transport overrides across OpenAI-, Anthropic-, Google-, and compatible provider paths, including headers, auth, proxy, and TLS controls. (#60200)
- Providers/OpenAI: add forward-compat `openai-codex/gpt-5.4-mini`, an opt-in GPT personality, and provider-owned GPT-5 prompt contributions so Codex/GPT runs stay cache-stable and compatible with bundled catalog lag.
- Agents/Claude CLI: expose OpenClaw tools to background Claude CLI runs through a loopback MCP bridge and switch bundled runs to stdin + `stream-json` partial-message streaming so prompts stop riding argv, long replies show live progress, and final session/usage metadata still land cleanly. (#35676) Thanks @mylukin.
- ACPX/runtime: embed the ACP runtime directly in the bundled `acpx` plugin, remove the extra external ACP CLI hop, harden live ACP session binding and reuse, and add a generic `reply_dispatch` hook so bundled plugins like ACPX can own reply interception without hardcoded ACP paths in core auto-reply routing. (#61319)
- Agents/progress: add experimental structured plan updates and structured execution item events so compatible UIs can show clearer step-by-step progress during long-running runs.
- Providers/Anthropic: remove the Claude CLI backend and setup-token from new onboarding, keep existing configured legacy profiles runnable, and have `openclaw doctor` repair or remove stale `anthropic:claude-cli` state during migration.
- Tools/video generation: add bundled xAI (`grok-imagine-video`), Alibaba Model Studio Wan, and Runway video providers, plus live-test/default model wiring for all three.
- Memory/search: add Amazon Bedrock embeddings for Titan, Cohere, Nova, and TwelveLabs models, with AWS credential-chain auto-detection for `provider: "auto"` and provider-specific dimension controls. Thanks @wirjo.
- Providers/Amazon Bedrock Mantle: generate bearer tokens from the AWS credential chain so Mantle auto-discovery can use IAM auth without manually exporting `AWS_BEARER_TOKEN_BEDROCK`. Thanks @wirjo.
- Memory/dreaming (experimental): add weighted short-term recall promotion, a `/dreaming` command, Dreams UI, multilingual conceptual tagging, and doctor/status repair support, while refactoring dreaming from competing modes into three cooperative phases (light, deep, REM) with independent schedules and recovery behavior so durable memory promotion can run in the background with less manual setup. (#60569, #60697) Thanks @vignesh07.
- Memory/dreaming: add configurable aging controls (`recencyHalfLifeDays`, `maxAgeDays`) plus optional verbose logging so operators can tune recall decay and inspect promotion decisions more easily.
- Memory/dreaming: add REM preview tooling (`openclaw memory rem-harness`, `promote-explain`), surface possible lasting truths during REM staging, and make deep promotion replay-safe so reruns reconcile instead of duplicating `MEMORY.md` entries.
- Memory/dreaming: write dreaming trail content to top-level `dreams.md` instead of daily memory notes, update `/dreaming` help text to point there, and keep `dreams.md` available for explicit reads without pulling it into default recall. Thanks @davemorin.
- Memory/dreaming: add the Dream Diary surface in Dreams, simplify user-facing dreaming config to `enabled` plus optional `frequency`, treat phases as implementation detail in docs/UI, and keep the lobster animation visible above diary content. Thanks @vignesh07.
- Prompt caching: keep prompt prefixes more reusable across transport fallback, deterministic MCP tool ordering, compaction, embedded image history, normalized system-prompt fingerprints, `openclaw status --verbose` cache diagnostics, and the removal of duplicate in-band tool inventories from agent system prompts so follow-up turns hit cache more reliably. (#58036, #58037, #58038, #59054, #60603, #60691) Thanks @bcherny and @vincentkoc.
- Agents/cache: diagnostics: add prompt-cache break diagnostics, trace live cache scenarios through embedded runner paths, and show cache reuse explicitly in `openclaw status --verbose`. Thanks @vincentkoc.
- Agents/cache: stabilize cache-relevant system prompt fingerprints by normalizing equivalent structured prompt whitespace, line endings, hook-added system context, and runtime capability ordering so semantically unchanged prompts reuse KV/cache more reliably. Thanks @vincentkoc.
- Agents/tool prompts: remove the duplicate in-band tool inventory from agent system prompts so tool-calling models rely on the structured tool definitions as the single source of truth, improving prompt stability and reducing stale tool guidance.
- Config/schema: enrich the exported `openclaw config schema` JSON Schema with field titles and descriptions so editors, agents, and other schema consumers receive the same config help metadata. (#60067) Thanks @solavrc.
- Providers/CLI: remove bundled CLI text-provider backends and the `agents.defaults.cliBackends` surface, while keeping ACP harness sessions and Gemini media understanding on the native bundled providers.
- Matrix/exec approvals: clarify unavailable-approval replies so Matrix no longer claims chat approvals are unsupported when native exec approvals are merely unconfigured. (#61424) Thanks @gumadeiras.
- Docs/IRC: replace public IRC hostname examples with `irc.example.com` and recommend private servers for bot coordination while listing common public networks for intentional use.
- Memory/dreaming: group nearby daily-note lines into short coherent chunks before staging them for dreaming, so one-off context from recent notes reaches REM/deep with better evidence and less line-level noise.
- Memory/dreaming: drop generic date/day headings from daily-note chunk prefixes while keeping meaningful section labels, so staged snippets stay cleaner and more reusable. (#61597) Thanks @mbelinky.
- Plugins/Lobster: run bundled Lobster workflows in process instead of spawning the external CLI, reducing transport overhead and unblocking native runtime integration. (#61523) Thanks @mbelinky.
- Plugins/Lobster: harden managed resume validation so invalid TaskFlow resume calls fail earlier, and memoize embedded runtime loading per runner while keeping failed loads retryable. (#61566) Thanks @mbelinky.

#### Fixes

- Security: preserve restrictive plugin-only tool allowlists, require owner access for `/allowlist add` and `/allowlist remove`, fail closed when `before_tool_call` hooks crash, block browser SSRF redirect bypasses earlier, and keep non-interactive auth-choice inference scoped to bundled and already-trusted plugins. (#58476, #59836, #59822, #58771, #59120) Thanks @eleqtrizit and @pgondhi987.
- Providers/OpenAI: make GPT-5 and Codex runs act sooner with lower-verbosity defaults, visible progress during tool work, and a one-shot retry when a turn only narrates the plan instead of taking action.
- Providers/OpenAI and reply delivery: preserve native `reasoning.effort: "none"` and strict schemas where supported, add GPT-5.4 assistant `phase` metadata across replay and the Gateway `/v1/responses` layer, and keep commentary buffered until `final_answer` so web chat, session previews, embedded replies, and Telegram partials stop leaking planning text. Fixes #59150, #59643, #61282.
- Telegram: fix current-model checks in the model picker, HTML-format non-default `/model` confirmations, explicit topic replies, persisted reaction ownership across restarts, caption-media placeholder and `file_id` preservation on download failure, and upgraded-install inbound image reads. (#60384, #60042, #59634, #59207, #59948, #59971) Thanks @sfuminya, @GitZhangChi, @dashhuang, @samzong, @v1p0r, and @neeravmakwana.
- Telegram: restore DM voice-note preflight transcription so direct-message audio stops arriving as raw `<media:audio>` placeholders. (#61008) Thanks @manueltarouca.
- Telegram/reasoning: only create a Telegram reasoning preview lane when the session is explicitly `reasoning:stream`, so hidden `<think>` traces from streamed replies stop surfacing as chat previews on normal sessions. Thanks @vincentkoc.
- Telegram/native command menu: trim long menu descriptions before dropping commands so sub-100 command sets can still fit Telegram's payload budget and keep more `/` entries visible. (#61129) Thanks @neeravmakwana.
- Discord: keep REST, webhook, and monitor traffic on the configured proxy, preserve component-only media sends, honor `@everyone` and `@here` mention gates, keep ACK reactions on the active account, and split voice connect/playback timeouts so auto-join is more reliable. (#57465, #60361, #60345) Thanks @geekhuashan.
- Discord/reply tags: strip leaked `[[reply_to_current]]` control tags from preview text and honor explicit reply-tag threading during final delivery, so Discord replies stay attached to the triggering message instead of printing reply metadata into chat.
- Discord/replies: replace the unshipped `replyToOnlyWhenBatched` flag with `replyToMode: "batched"` so native reply references only attach on debounced multi-message turns while explicit reply tags still work.
- Discord/image generation: include the real generated `MEDIA:` paths in tool output, avoid duplicate plain-output media requeueing, and persist volatile workspace-generated media into durable outbound media before final reply delivery so generated image replies stop pointing at missing local files.
- Slack: route live DM replies back to the concrete inbound DM channel while keeping persisted routing metadata user-scoped, so normal assistant replies stop disappearing when pairing and system messages still arrive. (#59030) Thanks @afurm.
- WhatsApp: restore `channels.whatsapp.blockStreaming` and reset watchdog timeouts after reconnect so quiet chats stop falling into reconnect loops. (#60007, #60069) Thanks @MonkeyLeeT and @mcaxtr.
- Android/Talk Mode: cancel in-flight `talk.speak` playback when speech is explicitly stopped, and restore spoken replies on both node-scoped and gateway-backed sessions by keeping reply routing and embedded transport overrides aligned with the current playback path. (#60306, #61164, #61214)
- Voice-call/OpenAI: pass full plugin config into realtime transcription provider resolution so streaming calls can discover the bundled OpenAI realtime transcription provider again. Fixes #60936. Thanks @sliekens and @vincentkoc.
- Matrix/exec approvals: anchor seeded approval reactions to the primary Matrix prompt event, resolve them from event metadata instead of prompt text, and clean up chunked approval prompts correctly. (#60931) Thanks @gumadeiras.
- Matrix: recover more reliably when secret storage or recovery keys are missing by recreating secret storage during repair and backup reset, hold crypto snapshot locks during persistence, and surface explicit too-large attachment markers. (#59846, #59851, #60599, #60289) Thanks @al3mart, @emonty, and @efe-arv.
- Matrix/DM sessions: add `channels.matrix.dm.sessionScope`, shared-session collision notices, and aligned outbound session reuse so separate Matrix DM rooms can keep distinct context when configured. (#61373) Thanks @gumadeiras.
- Matrix: move legacy top-level `avatarUrl` into the default account during multi-account promotion and keep env-backed account setup avatar config persisted. (#61437) Thanks @gumadeiras.
- MS Teams: download inline DM images via Graph API and preserve channel reply threading in proactive fallback. (#52212, #55198) Thanks @Ted-developer and @hyojin.
- MS Teams: replace the deprecated Teams SDK HttpPlugin stub with `httpServerAdapter` so recurring gateway deprecation warnings stop firing and the Express 5 compatibility workaround stays on the supported SDK path. (#60939) Thanks @coolramukaka-sys.
- Control UI/chat: add a per-session thinking-level picker in the chat header and mobile chat settings, and keep the browser bundle on UI-local thinking/session-key helpers so Safari no longer crashes on Node-only imports before rendering chat controls.
- Sandbox/SSH: reject hardlinked files during cross-device rename fallback so EXDEV file copies preserve the same pinned file-boundary checks as direct reads.
- Control UI: keep Stop visible during tool-only execution, preserve pending-send busy state, and clear stale ClawHub search results as soon as the query changes. (#54528, #59800, #60267) Thanks @chziyue and @frankekn.
- Control UI/avatar: honor `ui.assistant.avatar` when serving `/avatar/:agentId` so Appearance UI avatar paths stop falling back to initials placeholders. (#60778) Thanks @hannasdev.
- Control UI/cron: highlight the Cron refresh button while refresh is in flight so the page's loading state stays visible even when prior data remains on screen. (#60394) Thanks @coder-zhuzm.
- Control UI/Overview: prevent gateway access token/password visibility toggle buttons from overlapping their inputs at narrow widths. (#56924) Thanks @bbddbb1.
- Auto-reply: unify reply lifecycle ownership across preflight compaction, session rotation, CLI-backed runs, and gateway restart handling so `/stop` and same-session overlap checks target the right active turn and restart-interrupted turns return the restart notice instead of being silently dropped. (#61267) Thanks @dutifulbob.
- Reply delivery: prevent duplicate block replies on `text_end` channels so providers that emit explicit text-end boundaries no longer double-send the same final message. (#61530)
- Gateway/startup: default `gateway.mode` to `local` when unset, detect PID recycling in gateway lock files on Windows and macOS, and show startup progress so healthy restarts stop getting blocked by stale locks. (#54801, #60085, #59843) Thanks @BradGroux and @TonyDerek-dot.
- Gateway/macOS: let launchd `KeepAlive` own in-process gateway restarts again, adding a short supervised-exit delay so rapid restarts avoid launchd crash-loop unloads while `openclaw gateway restart` still reports real LaunchAgent errors synchronously.
- Gateway/macOS: re-bootstrap the LaunchAgent if `launchctl kickstart -k` unloads it during restart so failed restarts do not leave the gateway unmanaged until manual repair.
- Gateway/macOS: recover installed-but-unloaded LaunchAgents during `openclaw gateway start` and `restart`, while still preferring live unmanaged gateways during restart recovery. (#43766) Thanks @HenryC-3.
- Gateway/Windows scheduled tasks: preserve Task Scheduler settings on reinstall, fail loudly when `/Run` does not start, and report fast failed restarts accurately instead of pretending they timed out after 60 seconds. (#59335) Thanks @tmimmanuel.
- Windows/restart: fall back to the installed Startup-entry launcher when the scheduled task was never registered, so `/restart` can relaunch the gateway on Windows setups where `schtasks` install fell back during onboarding. (#58943) Thanks @imechZhangLY.
- Windows/restart: clean up stale gateway listeners before Windows self-restart and treat listener and argv probe failures as inconclusive, so scheduled-task relaunch no longer falls into an `EADDRINUSE` retry loop. (#60480) Thanks @arifahmedjoy.
- Update/npm: prefer the npm binary that owns the installed global OpenClaw prefix so mixed Homebrew-plus-nvm setups update the right install. (#60153) Thanks @jayeshp19.
- Agents/music and video generation: add `tools.media.asyncCompletion.directSend` as an opt-in direct-delivery path for finished async media tasks, while keeping the legacy requester-session wake/model-delivery flow as the default.
- CLI/skills JSON: route `skills list --json`, `skills info --json`, and `skills check --json` output to stdout instead of stderr so machine-readable consumers receive JSON on the expected stream again. (#60914; fixes #57599; landed from contributor PR #57611 by @Aftabbs) Thanks @Aftabbs.
- CLI/Commander: preserve Commander-computed exit codes for argument and help-error paths, and cover the user-argv parse mode in the regression tests so invalid CLI invocations no longer report success when exits are intercepted. (#60923) Thanks @Linux2010.
- Cron: replay interrupted recurring jobs on the first gateway restart instead of waiting for a second restart. (#60583) Thanks @joelnishanth.
- Cron: send failure notifications through the job's primary delivery channel using the same session context as successful delivery when no explicit `failureDestination` is configured. (#60622) Thanks @artwalker.
- Exec/remote skills: stop advertising `exec host=node` when the current exec policy cannot route to a node, and clarify blocked exec-host override errors with both the requested host and allowed config path.
- Agents/Claude CLI/security: clear inherited Claude Code config-root and plugin-root env overrides like `CLAUDE_CONFIG_DIR` and `CLAUDE_CODE_PLUGIN_*`, so OpenClaw-launched Claude CLI runs cannot be silently pointed at an alternate Claude config/plugin tree with different hooks, plugins, or auth context. Thanks @vincentkoc.
- Agents/Claude CLI/security: clear inherited Claude Code provider-routing and managed-auth env overrides, and mark OpenClaw-launched Claude CLI runs as host-managed, so Claude CLI backdoor sessions cannot be silently redirected to proxy, Bedrock, Vertex, Foundry, or parent-managed token contexts. Thanks @vincentkoc.
- Agents/Claude CLI/security: force host-managed Claude CLI backdoor runs to `--setting-sources user`, even under custom backend arg overrides, so repo-local `.claude` project/local settings, hooks, and plugin discovery do not silently execute inside non-interactive OpenClaw sessions. Thanks @vincentkoc.
- Agents/Claude CLI: treat malformed bare `--permission-mode` backend overrides as missing and fail safe back to `bypassPermissions`, so custom `cliBackends.claude-cli.args` security config cannot accidentally consume the next flag as a bogus permission mode. Thanks @vincentkoc.
- Gateway/device pairing: require non-admin paired-device sessions to manage only their own device for token rotate/revoke and paired-device removal, blocking cross-device token theft inside pairing-scoped sessions. (#50627) Thanks @coygeek.
- Gateway/plugin routes: keep gateway-auth plugin runtime routes on write-only fallback scopes unless a trusted-proxy caller explicitly declares narrower `x-openclaw-scopes`, so plugin HTTP handlers no longer mint admin-level runtime scopes on missing or untrusted HTTP scope headers. (#59815) Thanks @pgondhi987.
- Build/types: fix the Node `createRequire(...)` helper typing so provider-runtime lazy loads compile cleanly again and `pnpm build` no longer fails in the Pi embedded provider error-pattern path.
- Gateway/security: scope loopback browser-origin auth throttling by normalized origin so one localhost Control UI tab cannot lock out a different localhost browser origin after repeated auth failures.
- Gateway/auth: serialize async shared-secret auth attempts per client so concurrent Tailscale-capable failures cannot overrun the intended auth rate-limit budget. Thanks @Telecaster2147.
- Device pairing/security: keep non-operator device scope checks bound to the requested role prefix so bootstrap verification cannot redeem `operator.*` scopes through `node` auth. (#57258) Thanks @jlapenna.
- Device pairing: reject rotating device tokens into roles that were never approved during pairing, and keep reconnect role checks bounded to the paired device's approved role set. (#60462) Thanks @eleqtrizit.
- Gateway/device auth: reuse cached device-token scopes only for cached-token reconnects, while keeping explicit `deviceToken` scope requests and empty-cache fallbacks intact so reconnects preserve `operator.read` without breaking explicit auth flows. (#46032) Thanks @caicongyang.
- Mobile pairing/security: fail closed for internal `/pair` setup-code issuance, cleanup, and approval paths when gateway pairing scopes are missing, and keep approval-time requested-scope enforcement on the internal command path. (#55996) Thanks @coygeek.
- Mobile pairing/bootstrap: keep QR bootstrap handoff tokens bounded to the mobile-safe contract so node handoff stays unscoped and operator handoff drops mixed `node.*`, `operator.admin`, and `operator.pairing` scopes.
- Mobile pairing/Android: tighten secure endpoint handling so Tailscale and public remote setup reject cleartext endpoints, private LAN pairing still works, merged-role approvals mint both node and operator device tokens, and bootstrap tokens survive node auto-pair until operator approval finishes. (#60128, #60208, #60221) Thanks @obviyus.
- Android/canvas security: require exact normalized A2UI URL matches before forwarding canvas bridge actions, rejecting query mismatches and descendant paths while still allowing fragment-only A2UI navigation.
- Synology Chat/security: default low-level HTTPS helper TLS verification to on so helper/API defaults match the shipped safe account default, and only explicit `allowInsecureSsl: true` opts out.
- Synology Chat/security: route webhook token comparison through the shared constant-time secret helper for consistency with other bundled plugins.
- Plugins/marketplace: block remote marketplace symlink escapes without breaking ordinary local marketplace install paths. (#60556) Thanks @eleqtrizit.
- Telegram/local Bot API: honor `channels.telegram.apiRoot` for buffered media downloads, add `channels.telegram.network.dangerouslyAllowPrivateNetwork` for trusted fake-IP setups, and require `channels.telegram.trustedLocalFileRoots` before reading absolute Bot API `file_path` values. (#59544, #60705) Thanks @SARAMALI15792 and @obviyus.
- Outbound/sanitizer: strip leaked `<tool_call>`, `<function_calls>`, and model special tokens from shared user-visible assistant text, including truncated tool-call streams, so internal scaffolding no longer bleeds into replies across surfaces. (#60619) Thanks @oliviareid-svg.
- Agents/errors: surface an explicit disk-full message when local session or transcript writes fail with `ENOSPC`/`disk full`, so those runs stop degrading into opaque `NO_REPLY`-style failures. Thanks @vincentkoc.
- Exec approvals: remove heuristic command-obfuscation gating from host exec so gateway and node runs rely on explicit policy, allowlist, and strict inline-eval rules only.
- Agents/tool results: cap live tool-result persistence and overflow-recovery truncation at 40k characters so oversized tool output stays bounded without discarding recent context entirely.
- Discord/video replies: split text-plus-video deliveries into a text reply followed by a media-only send, and let live provider auth checks honor manifest-declared API key env vars like `MODELSTUDIO_API_KEY`.
- Config/All Settings: keep the raw config view intact when sensitive fields are blank instead of corrupting or dropping the rendered snapshot. (#28214) Thanks @solodmd.
- Plugin SDK/facades: back-fill bundled plugin facade sentinels before plugin-id tracking re-enters config loading, so CLI/provider startup no longer crashes with `shouldNormalizeGoogleProviderConfig is not a function` or other empty-facade reads during bundled plugin re-entry. Thanks @adam91holt.
- Plugins/facades: back-fill facade sentinels before tracked-plugin resolution re-enters config loading, so facade exports stay defined during circular provider normalization. (#61180) Thanks @adam91holt.
- QA lab: restore typed mock OpenAI gateway config wiring so QA-lab config helpers compile cleanly again and `pnpm check` / `pnpm build` stay green.
- Discord/image generation: include the real generated `MEDIA:` paths in tool output and avoid duplicate plain-output media requeueing so Discord image replies stop pointing at missing local files.
- Slack: route live DM replies back to the concrete inbound DM channel while keeping persisted routing metadata user-scoped, so normal assistant replies stop disappearing when pairing and system messages still arrive. (#59030) Thanks @afurm.
- Discord/reply tags: strip leaked `[[reply_to_current]]` control tags from preview text and honor explicit reply-tag threading during final delivery, so Discord replies stay attached to the triggering message instead of printing reply metadata into chat.
- Telegram: fix current-model checks in the model picker, HTML-format non-default `/model` confirmations, explicit topic replies, persisted reaction ownership across restarts, caption-media placeholder and `file_id` preservation on download failure, and upgraded-install inbound image reads. (#60384, #60042, #59634, #59207, #59948, #59971) Thanks @sfuminya, @GitZhangChi, @dashhuang, @samzong, @v1p0r, and @neeravmakwana.
- Telegram: restore DM voice-note preflight transcription so direct-message audio stops arriving as raw `<media:audio>` placeholders. (#61008) Thanks @manueltarouca.
- Telegram/reasoning: only create a Telegram reasoning preview lane when the session is explicitly `reasoning:stream`, so hidden `<think>` traces from streamed replies stop surfacing as chat previews on normal sessions. Thanks @vincentkoc.
- Telegram/native command menu: trim long menu descriptions before dropping commands so sub-100 command sets can still fit Telegram's payload budget and keep more `/` entries visible. (#61129) Thanks @neeravmakwana.
- Feishu/reasoning: only expose streamed reasoning previews when the session is explicitly `reasoning:stream`, so hidden reasoning traces do not surface on normal streaming sessions. Thanks @vincentkoc.
- Discord: keep REST, webhook, and monitor traffic on the configured proxy, preserve component-only media sends, honor `@everyone` and `@here` mention gates, keep ACK reactions on the active account, and split voice connect/playback timeouts so auto-join is more reliable. (#57465, #60361, #60345) Thanks @geekhuashan.
- WhatsApp: restore `channels.whatsapp.blockStreaming` and reset watchdog timeouts after reconnect so quiet chats stop falling into reconnect loops. (#60007, #60069) Thanks @MonkeyLeeT and @mcaxtr.
- Memory: keep `memory-core` builtin embedding registration on the already-registered path so selecting `memory-core` no longer recurses through plugin discovery and crashes during startup. (#61402) Thanks @ngutman.
- Agents/tool results: keep large `read` outputs visible longer, preserve the latest `read` output when older tool output can absorb the overflow budget, and fall back to Pi's normal overflow compaction/retry path before replacing a fresh `read` with a compacted stub. Thanks @vincentkoc.
- Memory/QMD: prefer modern `qmd collection add --glob`, accept newer single-line JSON hit metadata while keeping legacy line fields, refresh QMD docs/doctor install guidance and model-override guidance, and keep older QMD releases working. Thanks @vincentkoc.
- MS Teams: download inline DM images via Graph API and preserve channel reply threading in proactive fallback. (#52212, #55198) Thanks @Ted-developer and @hyojin.
- MS Teams: replace the deprecated Teams SDK HttpPlugin stub with `httpServerAdapter` so recurring gateway deprecation warnings stop firing and the Express 5 compatibility workaround stays on the supported SDK path. (#60939) Thanks @coolramukaka-sys.
- Matrix/exec approvals: anchor seeded approval reactions to the primary Matrix prompt event, resolve them from event metadata instead of prompt text, and clean up chunked approval prompts correctly. (#60931) Thanks @gumadeiras.
- Matrix: recover more reliably when secret storage or recovery keys are missing by recreating secret storage during repair and backup reset, hold crypto snapshot locks during persistence, and surface explicit too-large attachment markers. (#59846, #59851, #60599, #60289) Thanks @al3mart, @emonty, and @efe-arv.
- Android/Talk Mode: cancel in-flight `talk.speak` playback when speech is explicitly stopped, so stale replies stop starting after barge-in or manual stop. (#61164) Thanks @obviyus.
- Android/Talk Mode: restore spoken assistant replies on node-scoped sessions by keeping reply routing synced to the resolved node session key and pausing mic capture during reply playback. (#60306) Thanks @MKV21.
- Android/Talk Mode: restore voice replies on gateway-backed talk mode sessions by updating embedded runner transport overrides to the current agent transport API. (#61214) Thanks @obviyus.
- Voice-call/OpenAI: pass full plugin config into realtime transcription provider resolution so streaming calls can discover the bundled OpenAI realtime transcription provider again. Fixes #60936. Thanks @sliekens and @vincentkoc.
- Control UI/chat: add a per-session thinking-level picker in the chat header and mobile chat settings, and keep the browser bundle on UI-local thinking/session-key helpers so Safari no longer crashes on Node-only imports before rendering chat controls.
- Control UI: keep Stop visible during tool-only execution, preserve pending-send busy state, and clear stale ClawHub search results as soon as the query changes. (#54528, #59800, #60267) Thanks @chziyue and @frankekn.
- Control UI/avatar: honor `ui.assistant.avatar` when serving `/avatar/:agentId` so Appearance UI avatar paths stop falling back to initials placeholders. (#60778) Thanks @hannasdev.
- Control UI/cron: highlight the Cron refresh button while refresh is in flight so the page's loading state stays visible even when prior data remains on screen. (#60394) Thanks @coder-zhuzm.
- Control UI/Overview: prevent gateway access token/password visibility toggle buttons from overlapping their inputs at narrow widths. (#56924) Thanks @bbddbb1.
- CLI/skills JSON: route `skills list --json`, `skills info --json`, and `skills check --json` output to stdout instead of stderr so machine-readable consumers receive JSON on the expected stream again. (#60914; fixes #57599; landed from contributor PR #57611 by @Aftabbs) Thanks @Aftabbs.
- CLI/Commander: preserve Commander-computed exit codes for argument and help-error paths, and cover the user-argv parse mode in the regression tests so invalid CLI invocations no longer report success when exits are intercepted. (#60923) Thanks @Linux2010.
- Cron: replay interrupted recurring jobs on the first gateway restart instead of waiting for a second restart. (#60583) Thanks @joelnishanth.
- Cron: send failure notifications through the job's primary delivery channel using the same session context as successful delivery when no explicit `failureDestination` is configured. (#60622) Thanks @artwalker.
- Live model switching: only treat explicit user-driven model changes as pending live switches, so fallback rotation, heartbeat overrides, and compaction no longer trip `LiveSessionModelSwitchError` before making an API call. (#60266) Thanks @kiranvk-2011.
- Exec approvals: reuse durable exact-command `allow-always` approvals in allowlist mode so identical reruns stop prompting, and tighten Windows interpreter/path approval handling so wrapper and malformed-path cases fail closed more consistently. (#59880, #59780, #58040, #59182) Thanks @luoyanglang, @SnowSky1, and @pgondhi987.
- Node exec approvals: keep node-host `system.run` approvals bound to the prepared execution plan across async forwarding, so mutable script operands still get approval-time binding and drift revalidation instead of dropping back to unbound execution.
- Agents/exec approvals: let `exec-approvals.json` agent security override stricter gateway tool defaults so approved subagents can use `security: “full”` without falling back to allowlist enforcement again. (#60310) Thanks @lml2468.
- Agents/exec: restore `host=node` routing for node-pinned and `host=auto` sessions, while still blocking sandboxed `auto` sessions from jumping to gateway. (#60788) Thanks @openperf.
- Exec/heartbeat: use the canonical `exec-event` wake reason for `notifyOnExit` so background exec completions still trigger follow-up turns when `HEARTBEAT.md` is empty or comments-only. (#41479) Thanks @rstar327.
- Heartbeat: skip wake delivery when the target session lane is already busy so the pending event is retried instead of getting drained too early. (#40526) Thanks @lucky7323.
- Group chats/agent prompts: tell models to minimize empty lines and use normal chat-style spacing so group replies avoid document-style blank-line formatting.
- Providers/OpenAI GPT: treat short approval turns like `ok do it` and `go ahead` as immediate action turns, and trim overly memo-like GPT-5 chat confirmations so OpenAI replies stay shorter and more conversational by default.
- Providers/OpenAI Codex: split native `contextWindow` from runtime `contextTokens`, keep the default effective cap at `272000`, and expose a per-model `contextTokens` override on `models.providers.*.models[]`.
- Providers/OpenAI-compatible WS: compute fallback token totals from normalized usage when providers omit or zero `total_tokens`, so DashScope-compatible sessions stop storing zero totals after alias normalization. (#54940) Thanks @lyfuci.
- Agents/OpenAI: mark Claude-compatible file tool schemas as `additionalProperties: false` so direct OpenAI GPT-5 routes stop rejecting the `read` tool with invalid strict-schema errors.
- Agents/OpenAI: fall back to `strict: false` for native OpenAI tool calls when a tool schema is not strict-compatible, and normalize empty-object tool schemas to include `required: []`, so direct GPT-5 routes stop failing with invalid strict-schema errors like missing `path` in `required`.
- Agents/GPT: add explicit work-item lifecycle events for embedded runs, use them to surface real progress more reliably, and stop counting tool-started turns as planning-only retries.
- Plugins/OpenAI: enable `gpt-image-1` reference-image edits through `/images/edits` multipart uploads, and stop inferring unsupported resolution overrides when no explicit `size` or `resolution` is provided.
- Agents/replay: remove the malformed assistant-content canonicalization repair from replay history sanitization instead of extending that legacy repair path into replay validation.
- Plugins/OpenAI: tune the OpenAI prompt overlay for live-chat cadence so GPT replies stay shorter, more human, and less wall-of-text by default.
- Providers/compat: stop forcing OpenAI-only defaults on proxy and custom OpenAI-compatible routes, preserve native vendor-specific reasoning/tool/streaming behavior across Anthropic-compatible, Moonshot, Mistral, ModelStudio, OpenRouter, xAI, and Z.ai endpoints, and route GitHub Copilot Claude models through Anthropic Messages instead of OpenAI Responses.
- Providers/GitHub Copilot: send IDE identity headers on runtime model requests and GitHub token exchange so IDE-authenticated Copilot runs stop failing with missing `Editor-Version`. (#60641) Thanks @VACInc and @vincentkoc.
- Providers/OpenRouter failover: classify `403 “Key limit exceeded”` spending-limit responses as billing so model fallback continues instead of stopping on generic auth. (#59892) Thanks @rockcent.
- Providers/Anthropic: keep `claude-cli/*` auth on live Claude CLI credentials at runtime, avoid persisting stale bearer-token profiles, and suppress macOS Keychain prompts during non-interactive Claude CLI setup. (#61234) Thanks @darkamenosa.
- Providers/Anthropic: when Claude CLI auth becomes the default, write a real `claude-cli` auth profile so local and gateway agent runs can use Claude CLI immediately without missing-API-key failures. Thanks @vincentkoc.
- Providers/Anthropic Vertex: honor `cacheRetention: “long”` with the real 1-hour prompt-cache TTL on Vertex AI endpoints, and default `anthropic-vertex` cache retention like direct Anthropic. (#60888) Thanks @affsantos.
- Agents/Anthropic: preserve native `toolu_*` replay ids on direct Anthropic and Anthropic Vertex paths so cache-sensitive history stops rewriting known-valid Anthropic tool-use ids. (#52612)
- Providers/Google: add model-level `cacheRetention` support for direct Gemini system prompts by creating, reusing, and refreshing `cachedContents` automatically on Google AI Studio runs. (#51372) Thanks @rafaelmariano-glitch.
- Google Gemini CLI auth: detect bundled npm installs by scanning packaged bundle files for the Gemini OAuth client config, so `npm install -g @google/gemini-cli` layouts work again. (#60486) Thanks @wzfmini01.
- Google Gemini CLI auth: detect personal OAuth mode from local Gemini settings and skip Code Assist project discovery for those logins, so personal Google accounts stop failing with `loadCodeAssist 400 Bad Request`. (#49226) Thanks @bobworrall.
- Google Gemini CLI auth: improve OAuth credential discovery across Windows nvm and Homebrew libexec installs, and align Code Assist metadata so Gemini login stops failing on packaged CLI layouts. (#40729) Thanks @hughcube.
- Google Gemini CLI models: add forward-compat support for stable `gemini-2.5-*` model ids by letting the bundled CLI provider clone them from Google templates, so `gemini-2.5-flash-lite` and related configured models stop showing up as missing. (#35274) Thanks @mySebbe.
- Google image generation: disable pinned DNS for Gemini image requests and honor explicit `pinDns` overrides in shared provider HTTP helpers so proxy-backed image generation works again. (#59873) Thanks @luoyanglang.
- Providers/Microsoft Foundry: preserve explicit image capability on normalized Foundry deployments, repair stale GPT/o-series text-only model metadata across gateway and runtime paths, and keep unknown fallback models from borrowing unrelated image support.
- Providers/Model Studio: preserve native streaming usage reporting for DashScope-compatible endpoints even when they are configured under a generic provider key, so streamed token totals stop sticking at zero. (#52395) Thanks @IVY-AI-gif.
- Providers/Z.AI: preserve explicitly registered `glm-5-*` variants like `glm-5-turbo` instead of intercepting them with the generic GLM-5 forward-compat shim. (#48185) Thanks @haoyu-haoyu.
- Amazon Bedrock/aws-sdk auth: stop injecting the fake `AWS_PROFILE` apiKey marker when no AWS auth env vars exist, so instance-role and other default-chain setups keep working without poisoning provider config. (#61194) Thanks @wirjo.
- Agents/Kimi tool-call repair: preserve tool arguments that were already present on streamed tool calls when later malformed deltas fail reevaluation, while still dropping stale repair-only state before `toolcall_end`.
- Plugins/Kimi Coding: parse tagged tool calls and keep Anthropic-native tool payloads so Kimi coding endpoints execute tools instead of echoing raw markup. (#60051, #60391) Thanks @obviyus and @Eric-Guo.
- Media understanding: auto-register image-capable config providers for vision routing, so custom GLM-style provider ids with image models stop failing with “no media-understanding provider registered”. (#51418) Thanks @xydt-610.
- Plugins/media understanding: enable bundled Groq and Deepgram providers by default so configured transcription models work without extra plugin activation config. (#59982) Thanks @yxjsxy.
- MiniMax/pricing: keep bundled MiniMax highspeed pricing distinct in provider catalogs and preserve the lower M2.5 cache-read pricing when onboarding older MiniMax models. (#54214) Thanks @octo-patch.
- MiniMax: advertise image input on bundled `MiniMax-M2.7` and `MiniMax-M2.7-highspeed` model definitions so image-capable flows can route through the M2.7 family correctly. (#54843) Thanks @MerlinMiao88888888.
- Models/MiniMax: honor `MINIMAX_API_HOST` for implicit bundled MiniMax provider catalogs so China-hosted API-key setups pick `api.minimaxi.com/anthropic` without manual provider config. (#34524) Thanks @caiqinghua.
- Usage/MiniMax: invert remaining-style `usage_percent` fields when MiniMax reports only remaining percentage data, so usage bars stop showing nearly-full remaining quota as nearly-exhausted usage. (#60254) Thanks @jwchmodx.
- Usage/MiniMax: let usage snapshots treat `minimax-portal` and MiniMax CN aliases as the same MiniMax quota surface, and prefer stored MiniMax OAuth before falling back to Coding Plan keys.
- Usage/MiniMax: prefer the chat-model `model_remains` entry and derive Coding Plan window labels from MiniMax interval timestamps so MiniMax usage snapshots stop picking zero-budget media rows and misreporting 4h windows as `5h`. (#52349) Thanks @IVY-AI-gif.
- Model picker/providers: treat bundled BytePlus and Volcengine plan aliases as their native providers during setup, and expose their bundled standard/coding catalogs before auth so setup can suggest the right models. (#58819) Thanks @Luckymingxuan.
- Tools/web_search (Kimi): when `tools.web.search.kimi.baseUrl` is unset, inherit native Moonshot chat `baseUrl` (`.ai` / `.cn`) so China console keys authenticate on the same host as chat. Fixes #44851. (#56769) Thanks @tonga54.
- Agents/Claude CLI: keep non-interactive `--permission-mode bypassPermissions` when custom `cliBackends.claude-cli.args` override defaults, including fallback resolution before the runtime plugin registry is active, so cron and heartbeat Claude CLI runs do not regress to interactive approval mode. (#61114) Thanks @cathrynlavery and @thewilloftheshadow.
- Agents/Claude CLI: persist explicit `openclaw agent --session-id` runs under a stable session key so follow-ups can reuse the stored CLI binding and resume the same underlying Claude session.
- Agents/Claude CLI: persist routed Claude session bindings, rotate them on `/new` and `/reset`, and keep live Claude CLI model switches moving across the configured Claude family so resumed sessions follow the real active thread and model. Thanks @vincentkoc.
- Agents/CLI backends: invalidate stored CLI session reuse when local CLI login state or the selected auth profile credential changes, so relogin and token rotation stop resuming stale sessions.
- Agents/Claude CLI/images: reuse stable hydrated image file paths and preserve shared media extensions like HEIC when passing image refs to local CLI runs, so Claude CLI image prompts stop thrashing KV cache prefixes and oddball image formats do not fall back to `.bin`. Thanks @vincentkoc.
- Agents/compaction: keep assistant tool calls and displaced tool results in the same compaction chunk so strict summarization providers stop rejecting orphaned tool pairs. (#58849) Thanks @openperf.
- Agents/failover: scope Anthropic `An unknown error occurred` failover matching by provider so generic internal unknown-error text no longer triggers retryable timeout fallback. (#59325) Thanks @aaron-he-zhu.
- Agents/subagents: honor allowlist validation, auth-profile handoff, and session override state when a subagent retries after `LiveSessionModelSwitchError`. (#58178) Thanks @openperf.
- Agents/runtime: make default subagent allowlists, inherited skills/workspaces, and duplicate session-id resolution behave more predictably, and include value-shape hints in missing-parameter tool errors. (#59944, #59992, #59858, #55317) Thanks @hclsys, @gumadeiras, @joelnishanth, and @priyansh19.
- Agents/pairing: merge completion announce delivery context with the requester session fallback so missing `to` still reaches the original channel, and include `operator.talk.secrets` in CLI default operator scopes for node-role device pairing approvals. (#56481) Thanks @maxpetrusenko.
- Agents/scheduling: steer background-now work toward automatic completion wake and treat `process` polling as on-demand inspection or intervention instead of default completion handling. (#60877) Thanks @vincentkoc.
- Agents/skills: skip `.git` and `node_modules` when mirroring skills into sandbox workspaces so read-only sandboxes do not copy repo history or dependency trees. (#61090) Thanks @joelnishanth.
- ACP/agents: inherit the target agent workspace for cross-agent ACP spawns and fall back safely when the inherited workspace no longer exists. (#58438) Thanks @zssggle-rgb.
- ACPX/Windows: preserve backslashes and absolute `.exe` paths in Claude CLI parsing, and fail fast on wrapper-script targets with guidance to use `cmd.exe /c`, `powershell.exe -File`, or `node <script>`. (#60689) Thanks @steipete.
- Auth/failover: persist selected fallback overrides before retrying, shorten `auth_permanent` lockouts, and refresh websocket/shared-auth sessions only when real auth changes occur so retries and secret rotations behave predictably. (#60404, #60323, #60387) Thanks @extrasmall0 and @mappel-nv.
- Gateway/channels: pin the initial startup channel registry before later plugin-registry churn so configured channels stay visible and `channels.status` stops falling back to empty `channelOrder` / `channels` payloads after runtime plugin loads.
- Prompt caching: order stable workspace project-context files before `HEARTBEAT.md` and keep `HEARTBEAT.md` below the system-prompt cache boundary so heartbeat churn does not invalidate the stable project-context prefix. (#58979) Thanks @yozu and @vincentkoc.
- Prompt caching: route Codex Responses and Anthropic Vertex through boundary-aware cache shaping, and report the actual outbound system prompt in cache traces so cache reuse and misses line up with what providers really receive. Thanks @vincentkoc.
- Agents/cache: preserve the full 3-turn prompt-cache image window across tool loops, keep colliding bundled MCP tool definitions deterministic, and reapply Anthropic Vertex cache shaping after payload hook replacements so KV/cache reuse stays stable. Thanks @vincentkoc.
- Status/cache: restore `cacheRead` and `cacheWrite` in transcript fallback so `/status` keeps showing cache hit percentages when session logs are the only complete usage source. (#59247) Thanks @stuartsy.
- Status/usage: let `/status` and `session_status` fall back to transcript token totals when the session meta store stayed at zero, so LM Studio, Ollama, DashScope, and similar OpenAI-compatible providers stop showing `Context: 0/...`. (#55041) Thanks @jjjojoj.
- Mattermost/config schema: accept `groups.*.requireMention` again so existing Mattermost configs no longer fail strict validation after upgrade. (#58271) Thanks @MoerAI.
- Doctor/config: compare normalized `talk` configs by deep structural equality instead of key-order-sensitive serialization so `openclaw doctor --fix` stops repeatedly reporting/applying no-op `talk.provider/providers` normalization. (#59911) Thanks @ejames-dev.
- Anthropic CLI onboarding: rewrite migrated fallback model refs during non-interactive Claude CLI setup too, so onboarding and scripted setup no longer keep stale `anthropic/*` fallbacks after switching the primary model to `claude-cli/*`. Thanks @vincentkoc.
- Models/Anthropic CLI auth: replace migrated `agents.defaults.models` allowlists when `openclaw models auth login --provider anthropic --method cli --set-default` switches to `claude-cli/*`, so stale `anthropic/*` entries do not linger beside the migrated Claude CLI defaults. Thanks @vincentkoc.
- Doctor/Claude CLI: add dedicated Claude CLI health checks so `openclaw doctor` can spot missing local installs or broken auth before agent runs fail. Thanks @vincentkoc.
- Plugins/auth-choice: apply provider-owned auth config patches without recursively preserving replaced default-model maps, so Anthropic Claude CLI and similar migrations can intentionally swap model allowlists during onboarding and setup instead of accumulating stale entries. Thanks @vincentkoc.
- Plugins/onboarding: write dotted plugin uiHint paths like Brave `webSearch.mode` as nested plugin config so `llm-context` setup stops failing validation. (#61159) Thanks @obviyus.
- Plugins/install: preserve unsafe override flags across linked plugin and hook-pack probes so local `--link` installs honor the documented override behavior. (#60624) Thanks @JerrettDavis.
- Plugins/cache: inherit the active gateway workspace for provider, web-search, and web-fetch snapshot loads when callers omit `workspaceDir`, so compatible plugin registries and snapshot caches stop missing on gateway-owned runtime paths. (#61138) Thanks @jzakirov.
- Plugin SDK/context engines: export the missing context-engine result and subagent lifecycle types from `openclaw/plugin-sdk` so context engine plugins can type `ContextEngine` implementations without local workarounds. (#61251) Thanks @DaevMithran.
- Tasks/maintenance: reconcile stale cron and chat-backed CLI task rows against live cron-job and agent-run ownership instead of treating any persisted session key as proof that the task is still running. (#60310) Thanks @lml2468.
- Plugins: suppress trust-warning noise during non-activating snapshot and CLI metadata loads. (#61427) Thanks @gumadeiras.
- Agents/video generation: accept `agents.defaults.videoGenerationModel` in strict config validation and `openclaw config set/get`, so gateways using `video_generate` no longer fail to boot after enabling a video model.
- Matrix/streaming: add a quiet preview mode for streamed Matrix replies, keep legacy `partial` preview-first behavior, and finalize quiet media captions correctly so previews stop notifying early without dropping final text semantics. (#61450) Thanks @gumadeiras.
- Gateway/shutdown: bound websocket-server shutdown even when no tracked clients remain, so gateway restarts stop hanging until the watchdog kills the process. (#61565) Thanks @mbelinky.
- Control UI/multilingual: localize the remaining shared channel, instances, nodes, and gateway-confirmation strings so the dashboard stops mixing translated UI with hardcoded English labels. Thanks @vincentkoc.
- Discord/media: raise the default inbound and outbound media cap to `100MB` so Discord matches Telegram more closely and larger attachments stop failing on the old low default.
- Matrix: keep direct transport requests on the pinned dispatcher by routing them through undici runtime fetch, so Matrix clients resume syncing on newer runtimes without dropping the validated address binding. (#61595) Thanks @gumadeiras.
- Plugins/facades: resolve globally installed bundled-plugin runtime facades from registry roots so bundled channels like LINE still boot when the winning plugin install lives under the global extensions directory with an encoded scoped folder name. (#61297) Thanks @openperf.

---

### 📦 v2026.4.7 (2026-04-08)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.4.7)

> [!NOTE]
> **DeXMart-relevant keywords:** `telegram`, `billing`

#### Changes (Features)

- CLI/infer: add a first-class `openclaw infer ...` hub for provider-backed inference workflows across model, media, web, and embedding tasks. Thanks @Takhoffman.
- Tools/media generation: auto-fallback across auth-backed image, music, and video providers by default, preserve intent during provider switches, remap size/aspect/resolution/duration hints to the closest supported option, and surface provider capabilities plus mode-aware video-to-video support.
- Memory/wiki: restore the bundled `memory-wiki` stack with plugin, CLI, sync/query/apply tooling, memory-host integration, structured claim/evidence fields, compiled digest retrieval, claim-health linting, contradiction clustering, staleness dashboards, and freshness-weighted search. Thanks @vincentkoc.
- Plugins/webhooks: add a bundled webhook ingress plugin so external automation can create and drive bound TaskFlows through per-route shared-secret endpoints. (#61892) Thanks @mbelinky.
- Gateway/sessions: add persisted compaction checkpoints plus Sessions UI branch/restore actions so operators can inspect and recover pre-compaction session state. (#62146) Thanks @scoootscooob.
- Compaction: add pluggable compaction provider registry so plugins can replace the built-in summarization pipeline. Configure via `agents.defaults.compaction.provider`; falls back to LLM summarization on provider failure. (#56224) Thanks @DhruvBhatia0.
- Agents/system prompt: add `agents.defaults.systemPromptOverride` for controlled prompt experiments plus heartbeat prompt-section controls so heartbeat runtime behavior can stay enabled without injecting heartbeat instructions every turn.
- Providers/Google: add Gemma 4 model support and keep Google fallback resolution on the requested provider path so native Google Gemma routes work again. (#61507) Thanks @eyjohn.
- Providers/Google: preserve explicit thinking-off semantics for Gemma 4 while still enabling Gemma reasoning support in compatibility wrappers. (#62127) Thanks @romgenie.
- Providers/Arcee AI: add a bundled Arcee AI provider plugin with Trinity catalog entries, OpenRouter support, and updated onboarding/auth guidance. (#62068) Thanks @arthurbr11.
- Providers/Anthropic: restore Claude CLI as the preferred local Anthropic path in onboarding, model-auth guidance, doctor flows, and Docker Claude CLI live lanes again.
- Providers/Ollama: detect vision capability from the `/api/show` response and set image input on models that support it so Ollama vision models accept image attachments. (#62193) Thanks @BruceMacD.
- Memory/dreaming: ingest redacted session transcripts into the dreaming corpus with per-day session-corpus notes, cursor checkpointing, and promotion/doctor support. (#62227) Thanks @vignesh07.
- Providers/inferrs: add string-content compatibility for stricter OpenAI-compatible chat backends, document `inferrs` setup with a full config example, and add troubleshooting guidance for local backends that pass direct probes but fail on full agent-runtime prompts.
- Agents/context engine: expose prompt-cache runtime context to context engines and keep current-turn prompt-cache usage aligned with the active attempt instead of stale prior-turn assistant state. (#62179) Thanks @jalehman.
- Plugin SDK/context engines: pass `availableTools` and `citationsMode` into `assemble()`, and expose memory-artifact and memory-prompt seams so companion plugins and non-legacy context engines can consume active memory state without reaching into internals. Thanks @vincentkoc.
- ACP/ACPX plugin: bump the bundled `acpx` pin to `0.5.1` so plugin-local installs and strict version checks pick up the latest published runtime release. (#62148) Thanks @onutc.
- Discord/events: allow `event-create` to accept a cover image URL or local file path, load and validate PNG/JPG/GIF event cover media, and pass the encoded image payload through Discord admin action/runtime paths. (#60883) Thanks @bittoby.

#### Fixes

- CLI/infer: keep provider-backed infer behavior aligned with actual runtime execution by fixing explicit TTS override handling, profile-aware gateway TTS prefs resolution, per-request transcription `prompt`/`language` overrides, image output MIME/extension mismatches, configured web-search fallback behavior, and agent-vs-CLI web-search execution drift.
- Plugins/media: when `plugins.allow` is set, capability fallback now merges bundled capability plugin ids into the allowlist (not only `plugins.entries`), so media understanding providers such as OpenAI-compatible STT load for voice transcription without requiring `openai` in `plugins.allow`. (#62205) Thanks @neeravmakwana.
- Agents/history and replies: buffer phaseless OpenAI WS text until a real assistant phase arrives, keep replay and SSE history sequence tracking aligned, hide commentary and leaked tool XML from user-visible history, and keep history-based follow-up replies on `final_answer` text only. (#61729, #61747, #61829, #61855, #61954) Thanks @100yenadmin and contributors.
- Control UI: show `/tts` audio replies in webchat, detect mistaken `?token=` auth links with the correct `#token=` hint, and keep Copy, Canvas, and mobile exec-approval UI from covering chat content on narrow screens. (#54842, #61514, #61598) Thanks @neeravmakwana.
- iOS/gateway: replace string-matched connection error UI with structured gateway connection problems, preserve actionable pairing/auth failures over later generic disconnect noise, and surface reusable problem banners and details across onboarding, settings, and root status surfaces. (#62650) Thanks @ngutman.
- TUI: route `/status` through the shared session-status command, keep commentary hidden in history, strip raw envelope metadata from async command notices, preserve fallback streaming before per-attempt failures finalize, and restore Kitty keyboard state on exit or fatal crashes. (#49130, #59985, #60043, #61463) Thanks @biefan and contributors.
- iOS/Watch exec approvals: keep Apple Watch review and approval recovery working while the iPhone is locked or backgrounded, including reconnect recovery, pending approval persistence, notification cleanup, and APNs-backed watch refresh recovery. (#61757) Thanks @ngutman.
- Agents/context overflow: combine oversized and aggregate tool-result recovery in one pass and restore a total-context overflow backstop so recoverable sessions retry instead of failing early. (#61651) Thanks @Takhoffman.
- Auth/OpenAI Codex OAuth: reload fresh on-disk credentials inside the locked refresh path and retry once after `refresh_token_reused` rotates only the stored refresh token, so relogin/restart recovery stops getting stuck on stale cached auth state. Thanks @owen-ever.
- Auth/OpenAI Codex OAuth: keep native `/model ...@profile` selections on the target session and honor explicit user-locked auth profiles even when per-agent auth order excludes them. (#62744) Thanks @jalehman.
- Providers/Anthropic: preserve thinking blocks for Claude Opus 4.5+, Sonnet 4.5+, and newer Claude 4-family models so prompt-cache prefixes keep matching, and skip `service_tier` injection on OAuth-authenticated stream wrapper requests so Claude OAuth streaming stops failing with HTTP 401. (#60356, #61793)
- Agents/Claude CLI: surface nested API error messages from structured CLI output so billing/auth/provider failures show the real provider error instead of an opaque CLI failure.
- Agents/exec: preserve explicit `host=node` routing under elevated defaults when `tools.exec.host=auto`, fail loud on invalid elevated cross-host overrides, and keep `strictInlineEval` commands blocked after approval timeouts instead of falling through to automatic execution. (#61739) Thanks @obviyus.
- Nodes/exec approvals: keep `host=node` POSIX transport shell wrappers (`/bin/sh -lc ...`) aligned with inner-command allowlist analysis so allowlisted scripts stop prompting unnecessarily, while Windows `cmd.exe` wrapper runs stay approval-gated. (#62401) Thanks @ngutman.
- Nodes/exec approvals: keep Windows `cmd.exe /c` wrapper runs approval-gated even when `env` carriers, including env-assignment carriers, wrap the shell invocation. (#62439) Thanks @ngutman.
- Gateway tool/exec config: block model-facing `gateway config.apply` and `config.patch` writes from changing exec approval paths such as `safeBins`, `safeBinProfiles`, `safeBinTrustedDirs`, and `strictInlineEval`, while still allowing unchanged structured values through. (#62001) Thanks @eleqtrizit.
- Host exec/env sanitization: block dangerous Java, Rust, Cargo, Git, Kubernetes, cloud credential, config-path, and Helm env overrides so host-run tools cannot be redirected to attacker-chosen code, config, credentials, or repository state. (#59119, #62002, #62291) Thanks @eleqtrizit and contributors.
- Commands/allowlist: require owner authorization for `/allowlist add` and `/allowlist remove` before channel resolution, so non-owner but command-authorized senders can no longer persistently rewrite allowlist policy state. (#62383) Thanks @pgondhi987.
- Feishu/docx uploads: honor `tools.fs.workspaceOnly` for local `upload_file` and `upload_image` paths by forwarding workspace-constrained `localRoots` into the media loader, so docx uploads can no longer read host-local files outside the workspace when workspace-only mode is active. (#62369) Thanks @pgondhi987.
- Network/fetch guard: drop request bodies and body-describing headers on cross-origin `307` and `308` redirects by default, so attacker-controlled redirect hops cannot receive secret-bearing POST payloads from SSRF-guarded fetch flows unless a caller explicitly opts in. (#62357) Thanks @pgondhi987.
- Browser/SSRF: treat main-frame `document` redirect hops as navigations even when Playwright does not flag them as `isNavigationRequest()`, so strict private-network blocking still stops forbidden redirect pivots before the browser reaches the internal target. (#62355) Thanks @pgondhi987.
- Browser/node invoke: block persistent browser profile create, reset, and delete mutations through `browser.proxy` on both gateway-forwarded `node.invoke` and the node-host proxy path, even when no profile allowlist is configured. (#60489)
- Gateway/node pairing: require a fresh pairing request when a previously paired node reconnects with additional declared commands, and keep the live session pinned to the earlier approved command set until the upgrade is approved. (#62658) Thanks @eleqtrizit.
- Gateway/auth: invalidate existing shared-token and password WebSocket sessions when the configured secret rotates, so stale authenticated sockets cannot stay attached after token or password changes. (#62350) Thanks @pgondhi987.
- MS Teams/security: validate file-consent upload URLs against HTTPS, Microsoft/SharePoint host allowlists, and private-IP DNS checks before uploading attachments, blocking SSRF-style consent-upload abuse. (#23596)
- Media/base64 decode guards: enforce byte limits before decoding missed base64-backed Teams, Signal, QQ Bot, and image-tool payloads so oversized inbound media and data URLs no longer bypass pre-decode size checks. (#62007) Thanks @eleqtrizit.
- Runtime event trust: mark background `notifyOnExit` summaries, ACP parent-stream relays, and wake-hook payloads as untrusted system events so lower-trust runtime output no longer re-enters later turns as trusted `System:` text. (#62003)
- Auto-reply/media: allow managed generated-media `MEDIA:` paths from normal reply text again while still blocking arbitrary host-local media and document paths, so generated media keep delivering without reopening host-path injection holes.
- Gateway/status and containers: auto-bind to `0.0.0.0` inside Docker and Podman environments, and probe local TLS gateways over `wss://` with self-signed fingerprint forwarding so container startup and loopback TLS status checks work again. (#61818, #61935) Thanks @openperf and contributors.
- Gateway/OpenAI-compatible HTTP: abort in-flight `/v1/chat/completions` and `/v1/responses` turns when clients disconnect so abandoned HTTP requests stop wasting agent runtime. (#54388) Thanks @Lellansin.
- macOS/gateway version: strip trailing commit metadata from CLI version output before semver parsing so the Mac app recognizes installed gateway versions like `OpenClaw 2026.4.2 (d74a122)` again. (#61111) Thanks @oliviareid-svg.
- Sessions/model selection: resolve the explicitly selected session model separately from runtime fallback resolution so session status and live model switching stay aligned with the chosen model.
- Discord/ACP bindings: canonicalize DM conversation identity across inbound messages, component interactions, native commands, and current-conversation binding resolution so `--bind here` in Discord DMs keeps routing follow-up replies to the bound agent instead of falling back to the default agent.
- Discord: recover forwarded referenced message text and attachments when snapshots are missing, use `ws://` again for gateway monitor sockets, stop forcing a hardcoded temperature for Codex-backed auto-thread titles, and harden voice receive recovery so rapid speaker restarts keep their next utterance. (#41536, #61670) Thanks @artwalker and contributors.
- Slack/thread mentions: add `channels.slack.thread.requireExplicitMention` so Slack channels that already require mentions can also require explicit `@bot` mentions inside bot-participated threads. (#58276) Thanks @praktika-engineer.
- Slack/threading: keep legacy thread stickiness for real replies when older callers omit `isThreadReply`, while still honoring `replyToMode` for Slack's auto-created top-level `thread_ts`. (#61835) Thanks @kaonash.
- Slack/media: keep attachment downloads on the SSRF-guarded dispatcher path so Slack media fetching works on Node 22 without dropping pinned transport enforcement. (#62239) Thanks @openperf.
- Matrix/onboarding: add an invite auto-join setup step with explicit off warnings and strict stable-target validation so new Matrix accounts stop silently ignoring invited rooms and fresh DM-style invites unless operators opt in. (#62168) Thanks @gumadeiras.
- Matrix/formatting: preserve multi-paragraph and loose-list rendering in Element so numbered and bulleted Markdown keeps their content attached to the correct list item. (#60997) Thanks @gucasbrg.
- Telegram/doctor: keep top-level access-control fallback in place during multi-account normalization while still promoting legacy default auth into `accounts.default`, so existing named bots keep inherited allowlists without dropping the legacy default bot. (#62263) Thanks @obviyus.
- Plugins/loaders: centralize bundled `dist/**` Jiti native-load policy and keep channel, public-surface, facade, and config-metadata loader seams off native Jiti on Windows so onboarding and configure flows stop tripping `ERR_UNSUPPORTED_ESM_URL_SCHEME`. (#62286) Thanks @chen-zhang-cs-code.
- Plugins/channels: keep bundled channel artifact and secret-contract loading stable under lazy loading, preserve plugin-schema defaults during install, and fix Windows `file://` plus native-Jiti plugin loader paths so onboarding, doctor, `openclaw secret`, and bundled plugin installs work again. (#61832, #61836, #61853, #61856) Thanks @Zeesejo and contributors.
- Plugins/ClawHub: verify downloaded plugin archives against version metadata SHA-256, fail closed when archive integrity metadata is missing or malformed, and tighten fallback ZIP verification so plugin installs cannot proceed on mismatched or incomplete ClawHub package metadata. (#60517) Thanks @mappel-nv.
- Plugins/provider hooks: stop recursive provider snapshot loads from overflowing the stack during plugin initialization, while still preserving cached nested provider-hook results. (#61922, #61938, #61946, #61951)
- Docker/plugins: stop forcing bundled plugin discovery to `/app/extensions` in runtime images so packaged installs use compiled `dist/extensions` artifacts again and Node 24 containers do not boot through source-only plugin entry paths. Fixes #62044. (#62316) Thanks @gumadeiras.
- Providers/Ollama: honor the selected provider's `baseUrl` during streaming so multi-Ollama setups stop routing every stream to the first configured Ollama endpoint. (#61678)
- Providers/Ollama: stop warning that Ollama could not be reached when discovery only sees empty default local stubs, while still keeping real explicit Ollama overrides loud when the endpoint is unreachable.
- Providers/xAI: recognize `api.grok.x.ai` as an xAI-native endpoint again and keep legacy `x_search` auth resolution working so older xAI web-search configs continue to load. (#61377) Thanks @jjjojoj.
- Providers/Mistral: send `reasoning_effort` for `mistral/mistral-small-latest` (Mistral Small 4) with thinking-level mapping, and mark the catalog entry as reasoning-capable so adjustable reasoning matches Mistral’s Chat Completions API. (#62162) Thanks @neeravmakwana.
- OpenAI TTS/Groq: send `wav` to Groq-compatible speech endpoints, honor explicit `responseFormat` overrides on OpenAI-compatible paths, and only mark voice-note output as voice-compatible when the actual format is `opus`. (#62233) Thanks @neeravmakwana.
- Tools/web_fetch and web_search: fix `TypeError: fetch failed` caused by undici 8.0 enabling HTTP/2 by default; pinned SSRF-guard dispatchers now explicitly set `allowH2: false` to restore HTTP/1.1 behavior and keep the custom DNS-pinning lookup compatible. (#61738, #61777) Thanks @zozo123.
- Tools/web search/Exa: show Exa Search in onboarding and configure provider pickers again by marking the bundled Exa provider as setup-visible. Thanks @vincentkoc.
- Memory/vector recall: surface explicit warnings when `sqlite-vec` is unavailable or vector writes are degraded, and strip managed Light Sleep and REM blocks before daily-note ingestion so memory indexing and dreaming stop reporting false-success or re-ingesting staged output. (#61720) Thanks @MonkeyLeeT.
- Memory/dreaming: make Dreams config reads and writes respect the selected memory slot plugin instead of always targeting `memory-core`. (#62275) Thanks @SnowSky1.
- QQ Bot/media: route gateway-side attachment and fallback downloads through guarded QQ/Tencent HTTPS fetches so QQ media handling no longer follows arbitrary remote hosts.
- Browser/remote CDP: retry the DevTools websocket once after remote browser restarts so healthy remote browser profiles do not fail availability checks during CDP warm-up. (#57397) Thanks @ThanhNguyxn07.
- UI/light mode: target both root and nested WebKit scrollbar thumbs in the light theme so page-level and container scrollbars stay visible on light backgrounds. (#61753) Thanks @chziyue.
- Agents/subagents: honor `sessions_spawn(lightContext: true)` for spawned subagent runs by preserving lightweight bootstrap context through the gateway and embedded runner instead of silently falling back to full workspace bootstrap injection. (#62264) Thanks @theSamPadilla.
- Cron: load `jobId` into `id` when the on-disk store omits `id`, matching doctor migration and fixing `unknown cron job id` for hand-edited `jobs.json`. (#62246) Thanks @neeravmakwana.
- Agents/model fallback: classify minimal HTTP 404 API errors (for example `404 status code (no body)`) as `model_not_found` so assistant failures throw into the fallback chain instead of stopping at the first fallback candidate. (#62119) Thanks @neeravmakwana.
- BlueBubbles/network: respect explicit private-network opt-out for loopback and private `serverUrl` values across account resolution, status probes, monitor startup, and attachment downloads, while keeping public-host attachment hostname pinning intact. (#59373) Thanks @jpreagan.
- Agents/heartbeat: keep heartbeat runs pinned to the main session so active subagent transcripts are not overwritten by heartbeat status messages. (#61803) Thanks @100yenadmin.
- Agents/heartbeat: respect disabled heartbeat prompt guidance so operators can suppress heartbeat prompt instructions without disabling heartbeat runtime behavior.
- Agents/compaction: stop compaction-wait aborts from re-entering prompt failover and replaying completed tool turns. (#62600) Thanks @i-dentifier.
- Approvals/runtime: move native approval lifecycle assembly into shared core bootstrap/runtime seams driven by channel capabilities and runtime contexts, and remove the legacy bundled approval fallback wiring. (#62135) Thanks @gumadeiras.
- Security/fetch-guard: stop rejecting operator-configured proxy hostnames against the target-scoped hostname allowlist in SSRF-guarded fetches, restoring proxy-based media downloads for Telegram and other channels. (#62312) Thanks @ademczuk.
- Logging: make `logging.level` and `logging.consoleLevel` honor the documented severity threshold ordering again, and keep child loggers inheriting the parent `minLevel`. (#44646) Thanks @zhumengzhu.
- Agents/sessions_send: pass `threadId` through announce delivery so cross-session notifications land in the correct Telegram forum topic instead of the group's general thread. (#62758) Thanks @jalehman.
- Daemon/systemd: keep sudo systemctl calls scoped to the invoking user when machine-scoped systemctl fails, while still avoiding machine fallback for permission-denied user bus errors. (#62337) Thanks @Aftabbs.
- Docs/i18n: relocalize final localized-page links after translation and remove the zh-CN homepage redirect override so localized Mintlify pages resolve to the correct language roots again. (#61796) Thanks @hxy91819.
- Agents/exec: keep timed-out shell-backgrounded commands on the failed path and point long-running jobs to exec background/yield sessions so process polling is only suggested for registered sessions.

---

### 📦 v2026.4.8 (2026-04-08)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.4.8)

> [!NOTE]
> **DeXMart-relevant keywords:** `telegram`

#### Fixes

- Telegram/setup: load setup and secret contracts through packaged top-level sidecars so installed npm builds no longer try to import missing `dist/extensions/telegram/src/*` files during gateway startup.
- Bundled channels/setup: load shared secret contracts through packaged top-level sidecars across BlueBubbles, Feishu, Google Chat, IRC, Matrix, Mattermost, Microsoft Teams, Nextcloud Talk, Slack, and Zalo so installed npm builds no longer rely on missing `dist/extensions/*/src/*` files during gateway startup.
- Bundled plugins: align packaged plugin compatibility metadata with the release version so bundled channels and providers load on OpenClaw 2026.4.8.
- Agents/progress: keep `update_plan` available for OpenAI-family runs while returning compact success payloads and allowing `tools.experimental.planTool=false` to opt out.
- Agents/exec: keep `/exec` current-default reporting aligned with real runtime behavior so `host=auto` sessions surface the correct host-aware fallback policy (`full/off` on gateway or node, `deny/off` on sandbox) instead of stale stricter defaults.
- Slack: honor ambient HTTP(S) proxy settings for Socket Mode WebSocket connections, including NO_PROXY exclusions, so proxy-only deployments can connect without a monkey patch. (#62878) Thanks @mjamiv.
- Slack/actions: pass the already resolved read token into `downloadFile` so SecretRef-backed bot tokens no longer fail after a raw config re-read. (#62097) Thanks @martingarramon.
- Network/fetch guard: skip target DNS pinning when trusted env-proxy mode is active so proxy-only sandboxes can let the trusted proxy resolve outbound hosts. (#59007) Thanks @cluster2600.

---

### 📦 v2026.4.9 (2026-04-09)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.4.9)

> [!NOTE]
> **DeXMart-relevant keywords:** `telegram`, `billing`

#### Changes (Features)

- Memory/dreaming: add a grounded REM backfill lane with historical `rem-harness --path`, diary commit/reset flows, cleaner durable-fact extraction, and live short-term promotion integration so old daily notes can replay into Dreams and durable memory without a second memory stack. Thanks @mbelinky.
- Control UI/dreaming: add a structured diary view with timeline navigation, backfill/reset controls, traceable dreaming summaries, and a grounded Scene lane with promotion hints plus a safe clear-grounded action for staged backfill signals. (#63395) Thanks @mbelinky.
- QA/lab: add character-vibes evaluation reports with model selection and parallel runs so live QA can compare candidate behavior faster.
- Plugins/provider-auth: let provider manifests declare `providerAuthAliases` so provider variants can share env vars, auth profiles, config-backed auth, and API-key onboarding choices without core-specific wiring.
- iOS: pin release versioning to an explicit CalVer in `apps/ios/version.json`, keep TestFlight iteration on the same short version until maintainers intentionally promote the next gateway version, and add the documented `pnpm ios:version:pin -- --from-gateway` workflow for release trains. (#63001) Thanks @ngutman.

#### Fixes

- Browser/security: re-run blocked-destination safety checks after interaction-driven main-frame navigations from click, evaluate, hook-triggered click, and batched action flows, so browser interactions cannot bypass the SSRF quarantine when they land on forbidden URLs. (#63226) Thanks @eleqtrizit.
- Security/dotenv: block runtime-control env vars plus browser-control override and skip-server env vars from untrusted workspace `.env` files, and reject unsafe URL-style browser control override specifiers before lazy loading. (#62660, #62663) Thanks @eleqtrizit.
- Gateway/node exec events: mark remote node `exec.started`, `exec.finished`, and `exec.denied` summaries as untrusted system events and sanitize node-provided command/output/reason text before enqueueing them, so remote node output cannot inject trusted `System:` content into later turns. (#62659) Thanks @eleqtrizit.
- Plugins/onboarding auth choices: prevent untrusted workspace plugins from colliding with bundled provider auth-choice ids during non-interactive onboarding, so bundled provider setup keeps operator secrets out of untrusted workspace plugin handlers unless those plugins are explicitly trusted. (#62368) Thanks @pgondhi987.
- Security/dependency audit: force `basic-ftp` to `5.2.1` for the CRLF command-injection fix and bump Hono plus `@hono/node-server` in production resolution paths.
- Android/pairing: clear stale setup-code auth on new QR scans, bootstrap operator and node sessions from fresh pairing, prefer stored device tokens after bootstrap handoff, and pause pairing auto-retry while the app is backgrounded so scan-once Android pairing recovers reliably again. (#63199) Thanks @obviyus.
- Matrix/gateway: wait for Matrix sync readiness before marking startup successful, keep Matrix background handler failures contained, and route fatal Matrix sync stops through channel-level restart handling instead of crashing the whole gateway. (#62779) Thanks @gumadeiras.
- Slack/media: preserve bearer auth across same-origin `files.slack.com` redirects while still stripping it on cross-origin Slack CDN hops, so `url_private_download` image attachments load again. (#62960) Thanks @vincentkoc.
- Reply/doctor: use the active runtime snapshot for queued reply runs, resolve reply-run SecretRefs before preflight helpers touch config, surface gateway OAuth reauth failures to users, and make `openclaw doctor` call out exact reauth commands. (#62693, #63217) Thanks @mbelinky.
- Control UI: guard stale session-history reloads during fast session switches so the selected session and rendered transcript stay in sync. (#62975) Thanks @scoootscooob.
- Gateway/chat: suppress exact and streamed `ANNOUNCE_SKIP` / `REPLY_SKIP` control replies across live chat updates and history sanitization so internal agent-to-agent control tokens no longer leak into user-facing gateway chat surfaces. (#51739) Thanks @Pinghuachiu.
- Auto-reply/NO_REPLY: strip glued leading `NO_REPLY` tokens before reply normalization and ACP-visible streaming so silent sentinel text no longer leaks into user-visible replies while preserving substantive `NO_REPLY ...` text. Thanks @frankekn.
- Sessions/routing: preserve established external routes on inter-session announce traffic so `sessions_send` follow-ups do not steal delivery from Telegram, Discord, or other external channels. (#58013) Thanks @duqaXxX.
- Gateway/sessions: clear auto-fallback-pinned model overrides on `/reset` and `/new` while still preserving explicit user model selections, including legacy sessions created before override-source tracking existed. (#63155) Thanks @frankekn.
- Slack/ACP: treat Slack ACP block replies as visible delivered output so OpenClaw stops re-sending the final fallback text after Slack already rendered the reply. (#62858) Thanks @gumadeiras.
- Slack/partial streaming: key turn-local dedupe by dispatch kind and keep the final fallback reply path active when preview finalization fails so stale preview text cannot suppress the actual final answer. (#62859) Thanks @gumadeiras.
- Matrix/doctor: migrate legacy `channels.matrix.dm.policy: "trusted"` configs back to compatible DM policies during `openclaw doctor --fix`, preserving explicit `allowFrom` boundaries as `allowlist` and defaulting empty legacy configs to `pairing`. (#62942) Thanks @lukeboyett.
- npm packaging: mirror bundled channel runtime deps, stage Nostr runtime deps, derive required root mirrors from manifests and built chunks, and test packed release tarballs without repo `node_modules` so fresh installs fail fast on missing plugin deps instead of crashing at runtime. (#63065) Thanks @scoootscooob.
- QA/live auth: fail fast when live QA scenarios hit classified auth or runtime failure replies, including raw scenario wait paths, and sanitize missing-key guidance so gateway auth problems surface as actionable errors instead of timeouts. (#63333) Thanks @shakkernerd.
- Providers/OpenAI: default missing reasoning effort to `high` on OpenAI Responses, WebSocket, and compatible completions transports, while still honoring explicit per-run reasoning levels.
- Providers/Ollama: allow Ollama models using the native `api: "ollama"` path to optionally display thinking output when `/think` is set to a non-off level. (#62712) Thanks @hoyyeva.
- Codex CLI: pass OpenClaw's system prompt through Codex's `model_instructions_file` config override so fresh Codex CLI sessions receive the same prompt guidance as Claude CLI sessions.
- Auth/profiles: persist explicit auth-profile upserts directly and skip external CLI sync for local writes so profile changes are saved without stale external credential state.
- Agents/timeouts: make the LLM idle timeout inherit `agents.defaults.timeoutSeconds` when configured, disable the unconfigured idle watchdog for cron runs, and point idle-timeout errors at `agents.defaults.llm.idleTimeoutSeconds`. Thanks @drvoss.
- Agents/failover: classify Z.ai vendor code `1311` as billing and `1113` as auth, including long wrapped `1311` payloads, so these errors stop falling through to generic failover handling. (#49552) Thanks @1bcMax.
- QQBot/media-tags: support HTML entity-encoded angle brackets (`&lt;`/`&gt;`), URL slashes in attributes, and self-closing media tags so upstream `<qqimg>` payloads are correctly parsed and normalized. (#60493) Thanks @ylc0919.
- Memory/dreaming: harden grounded backfill inputs, diary writes, status payloads, and diary action classification by preserving source-day labels, rejecting missing or symlinked targets cleanly, normalizing diary headings in gateway backfills, and tightening claim splitting plus diary source metadata. Thanks @mbelinky.
- Memory/dreaming: accept embedded heartbeat trigger tokens so light and REM dreaming still run when runtime wrappers include extra heartbeat text.
- Android/manual connect: allow blank port input only for TLS manual gateway endpoints so standard HTTPS Tailscale hosts default to `443` without silently changing cleartext manual connects. (#63134) Thanks @Tyler-RNG.
- Windows/update: add heap headroom to Windows `pnpm build` steps during dev updates so update preflight builds stop failing on low default Node memory.
- Plugin SDK: export the channel plugin base and web-search config contract through the public package so plugins can use them without private imports.
- Plugins/contracts: keep test-only helpers out of production contract barrels, load shared contract harnesses through bundled test surfaces, and harden guardrails so indirect re-exports and canonical `*.test.ts` files stay blocked. (#63311) Thanks @altaywtf.
- Control UI/models: preserve provider-qualified refs for OpenRouter catalog models whose ids already contain slashes so picker selections submit allowlist-compatible model refs instead of dropping the `openrouter/` prefix. (#63416) Thanks @sallyom.
- Plugin SDK/command auth: split command status builders onto the lightweight `openclaw/plugin-sdk/command-status` subpath while preserving deprecated `command-auth` compatibility exports, so auth-only plugin imports no longer pull status/context warmup into CLI onboarding paths. (#63174) Thanks @hxy91819.

---

### 📦 v2026.4.10 (2026-04-11)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.4.10)

> [!NOTE]
> **DeXMart-relevant keywords:** `whatsapp`, `telegram`

#### Changes (Features)

- Models/Codex: add the bundled Codex provider and plugin-owned app-server harness so `codex/gpt-*` models use Codex-managed auth, native threads, model discovery, and compaction while `openai/gpt-*` stays on the normal OpenAI provider path. (#64298)
- Memory/Active Memory: add a new optional Active Memory plugin that gives OpenClaw a dedicated memory sub-agent right before the main reply, so ongoing chats can automatically pull in relevant preferences, context, and past details without making users remember to manually say "remember this" or "search memory" first. Includes configurable message/recent/full context modes, live `/verbose` inspection, advanced prompt/thinking overrides for tuning, and opt-in transcript persistence for debugging. Docs: https://docs.openclaw.ai/concepts/active-memory. (#63286) Thanks @Takhoffman.
- macOS/Talk: add an experimental local MLX speech provider for Talk Mode, with explicit provider selection, local utterance playback, interruption handling, and system-voice fallback. (#63539) Thanks @ImLukeF.
- Tools/video generation: add Seedance 2.0 model refs to the bundled fal provider and submit the provider-specific duration, resolution, audio, and seed metadata fields needed for live Seedance 2.0 runs.
- Microsoft Teams: add message actions for pin, unpin, read, react, and listing reactions. (#53432) Thanks @sudie-codes.
- QA/Matrix: add a live `openclaw qa matrix` lane backed by a disposable Matrix homeserver, shared live-transport seams, and Matrix-specific transport coverage for threading, reactions, restart, and allowlist behavior. (#64489) Thanks @gumadeiras.
- QA/Telegram: add a live `openclaw qa telegram` lane for private-group bot-to-bot checks, harden its artifact handling, and preserve native Telegram command reply threading for QA verification. (#64303) Thanks @obviyus.
- QA/testing: add a `--runner multipass` lane for `openclaw qa suite` so repo-backed QA scenarios can run inside a disposable Linux VM and write back the usual report, summary, and VM logs. (#63426) Thanks @shakkernerd.
- CLI/exec policy: add a local `openclaw exec-policy` command with `show`, `preset`, and `set` subcommands for synchronizing requested `tools.exec.*` config with the local exec approvals file, plus follow-up hardening for node-host rejection, rollback safety, and sync conflict detection. (#64050)
- Gateway: add a `commands.list` RPC so remote gateway clients can discover runtime-native, text, skill, and plugin commands with surface-aware naming and serialized argument metadata. (#62656) Thanks @samzong.
- Models/providers: add per-provider `models.providers.*.request.allowPrivateNetwork` for trusted self-hosted OpenAI-compatible endpoints, keep the opt-in scoped to model request surfaces, and refresh cached WebSocket managers when request transport overrides change. (#63671) Thanks @qas.
- Feishu: standardize request user agents and register the bot as an AI agent so Feishu deployments identify OpenClaw consistently. (#63835) Thanks @evandance.
- Matrix/partial streaming: add MSC4357 live markers to draft preview sends and edits so supporting Matrix clients can render a live/typewriter animation and stop it when the final edit lands. (#63513) Thanks @TigerInYourDream.
- Control UI/dreaming: simplify the Scene and Diary surfaces, preserve unknown phase state for partial status payloads, and stabilize waiting-entry recency ordering so Dreaming status and review lists stay clear and deterministic. (#64035) Thanks @davemorin.
- Agents: add an opt-in strict-agentic embedded Pi execution contract for GPT-5-family runs so plan-only or filler turns keep acting until they hit a real blocker. (#64241) Thanks @100yenadmin.
- Agents/OpenAI: add provider-owned OpenAI/Codex tool schema compatibility and surface embedded-run replay/liveness state for long-running runs. (#64300) Thanks @100yenadmin.
- Docs i18n: chunk raw doc translation, reject truncated tagged outputs, avoid ambiguous body-only wrapper unwrapping, and recover from terminated Pi translation sessions without changing the default `openai/gpt-5.4` path. (#62969, #63808) Thanks @hxy91819.

#### Fixes

- Browser/security: tighten browser and sandbox navigation defenses across strict SSRF defaults, hostname allowlists, interaction-driven redirects, subframes, CDP discovery, existing sessions, tab actions, noVNC, marker-span sanitization, and Docker CDP source-range enforcement. (#61404, #63332, #63882, #63885, #63889, #64367, #64370, #64371)
- Security/tools: harden exec preflight reads, host env denylisting, node output boundaries, outbound host-media reads, profile-mutation authorization, plugin install dependency scanning, ACPX tool hooks, Gmail watcher token redaction, and oversized realtime WebSocket frame handling. (#62333, #62661, #62662, #63277, #63551, #63553, #63886, #63890, #63891, #64459)
- OpenAI/Codex: add required Codex OAuth scopes, classify provider/runtime failures more clearly, stop suggesting `/elevated full` when auto-approved host exec is unavailable, add OpenAI/Codex tool-schema compatibility, and preserve embedded-run replay/liveness truth across compaction retries and mutating side effects. (#64300, #64439) Thanks @100yenadmin.
- CLI/WhatsApp media sends: route gateway-mode outbound sends with `--media` through the channel `sendMedia` path and preserve media access context, so WhatsApp document and attachment sends stop silently dropping the file while still delivering the caption. (#64478, #64492) Thanks @ShionEria.
- Microsoft Teams: restore media downloads for personal DMs, Bot Framework `a:` conversations, OneDrive/SharePoint shared files, and Graph-backed chat IDs; accept Bot Framework audience tokens; prevent feedback-learning filename collisions; keep long tool chains alive with typing indicators; add SSO sign-in callbacks; inject parent context for thread replies; and deliver cron announcements to Teams conversation IDs. (#54932, #55383, #55386, #58001, #58249, #58774, #59731, #60956, #62219, #62674, #63063, #63942, #63945, #63949, #63951, #63953, #64087, #64088, #64089)
- Gateway/tailscale: start Tailscale exposure and the gateway update check before awaiting channel and plugin sidecar startup so remote operators are not locked out when startup sidecars stall.
- Gateway/startup: keep WebSocket RPC available while channels and plugin sidecars start, hold `chat.history` unavailable until startup sidecars finish so synchronous history reads cannot stall startup (reported in #63450), refresh advertised gateway methods after deferred plugin reloads, and enforce the pre-auth WebSocket upgrade budget before the no-handler 503 path so upgrade floods cannot bypass connection limits during that window. (#63480) Thanks @neeravmakwana.
- WhatsApp: keep inbound replies, media, composing indicators, and queued outbound deliveries attached to the current socket across reconnect gaps, including fresh retry-eligible sends after the listener comes back. (#30806, #46299, #62892, #63916) Thanks @mcaxtr.
- Gateway/thread routing: preserve Slack, Telegram, Mattermost, Matrix, ACP, restart-sentinel, and agent announce delivery targets so subagent, cron, stream-relay, session fallback, and restart messages land back in the originating thread, topic, or room casing. (#54840, #57056, #63143, #63228, #63506, #64343, #64391)
- Models/fallback: preserve `/models` selection across transient primary-model failures and config reloads, allow timeout cooldown probes, classify OpenRouter no-endpoints responses, detect llama.cpp context overflows, and keep provider/runtime context metadata stable through reloads. (#61472, #64196, #64471)
- Agents/BTW: keep `/btw` side questions working after tool-use turns by stripping replayed tool blocks, hidden reasoning, and malformed image payloads, omitting empty tool arrays, allowing Bedrock `auth: "aws-sdk"`, and routing Feishu `/btw` plus `/stop` through bounded out-of-band lanes. (#64218, #64219, #64225, #64324) Thanks @ngutman.
- Control UI/BTW: render `/btw` side results as dismissible ephemeral cards in the browser, send `/btw` immediately during active runs, and clear stale BTW cards on reset flows so webchat matches the intended detached side-question behavior. (#64290) Thanks @ngutman.
- Commands/targeting: use the selected agent or session for command output, send policy, usage/cost, context reports, model lists, bash sandbox hints, BTW/compact working directories, plugin commands, and session exports so multi-agent commands describe and mutate the intended target instead of the requester.
- Conversation bindings: normalize focused/current conversation ids, preserve binding metadata on account and Discord rebinds, avoid stale Discord lifecycle windows, and keep generic activity touches persisted so reply routing survives rebinds and restarts.
- iMessage/self-chat: distinguish normal DM outbound rows from true self-chat using `destination_caller_id` plus chat participants, preserve multi-handle self-chat aliases, drop ambiguous reflected echoes, and strip wrapped imsg RPC text fields. (#61619, #63868, #63980, #63989, #64000) Thanks @neeravmakwana.
- Matrix: keep multi-account room scoping consistent, keep packaged crypto migrations warning-only when appropriate, preserve ordered block streaming, add explicit Matrix block-streaming opt-in, and resolve verification/bootstrap from the packaged runtime entry. (#58449, #59249, #59266, #64373) Thanks @gumadeiras.
- Telegram/security: tighten Telegram `allowFrom` sender validation and keep `/whoami` allowlist reporting in sync with command auth checks.
- Agents/timeouts: extend the default LLM idle window to 120s and keep silent no-token idle timeouts on recovery paths, so slow models can retry or fall back before users see an error.
- Gateway/agents: preserve configured model selection and richer `IDENTITY.md` content across agent create/update flows and workspace moves, and fail safely instead of silently overwriting unreadable identity files. (#61577) Thanks @samzong.
- Skills/TaskFlow: restore valid frontmatter fences for the bundled `taskflow` and `taskflow-inbox-triage` skills and copy bundled `SKILL.md` files as hard dist-runtime copies so skills stay discoverable and loadable after updates. (#64166, #64469) Thanks @extrasmall0.
- Skills: respect overridden home directories when loading personal skills so service, test, and custom launch environments read the intended user skill directory instead of the process home.
- Windows/exec: settle supervisor waits from child exit state after stdout and stderr drain even when `close` never arrives, so CLI commands stop hanging or dying with forced `SIGKILL` on Windows. (#64072) Thanks @obviyus.
- Browser/sandbox: prevent sandbox browser CDP startup hangs by recreating containers when the browser security hash changes and by waiting on the correct sandbox browser lifecycle. (#62873) Thanks @Syysean.
- QQBot/streaming: make block streaming configurable per QQ bot account via `streaming.mode` (`"partial"` | `"off"`, default `"partial"`) instead of hardcoding it off, so responses can be delivered incrementally. (#63746)
- QQBot/config: allow extra fields in `channels.qqbot` and `channels.qqbot.accounts.*` so extended qqbot builds can add new config options without gateway startup failing on schema validation. (#64075) Thanks @WideLee.
- Dreaming/gateway: require `operator.admin` for persistent `/dreaming on|off` changes and treat missing gateway client scopes as unprivileged instead of silently allowing config writes. (#63872) Thanks @mbelinky.
- Gateway/pairing: prefer explicit QR bootstrap auth over earlier Tailscale auth classification so iOS `/pair qr` silent bootstrap pairing does not fall through to `pairing required`. (#59232) Thanks @ngutman.
- Browser/control: auto-generate browser-control auth tokens for `none` and `trusted-proxy` modes, and route browser auth/profile/doctor helpers through the public browser plugin facades. (#63280, #63957) Thanks @pgondhi987.
- Browser/act: centralize `/act` request normalization and execution dispatch while adding stable machine-readable route-level error codes for invalid requests, selector misuse, evaluate-disabled gating, target mismatch, and existing-session unsupported actions. (#63977) Thanks @joshavant.
- Security/QQBot: enforce media storage boundaries for all outbound local file paths and route image-size probes through SSRF-guarded media fetching instead of raw `fetch()`. (#63271, #63495) Thanks @pgondhi987.
- Channel setup: ignore workspace plugin shadows when resolving trusted channel setup catalog entries so onboarding and setup flows keep using the bundled, trusted setup contract.
- Gateway/memory startup: load the explicitly selected memory-slot plugin during gateway startup, while keeping restrictive allowlists and implicit default memory slots from auto-starting unrelated memory plugins. (#64423) Thanks @EronFan.
- Config/plugins: let config writes keep disabled plugin entries without forcing required plugin config schemas or crashing raw plugin validation, and avoid re-activating plugin registry state during schema checks. (#54971, #63296) Thanks @fuller-stack-dev.
- Config validation: surface the actual offending field for strict-schema union failures in bindings, including top-level unexpected keys on the matching ACP branch. (#40841) Thanks @Hollychou924.
- Wizard/plugin config: coerce integer-typed plugin config fields from interactive text input so integer schema values persist as numbers instead of failing validation. (#63346) Thanks @jalehman.
- Daemon/gateway install: preserve safe custom service env vars on forced reinstall, merge prior custom PATH segments behind the managed service PATH, and stop removed managed env keys from persisting as custom carryover. (#63136) Thanks @WarrenJones.
- Cron/scheduling: treat `nextRunAtMs <= 0` as invalid across cron update, maintenance, timer, and stale-delivery paths so corrupted zero timestamps self-heal instead of causing immediate runs or skipped deliveries. (#63507) Thanks @WarrenJones.
- Cron/auth: resolve auth profiles consistently for isolated cron jobs so scheduled runs use the same configured provider credentials as interactive sessions. (#62797) Thanks @neeravmakwana.
- Tasks: let `openclaw tasks cancel` cancel stuck background tasks that never reached a normal terminal state. (#62506) Thanks @neeravmakwana.
- Sessions/model selection: preserve catalog-backed session model labels, provider-qualified context limits, and already-qualified session model refs when catalog metadata is unavailable, so model selection and memory/context budgets survive reloads without bogus provider prefixes. (#61382, #62493) Thanks @Mule-ME.
- Status: show configured fallback models in `/status` and shared session status cards so per-agent fallback configuration is visible before a live failover happens. (#33111) Thanks @AnCoSONG.
- `/context detail` now compares the tracked prompt estimate with cached context usage and surfaces untracked provider/runtime overhead when present. (#28391) Thanks @ImLukeF.
- Gateway/sessions: scope bare `sessions.create` aliases like `main` to the requested agent while preserving the canonical `global` and `unknown` sentinel keys. (#58207) Thanks @jalehman.
- Gateway/session reset: emit the typed `before_reset` hook for gateway `/new` and `/reset`, preserving reset-hook behavior even when the previous transcript has already been archived. (#53872) Thanks @VACInc.
- Plugins/commands: pass the active host `sessionKey` into plugin command contexts, and include `sessionId` when it is already available from the active session entry, so bundled and third-party commands can resolve the current conversation reliably. (#59044) Thanks @jalehman.
- Agents/auth: honor `models.providers.*.authHeader` for pi embedded runner model requests by injecting `Authorization: Bearer <apiKey>` when requested. (#54390) Thanks @lndyzwdxhs.
- Claude CLI: clear inherited Anthropic auth/header environment aliases before spawning Claude Code and add sanitized CLI backend auth-env diagnostics for debugging gateway-run provider selection.
- Agents/failover: classify AbortError and stream-abort messages as timeout so Ollama NDJSON stream aborts stop showing `reason=unknown` in model fallback logs. (#58324) Thanks @yelog.
- Fireworks/FirePass: disable Kimi K2.5 Turbo reasoning output by forcing thinking off on the FirePass path and hardening the provider wrapper so hidden reasoning no longer leaks into visible replies. (#63607) Thanks @frankekn.
- Discord: update Carbon to v0.15.0. Thanks @thewilloftheshadow.
- Config/Discord: coerce safe integer numeric Discord IDs to strings during config validation, keep unsafe or precision-losing numeric snowflakes rejected, and align `openclaw doctor` repair guidance with the same fail-closed behavior. (#45125) Thanks @moliendocode.
- BlueBubbles/config: accept `enrichGroupParticipantsFromContacts` in the core strict config schema so gateways no longer fail validation or startup when the BlueBubbles plugin writes that field. (#56889) Thanks @zqchris.
- Feishu/webhooks: read webhook bodies through the pre-auth guard so unauthenticated webhook traffic stays under the same body budget as other protected channel ingress paths.
- Tools/web_fetch: add an opt-in `tools.web.fetch.ssrfPolicy.allowRfc2544BenchmarkRange` config so fake-IP proxy environments that resolve public sites into `198.18.0.0/15` can use `web_fetch` without weakening the default SSRF block. (#61830) Thanks @xing-xing-coder.
- Dreaming/cron: reconcile managed dreaming cron from startup config and runtime lifecycle changes, but only recover managed dreaming cron state during heartbeat-triggered dreaming checks so ordinary chat traffic does not recreate removed jobs. (#63873, #63929, #63938) Thanks @mbelinky.
- Memory/lancedb: accept `dreaming` config when `memory-lancedb` owns the memory slot so Dreaming surfaces can read slot-owner settings without schema rejection. (#63874) Thanks @mbelinky.
- Control UI/dreaming: keep the Dreaming trace area contained and scrollable so overlays no longer cover tabs or blow out the page layout. (#63875) Thanks @mbelinky.
- Dreaming/narrative: harden request-scoped diary fallback so scheduled dreaming only falls back on the dedicated subagent-runtime error, stop trusting spoofable raw error-code objects, and avoid leaking workspace paths when local fallback writes fail. (#64156) Thanks @mbelinky.
- Dreaming/diary: add idempotent narrative subagent runs, preserve restrictive `DREAMS.md` permissions during atomic writes, and surface temp cleanup failures so repeated sweeps do not double-run the same narrative request or silently weaken diary safety. (#63876) Thanks @mbelinky.
- Heartbeats/sessions: remove stale accumulated isolated heartbeat session keys when the next tick converges them back to the canonical sibling, so repaired sessions stop showing orphaned `:heartbeat:heartbeat` variants in session listings. (#59606) Thanks @rogerdigital.
- Gateway/run cleanup: fix stale run-context TTL cleanup so the new maintenance sweep resets orphaned run sequence state and prevents unbounded run-context growth. (#52731) Thanks @artwalker.
- UI/compaction: keep the compaction indicator in a retry-pending state until the run actually finishes, so the UI does not show `Context compacted` before compaction actually finishes. (#55132) Thanks @mpz4life.
- Cron/tool schemas: keep cron tool schemas strict-model-friendly while still preserving `failureAlert=false`, nullable `agentId`/`sessionKey`, and flattened add/update recovery for the newly exposed cron job fields. (#55043) Thanks @brunolorente.
- Git metadata: read commit ids from packed refs as well as loose refs so version and status metadata stay accurate after repository maintenance. (#63943)
- Gateway: keep `commands.list` skill entries categorized under tools and include provider-aware plugin `nativeName` metadata even when `scope=text`, so remote clients can group skills correctly and map text-surface plugin commands back to native aliases. (#64147)
- TUI: reset footer activity to idle when switching sessions so a stale streaming indicator cannot persist after the selection changes. (#63988) Thanks @neeravmakwana.
- Claude CLI: stop marking spawned Claude Code runs as host-managed so they keep using normal CLI subscription behavior. (#64023) Thanks @Alex-Alaniz.
- Codex auth: brand Codex OAuth flows as OpenClaw in user-visible auth prompts and diagnostics.
- Gateway/pairing: fail closed for paired device records that have no device tokens, and reject pairing approvals whose requested scopes do not match the requested device roles.
- ACP/gateway chat: classify lifecycle errors before forwarding them to ACP clients so refusals use ACP's refusal stop reason while transient backend errors continue to finish as normal turns.
- Claude CLI/skills: pass eligible OpenClaw skills into CLI runs, including native Claude Code skill resolution via a temporary plugin plus per-run skill env/API key injection. (#62686, #62723) Thanks @zomars.
- Discord: keep generated auto-thread names working with reasoning models by giving title generation enough output budget for thinking plus visible title text. (#64172) Thanks @hanamizuki.
- Heartbeat: ignore doc-only Markdown fence markers in the default `HEARTBEAT.md` template so comment-only heartbeat scaffolds skip API calls again. (#61690, #63434) Thanks @ravyg.
- Reply/skills: keep resolved skill and memory secret config stable through embedded reply runs so raw SecretRefs in secondary skill settings no longer crash replies when the gateway already has the live env. (#64249) Thanks @mbelinky.
- Dreaming/startup: keep plugin-registered startup hooks alive across workspace hook reloads and include dreaming startup owners in the gateway startup plugin scope, so managed Dreaming cron registration comes back reliably after gateway boot. (#62327, #64258) Thanks @mbelinky.
- Plugins: treat duplicate `registerService` calls from the same plugin id as idempotent so snapshot and activation loads no longer emit spurious `service already registered` diagnostics. (#62033, #64128) Thanks @ly85206559.
- Discord/TTS: route auto voice replies through the native voice-note path so Discord receives Opus voice messages instead of regular audio attachments. (#64096) Thanks @LiuHuaize.
- Config/plugins: use plugin-owned command alias metadata when `plugins.allow` contains runtime command names like `dreaming`, and point users at the owning plugin instead of stale plugin-not-found guidance. (#64191, #64242) Thanks @feiskyer.
- Agents/Gemini: strip orphaned `required` entries from Gemini tool schemas so provider validation no longer rejects tools after schema cleanup or union flattening. (#64284) Thanks @xxxxxmax.
- Assistant text: strip Qwen-style XML tool call payloads from visible replies so web and channel messages no longer show raw `<tool_call><function=...>` output. (#63999, #64214) Thanks @MoerAI.
- Daemon/gateway: prevent systemd restart storms on configuration errors by exiting with `EX_CONFIG` and adding generated unit restart-prevention guards. (#63913) Thanks @neo1027144-creator.
- Agents/exec: prevent gateway crash ("Agent listener invoked outside active run") when a subagent exec tool produces stdout/stderr after the agent run has ended or been aborted. (#62821) Thanks @openperf.
- Gateway/OpenAI compat: return real `usage` for non-stream `/v1/chat/completions` responses, emit the final usage chunk when `stream_options.include_usage=true`, and bound usage-gated stream finalization after lifecycle end. (#62986) Thanks @Lellansin.
- Agents/subagents: deduplicate delivered completion announces so retry or re-entry cleanup does not inject duplicate internal-context completion turns into the parent session. (#61525) Thanks @100yenadmin.
- Agents/exec: keep sandboxed `tools.exec.host=auto` sessions from honoring per-call `host=node` or `host=gateway` overrides while a sandbox runtime is active, and stop advertising node routing in that state so exec stays on the sandbox host. (#63880)
- Agents/subagents: preserve archived delete-mode runs until `sessions.delete` succeeds and prevent overlapping archive sweeps from duplicating in-flight cleanup attempts. (#61801) Thanks @100yenadmin.
- Cron/isolated agent: run scheduled agent turns as non-owner senders so owner-only tools stay unavailable during cron execution. (#63878)
- Discord/sandbox: include `image` in sandbox media param normalization so Discord event cover images cannot bypass sandbox path rewriting. (#64377) Thanks @mmaps.
- Agents/exec: extend exec completion detection to cover local background exec formats so the owner-downgrade fires correctly for all exec paths. (#64376) Thanks @mmaps.
- Hooks/security: mark agent hook system events as untrusted and sanitize hook display names before cron metadata reuse. (#64372) Thanks @eleqtrizit.
- Daemon/launchd: keep `openclaw gateway stop` persistent without uninstalling the macOS LaunchAgent, re-enable it on explicit restart or repair, and harden launchd label handling. (#64447) Thanks @ngutman.
- Plugins/context engines: preserve `plugins.slots.contextEngine` through normalization and keep explicitly selected workspace context-engine plugins enabled, so loader diagnostics and plugin activation stop dropping that slot selection. (#64192) Thanks @hclsys.
- Heartbeat: stop top-level `interval:` and `prompt:` fields outside the `tasks:` block from bleeding into the last parsed heartbeat task. (#64488) Thanks @Rahulkumar070.
- Agents/OpenAI replay: preserve malformed function-call arguments in stored assistant history, avoid double-encoding preserved raw strings on replay, and coerce replayed string args back to objects at Anthropic and Google provider boundaries. (#61956) Thanks @100yenadmin.
- Heartbeat/config: accept and honor `agents.defaults.heartbeat.timeoutSeconds` and per-agent heartbeat timeout overrides for heartbeat agent turns. (#64491) Thanks @cedillarack.
- CLI/devices: make implicit `openclaw devices approve` selection preview-only and require approving the exact request ID, preventing latest-request races during device pairing. (#64160) Thanks @coygeek.
- Media/security: honor sender-scoped `toolsBySender` policy for outbound host-media reads so denied senders cannot trigger host file disclosure via attachment hydration. (#64459) Thanks @eleqtrizit.
- Browser/security: reject strict-policy hostname navigation unless the hostname is an explicit allowlist exception or IP literal, and route CDP HTTP discovery through the pinned SSRF fetch path. (#64367) Thanks @eleqtrizit.
- Models/vLLM: ignore empty `tool_calls` arrays from reasoning-model OpenAI-compatible replies, reset false `toolUse` stop reasons when no actual tool calls were parsed, and stop sending `tool_choice` unless tools are present so vLLM reasoning responses no longer hang indefinitely. (#61197, #61534) Thanks @balajisiva.

---

### 📦 v2026.4.11 (2026-04-12)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.4.11)

> [!NOTE]
> **DeXMart-relevant keywords:** `whatsapp`, `telegram`

#### Changes (Features)

- Dreaming/memory-wiki: add ChatGPT import ingestion plus new `Imported Insights` and `Memory Palace` diary subtabs so Dreaming can inspect imported source chats, compiled wiki pages, and full source pages directly from the UI. (#64505)
- Control UI/webchat: render assistant media/reply/voice directives as structured chat bubbles, add the `[embed ...]` rich output tag, and gate external embed URLs behind config. (#64104)
- Tools/video_generate: add URL-only generated asset delivery, typed `providerOptions`, reference audio inputs, per-asset role hints, `adaptive` aspect-ratio support, and a higher image-input cap so video providers can expose richer generation modes without forcing large files into memory. (#61987, #61988) Thanks @xieyongliang.
- Feishu: improve document comment sessions with richer context parsing, comment reactions, and typing feedback so document-thread conversations behave more like chat conversations. (#63785)
- Microsoft Teams: add reaction support, reaction listing, Graph pagination, and delegated OAuth setup for sending reactions while preserving application-auth read paths. (#51646)
- Plugins: allow plugin manifests to declare activation and setup descriptors so plugin setup flows can describe required auth, pairing, and configuration steps without hardcoded core special cases. (#64780)
- Ollama: cache `/api/show` context-window and capability metadata during model discovery so repeated picker refreshes stop refetching unchanged models, while still retrying after empty responses and invalidating on digest changes. (#64753) Thanks @ImLukeF.
- Models/providers: surface how configured OpenAI-compatible endpoints are classified in embedded-agent debug logs, so local and proxy routing issues are easier to diagnose. (#64754) Thanks @ImLukeF.
- QA/parity: add the GPT-5.4 vs Opus 4.6 agentic parity report gate with shared scenario coverage checks, stricter evidence heuristics, and skipped-scenario accounting for maintainer review. (#64441) Thanks @100yenadmin.

#### Fixes

- OpenAI/Codex OAuth: stop rewriting the upstream authorize URL scopes so new Codex sign-ins do not fail with `invalid_scope` before returning an authorization code. (#64713) Thanks @fuller-stack-dev.
- Audio transcription: disable pinned DNS only for OpenAI-compatible multipart requests, while still validating hostnames, so OpenAI, Groq, and Mistral transcription works again without weakening other request paths. (#64766) Thanks @GodsBoy.
- macOS/Talk Mode: after granting microphone permission on first enable, continue starting Talk Mode instead of requiring a second toggle. (#62459) Thanks @ggarber.
- Control UI/webchat: persist agent-run TTS audio replies into webchat history and preserve interleaved tool card pairing so generated audio and mixed tool output stay attached to the right messages. (#63514) Thanks @bittoby.
- WhatsApp: honor the configured default account when the active listener helper is used without an explicit account id, so named default accounts do not get registered under `default`. (#53918) Thanks @yhyatt.
- ACP/agents: suppress commentary-phase child assistant relay text in ACP parent stream updates, so spawned child runs stop leaking internal progress chatter into the parent session. Thanks @vincentkoc.
- Agents/timeouts: honor explicit run timeouts in the LLM idle watchdog and align default timeout config so slow models can keep working until the configured limit instead of using the wrong idle window.
- Config: include `asyncCompletion` in the generated zod schema so documented async completion config no longer fails with an unrecognized-key error. (#63618)
- Google/Veo: stop sending the unsupported `numberOfVideos` request field so Gemini Developer API Veo runs do not fail before OpenClaw can complete the intended Google video generation path. (#64723) Thanks @velvet-shark.
- QA/packaging: stop packaged CLI startup and completion cache generation from reading repo-only QA scenario markdown, ship the bundled QA scenario pack in npm releases, and keep `openclaw completion --write-state` working even if QA setup is broken. (#64648) Thanks @obviyus.
- Codex/QA: keep Codex app-server coordination chatter out of visible replies, add a live QA leak scenario, and classify leaked harness meta text as a QA failure instead of a successful reply. Thanks @vincentkoc.
- WhatsApp: route `message react` through the gateway-owned action path so reactions use the live WhatsApp listener in both DM and group chats, matching `message send` and `message poll`. Thanks @mcaxtr.
- Auto-reply/WhatsApp: preserve inbound image attachment notes after media understanding so image edits keep the real saved media path instead of hallucinating a missing local path. (#64918) Thanks @ngutman.
- Telegram/sessions: keep topic-scoped session initialization on the canonical topic transcript path when inbound turns omit `MessageThreadId`, so one topic session no longer alternates between bare and topic-qualified transcript files. (#64869) Thanks @jalehman.
- Agents/failover: scope assistant-side fallback classification and surfaced provider errors to the current attempt instead of stale session history, so cross-provider fallback runs stop inheriting the previous provider's failure. (#62907) Thanks @stainlu.
- MiniMax/OAuth: write `api: "anthropic-messages"` and `authHeader: true` into the `minimax-portal` config patch during `openclaw configure`, so re-authenticated portal setups keep Bearer auth routing working. (#64964) Thanks @ryanlee666.

---

### 📦 v2026.4.12 (2026-04-13)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.4.12)

> [!NOTE]
> **DeXMart-relevant keywords:** `whatsapp`, `telegram`

*No structured changelog available. See [release notes](https://github.com/openclaw/openclaw/releases/tag/v2026.4.12).*

---

### 📦 v2026.4.14 (2026-04-14)

[Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.4.14)

> [!CAUTION]
> **Injection Point Impact Detected:**
> - **src/web/session.ts** (matched: `baileys`)

> [!NOTE]
> **DeXMart-relevant keywords:** `whatsapp`, `telegram`

*No structured changelog available. See [release notes](https://github.com/openclaw/openclaw/releases/tag/v2026.4.14).*

---

## 🔍 Status Summary

1. **DeXMart Last Synced Version:** v2026.3.2
2. **Upstream Target Version:** v2026.4.14
3. **Versions in Gap:** 19 (19 stable, 0 beta)
4. **Breaking Changes:** 31
5. **Injection Point Conflicts:** 4 version(s)

---

**Report Generated:** 2026-04-15 01:12:54
**Generated By:** `scripts/automation/upstream-watcher.ts --gap-analysis`
