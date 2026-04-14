# Test Suite Triage Report

## Overview
Total Failing Files: 138

### Category A: OpenClaw Engine Internal Tests (79 files)
**Root Cause**: These are OpenClaw upstream tests that depend on internal mocking infrastructure and test utilities that weren't fully ported during the Phase 1 repository restructure.

**Remediation Action**: **DO NOT FIX MANUALLY**. Mark tests with `.skip` and a `// upstream: pending sync` annotation. These failures must be resolved collectively by executing a dedicated **Upstream Sync Conductor Track** to cherry-pick upstream OpenClaw commits (e.g. up to `2026.4.14`), ensuring we avoid divergent test infrastructure and merge conflicts.

**Failing Files**:
- `src/auto-reply/reply.media-note.test.ts`
- `src/auto-reply/status.test.ts`
- `src/browser/chrome-extension-background-utils.test.ts`
- `src/browser/chrome-extension-options-validation.test.ts`
- `src/agents/pi-embedded-subscribe.tools.extract.test.ts`
- `src/config/normalize-paths.test.ts`
- `src/commands/agent.acp.test.ts`
- `src/commands/agent.test.ts`
- `src/commands/channels.add.test.ts`
- `src/commands/channels.adds-non-default-telegram-account.test.ts`
- `src/commands/onboard-channels.test.ts`
- `src/commands/channels.surfaces-signal-runtime-errors-channels-status-output.test.ts`
- `src/commands/doctor-config-flow.test.ts`
- `src/commands/health.snapshot.test.ts`
- `src/cron/isolated-agent.subagent-model.test.ts`
- `src/gateway/server.agent.gateway-server-agent-b.test.ts`
- `src/gateway/system-run-approval-binding.contract.test.ts`
- `src/infra/exec-approvals-parity.test.ts`
- `src/infra/heartbeat-runner.ghost-reminder.test.ts`
- `src/infra/heartbeat-runner.transcript-prune.test.ts`
- `src/infra/heartbeat-runner.model-override.test.ts`
- `src/infra/heartbeat-runner.respects-ackmaxchars-heartbeat-acks.test.ts`
- `src/infra/heartbeat-runner.sender-prefers-delivery-target.test.ts`
- `src/infra/path-env.test.ts`
- `src/infra/provider-usage.test.ts`
- `src/infra/system-run-approval-mismatch.contract.test.ts`
- `src/infra/system-run-command.contract.test.ts`
- `src/infra/watch-node.test.ts`
- `src/auto-reply/reply/reply-flow.test.ts`
- `src/agents/tools/memory-tool.citations.test.ts`
- `src/agents/tools/memory-tool.test.ts`
- `src/commands/onboarding/plugin-install.test.ts`
- `src/infra/outbound/message-action-runner.test.ts`
- `src/infra/outbound/message-action-runner.threading.test.ts`
- `src/infra/outbound/outbound.test.ts`
- `src/infra/outbound/targets.test.ts`
- `src/auto-reply/inbound.test.ts`
- `src/auto-reply/reply.directive.directive-behavior.applies-inline-reasoning-mixed-messages-acks-immediately.test.ts`
- `src/auto-reply/reply.directive.directive-behavior.defaults-think-low-reasoning-capable-models-no.test.ts`
- `src/auto-reply/reply.directive.directive-behavior.prefers-alias-matches-fuzzy-selection-is-ambiguous.test.ts`
- `src/auto-reply/reply.directive.directive-behavior.shows-current-verbose-level-verbose-has-no.test.ts`
- `src/auto-reply/reply.triggers.trigger-handling.targets-active-session-native-stop.test.ts`
- `src/browser/chrome-extension-manifest.test.ts`
- `src/browser/paths.test.ts`
- `src/agents/models-config.auto-injects-github-copilot-provider-token-is.test.ts`
- `src/agents/models-config.falls-back-default-baseurl-token-exchange-fails.test.ts`
- `src/agents/models-config.fills-missing-provider-apikey-from-env-var.test.ts`
- `src/agents/models-config.normalizes-gemini-3-ids-preview-google-providers.test.ts`
- `src/agents/models-config.preserves-explicit-reasoning-override.test.ts`
- `src/agents/models-config.skips-writing-models-json-no-env-token.test.ts`
- `src/agents/models-config.uses-first-github-copilot-profile-env-tokens.test.ts`
- `src/agents/openclaw-tools.subagents.sessions-spawn.lifecycle.test.ts`
- `src/agents/pi-tools.read.host-edit-access.test.ts`
- `src/agents/sandbox-agent-config.agent-specific-sandbox-config.test.ts`
- `src/agents/sandbox-skills.test.ts`
- `src/agents/skills.loadworkspaceskillentries.test.ts`
- `src/agents/skills.summarize-skill-description.test.ts`
- `src/agents/subagent-announce.format.test.ts`
- `src/agents/workspace-templates.test.ts`
- `src/agents/workspace.test.ts`
- `src/config/commands.test.ts`
- `src/config/config.nix-integration-u3-u5-u9.test.ts`
- `src/commands/agents.bind.commands.test.ts`
- `src/commands/openai-codex-oauth.test.ts`
- `src/cron/cron-protocol-conformance.test.ts`
- `src/cron/isolated-agent.auth-profile-propagation.test.ts`
- `src/cron/isolated-agent.delivers-response-has-heartbeat-ok-but-includes.test.ts`
- `src/cron/isolated-agent.direct-delivery-forum-topics.test.ts`
- `src/cron/isolated-agent.skips-delivery-without-whatsapp-recipient-besteffortdeliver-true.test.ts`
- `src/cron/isolated-agent.uses-last-non-empty-agent-text-as.test.ts`
- `src/gateway/gateway.test.ts`
- `src/gateway/server-node-events.test.ts`
- `src/gateway/server.skills-status.test.ts`
- `src/infra/exec-safe-bin-policy.test.ts`
- `src/infra/host-env-security.policy-parity.test.ts`
- `src/infra/restart.test.ts`
- `src/infra/run-node.test.ts`
- `src/auto-reply/reply/reply-plumbing.test.ts`
- `src/auto-reply/reply/session.test.ts`

### Category B: Telegram Module (5 files)
**Root Cause**: Mixed — webhook tests time out at 5000ms, createTelegramBot mock returns incompatible shape, resolveTelegramFetch tests expect specific undici dispatcher behavior.

**Remediation Action**: Fix webhook mock to resolve/reject properly; update createTelegramBot mock shape; increase timeout or fix async flow.

**Failing Files**:
- `src/telegram/bot.create-telegram-bot.test.ts`
- `src/telegram/bot.test.ts`
- `src/telegram/bot.media.stickers-and-fragments.test.ts`
- `src/telegram/fetch.test.ts`
- `src/telegram/webhook.test.ts`

### Category C: Baileys/Session Mocks (1 files) ✅ RESOLVED
**Root Cause**: The mock Baileys socket in `test/mocks/baileys.ts` used `vi.fn()` for `ev.on` and `ev.emit`. This meant event handlers registered by `session.ts` (e.g. for `creds.update`) were swallowed and never fired during tests.

**Remediation Action**: Backed the mock socket's `ev` with a real `EventEmitter` wrapped with `vi.spyOn`, and updated `getLastSocket()` to correctly handle object-type sockets.

**Failing Files**:
- `src/web/session.test.ts`

### Category D: Stale DeXMart Service Tests (9 files)
**Root Cause**: Tests assert pre-Phase 4/5 behavior (e.g., IngressService expects unifiedAI.processMessage()).

**Remediation Action**: Update test expectations to match current production code behavior.

**Failing Files**:
- `src/jobs/index.test.ts`
- `src/controllers/refresh.test.ts`
- `src/controllers/templateController.test.ts`
- `src/middleware/authMiddleware.test.ts`
- `src/routes/channelLifecycle.test.ts`
- `src/services/IngressService.hierarchy.test.ts`
- `src/services/IngressService.path.test.ts`
- `src/services/IngressService.test.ts`
- `src/services/flowEngine.skill.test.ts`

### Category E: Security Module (3 files)
**Root Cause**: DM policy tests and security audit tests expect configurations/interfaces that changed in OpenClaw upstream.

**Remediation Action**: Verify current DM policy behavior → update test expectations.

**Failing Files**:
- `src/security/dm-policy-channel-smoke.test.ts`
- `src/security/audit.test.ts`
- `src/security/dm-policy-shared.test.ts`

### Category F: Miscellaneous Channel Tests (14 files)
**Root Cause**: Various mock/import issues across miscellaneous channels.

**Remediation Action**: Fix on a per-file basis.

**Failing Files**:
- `src/hooks/install.test.ts`
- `src/line/monitor.read-body.test.ts`
- `src/wizard/onboarding.gateway-config.test.ts`
- `src/wizard/onboarding.test.ts`
- `src/discord/monitor/message-handler.inbound-contract.test.ts`
- `src/signal/monitor/event-handler.inbound-contract.test.ts`
- `src/signal/monitor/event-handler.mention-gating.test.ts`
- `src/slack/monitor/message-handler/prepare.test.ts`
- `src/analytics/event-listener.test.ts`
- `src/facebook/send.test.ts`
- `src/facebook/webhook.test.ts`
- `src/discord/send.sends-basic-channel-messages.test.ts`
- `src/discord/targets.test.ts`
- `src/tools/cmd.test.ts`

### Miscellaneous / Uncategorized (27 files)
- `src/docker-setup.test.ts`
- `src/i18n/registry.test.ts`
- `src/ingress/ingress-service.fusion.test.ts`
- `src/lib/simple.test.ts`
- `src/media/store.test.ts`
- `src/memory/manager.batch.test.ts`
- `src/memory/manager.embedding-batches.test.ts`
- `src/plugins/voice-call.plugin.test.ts`
- `src/providers/google-shared.ensures-function-call-comes-after-user-turn.test.ts`
- `src/providers/google-shared.preserves-parameters-type-is-missing.test.ts`
- `src/scripts/canvas-a2ui-copy.test.ts`
- `src/services/AgentService.test.ts`
- `src/services/FirebaseService.hierarchy.test.ts`
- `src/services/FirebaseService.path.test.ts`
- `src/services/FirebaseService.test.ts`
- `src/services/analytics.test.ts`
- `src/web/auto-reply.web-auto-reply.reconnects-after-connection-close.test.ts`
- `src/web/auto-reply/monitor/process-message.inbound-contract.test.ts`
- `src/docker-image-digests.test.ts`
- `src/dockerfile.test.ts`
- `src/channels/registry.helpers.test.ts`
- `src/docs/slash-commands-doc.test.ts`
- `src/process/exec.test.ts`
- `src/services/authSystem.test.ts`
- `src/services/campaignService.test.ts`
- `src/services/contactService.test.ts`
- `src/services/templateService.test.ts`
