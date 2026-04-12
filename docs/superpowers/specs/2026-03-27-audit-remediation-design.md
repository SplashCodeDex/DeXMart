# Audit Remediation Design

Date: 2026-03-27
Status: Approved
Approach: C — Complete the Core, Gate the Rest

> [!WARNING]
> **Path Migration Notice (Post-Phase 4)**
> All `backend/src/...` paths in this document should be read as `src/...`.
> The `backend/` directory was dissolved into the unified `src/` tree on 2026-04-03 (Phase 4).

---

## Problem Statement

A full codebase audit identified 10 stubs/unimplemented features, 2 placeholder credentials, and 4 active conductor tracks with pending work. The issues fall into four categories:

1. **Silent lies** — functions that return wrong answers (`isActiveChannelAdmin` → `false`, `pendingMembers` → `[]`)
2. **Runtime throws** — features that crash when hit (IRC/Google Chat `sendMessage`, media download, Twitch `sendText`)
3. **Security gap** — JWT fallback to a static placeholder secret in frontend auth
4. **Silent data loss** — `executeAutomation` no-ops while `IngressService` assumes success and skips normal message processing

---

## Scope

This design covers the items that are broken, dangerous, or silently wrong. It explicitly excludes:

- **Media/full backup** — `throw AppError.badRequest(...)` is already honest
- **Deprecated `UsageGuard`** — tracked in `dynamic_gating_20260312` conductor track
- **Conductor verification checkpoints** — manual human steps, not code
- **Twitch in openclaw** — not in DeXMart's adapter layer
- **WhatsApp resilience Phases 2-3** — already tracked

---

## Section 1: JWT Secret Fix

### Problem
`frontend/src/server/auth/session.ts` (line 7) and `frontend/src/proxy.ts` (line 6) use:
```typescript
process.env.JWT_SECRET || 'static-placeholder-do-not-use-in-prod-7f9d8a2b'
```
If `JWT_SECRET` is unset, the app runs with a known static secret. Tokens signed with it are trivially forgeable.

### Solution
Create `frontend/src/lib/env.server.ts` — a centralized server env validation module.

```typescript
import 'server-only';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[env] Required server env var "${name}" is not set`);
  return value;
}

export const serverEnv = {
  JWT_SECRET: requireEnv('JWT_SECRET'),
};
```

Both `session.ts` and `proxy.ts` import `serverEnv.JWT_SECRET` and drop the fallback:
```typescript
import { serverEnv } from '@/lib/env.server.js';
const JWT_SECRET = new TextEncoder().encode(serverEnv.JWT_SECRET);
```

### Rationale
- Consistent with the backend's `env.schema.ts` Zod validation pattern (CLAUDE.md documents this as the project convention)
- `import 'server-only'` prevents accidental client-side import (matches `session.ts` line 1)
- Centralized: one place to see and validate all required server secrets
- Works in both Node.js runtime (`session.ts`) and Edge Runtime (`proxy.ts`)

### Files Changed
- `frontend/src/lib/env.server.ts` — new
- `frontend/src/server/auth/session.ts` — remove fallback, import from env module
- `frontend/src/proxy.ts` — remove fallback, import from env module

---

## Section 2: Channel Capability Errors

### Problem
IRC and Google Chat adapters throw generic `new Error('...placeholder...')` from `sendMessage`. The `omnichannelController.sendMessage` catch block returns this as a raw 500 with the implementation detail exposed in the response body.

### Solution
Extend the existing `AppError` hierarchy in `backend/src/types/result.ts`:

```typescript
static notImplemented(message: string): AppError {
  return new AppError(message, 'NOT_IMPLEMENTED', 501);
}
```

IRC and Google Chat adapters replace their throws:
```typescript
// Before
throw new Error('IRCAdapter.sendMessage is currently a placeholder and not fully implemented.');

// After
throw AppError.notImplemented('IRC channel does not yet support sending messages');
```

Update the `omnichannelController.sendMessage` catch to use `AppError.statusCode`:
```typescript
} catch (error: any) {
  logger.error('OmnichannelController.sendMessage', error);
  const status = error instanceof AppError ? error.statusCode : 500;
  res.status(status).json({ success: false, error: error.message });
}
```

### Rationale
- Uses the existing `AppError` error hierarchy (static factories for `badRequest`, `notFound`, etc.)
- No new error classes — `AppError.notImplemented()` follows the established factory pattern
- The controller catch handles ALL `AppError` subtypes, not just capability errors
- HTTP 501 is the semantically correct status for "server doesn't implement this"

### Files Changed
- `backend/src/types/result.ts` — add `static notImplemented()`
- `backend/src/services/channels/irc/IRCAdapter.ts` — use `AppError.notImplemented()`
- `backend/src/services/channels/googlechat/GoogleChatAdapter.ts` — use `AppError.notImplemented()`
- `backend/src/controllers/omnichannelController.ts` — `AppError`-aware catch in `sendMessage`

---

## Section 3: Omnichannel Context Stubs

### Problem
`backend/src/utils/createChannelContext.ts` has five stubs for non-WhatsApp channels:
- `isActiveChannelAdmin()` → hardcoded `return false` (line 153)
- `isChannelAdmin()` → hardcoded `return false` (line 156)
- `pendingMembers()` → returns `[]` (line 215)
- `approvePendingMembers()` → returns `null` (line 216)
- `rejectPendingMembers()` → returns `null` (line 217)
- `download()` → throws generic `Error` for CommonMessage (line 364)

### Solution: Admin and Pending Member Stubs

`GroupService` already implements all five methods correctly:
- `isChannelAdmin(channel, groupJid)` — decodes bot JID via `channel.decodeJid(channel.user.id)`, checks admin status via `groupMetadata`
- `getPendingMembers(channel, groupJid)` — guards for `groupRequestParticipantsList`, returns `[]` on failure
- `handlePendingMembers(channel, groupJid, jids, action)` — guards for `groupRequestParticipantsUpdate`

`GroupService` imports `ActiveChannel as Channel` — types are directly compatible with `channelInstance: ActiveChannel`.

The fix is delegation, not reimplementation:
```typescript
import { groupService } from '../services/groupService.js';

// In the group() function:
isActiveChannelAdmin: async () => jid ? groupService.isChannelAdmin(channelInstance, jid) : false,
isChannelAdmin: async () => jid ? groupService.isChannelAdmin(channelInstance, jid) : false,
pendingMembers: async () => jid ? groupService.getPendingMembers(channelInstance, jid) : [],
approvePendingMembers: async (jids) => jid ? groupService.handlePendingMembers(channelInstance, jid, jids, 'approve') : null,
rejectPendingMembers: async (jids) => jid ? groupService.handlePendingMembers(channelInstance, jid, jids, 'reject') : null,
```

For WhatsApp instances: `groupMetadata` and `groupRequestParticipantsList` exist on the Baileys socket — `groupService` calls them and returns real data.

For non-WhatsApp instances: these methods don't exist on the channel instance — `groupService` catches the error and returns `false`/`[]` — which is the honest answer for channels without these concepts.

### Solution: Media Download

`CommonAttachment` (defined in `backend/src/types/omnichannel.ts`) has `url?: string` and `data?: string` (base64). These fields exist for this purpose.

```typescript
download: async () => {
  if (isCommonMessage(messageSource)) {
    const attachment = messageSource.content.attachments?.[0];
    if (!attachment) throw AppError.notImplemented('No attachment available for download');
    if (attachment.data) return Buffer.from(attachment.data, 'base64');
    if (attachment.url) {
      const res = await fetch(attachment.url);
      if (!res.ok) throw new Error(`Failed to download attachment: HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    }
    throw AppError.notImplemented('Attachment has no downloadable content (url or data)');
  }
  // ... existing WhatsApp download path unchanged
}
```

Auth-aware URLs are the adapter's responsibility when constructing the `CommonMessage`. This layer fetches whatever URL is provided — correct layering.

### Rationale
- `groupService` already has tested, correct implementations — delegating avoids reimplementation
- Type compatibility is confirmed (`ActiveChannel as Channel` alias in `groupService.ts`)
- The WhatsApp path through `groupService` uses `groupMetadata` from Baileys — identical to what a manual implementation would do
- `fetch()` with Node.js 24 native fetch is the standard approach for URL downloads
- `Buffer.from(data, 'base64')` is the only correct approach for base64

### Files Changed
- `backend/src/utils/createChannelContext.ts` — delegate to `groupService`, implement CommonMessage download

---

## Section 4: Automation Silent Failure

### Problem
`automationService.executeAutomation()` logs and returns void — a silent no-op. `IngressService` (line 85-88) calls it and then does `return;` assuming the automation handled the message. Result: messages matching automation triggers are silently swallowed — the automation never runs AND normal processing is skipped.

### Solution
Make `executeAutomation` fail explicitly:
```typescript
async executeAutomation(tenantId: string, automationId: string, context: any): Promise<void> {
  logger.warn(`[AutomationService] Execution engine not yet available (automation: ${automationId}, tenant: ${tenantId})`);
  throw AppError.notImplemented('Automation execution engine pending Mastermind integration');
}
```

Update `IngressService` to catch and fall through:
```typescript
try {
  await automationService.executeAutomation(tenantId, auto.id, aiCtx);
  analyticsService.trackMessage(tenantId, 'received');
  return;
} catch (err) {
  logger.warn(`[Ingress] Automation ${auto.id} execution unavailable, continuing normal processing`, err);
}
```

### Rationale
- Stops silent message swallowing immediately
- When the execution engine is implemented, `IngressService` already handles both paths (success → return early, error → continue)
- Uses `AppError.notImplemented()` consistent with Section 2
- No dispatch skeleton — the action types (`ai_process`, `execute_skill`) genuinely need Mastermind, and implementing a partial skeleton would just push stubs deeper

### Files Changed
- `backend/src/services/automationService.ts` — throw instead of no-op
- `backend/src/services/IngressService.ts` — catch and fall through

---

## Files Summary

| File | Change Type | Section |
|------|-------------|---------|
| `frontend/src/lib/env.server.ts` | New | 1 |
| `frontend/src/server/auth/session.ts` | Modify | 1 |
| `frontend/src/proxy.ts` | Modify | 1 |
| `backend/src/types/result.ts` | Modify | 2 |
| `backend/src/services/channels/irc/IRCAdapter.ts` | Modify | 2 |
| `backend/src/services/channels/googlechat/GoogleChatAdapter.ts` | Modify | 2 |
| `backend/src/controllers/omnichannelController.ts` | Modify | 2 |
| `backend/src/utils/createChannelContext.ts` | Modify | 3 |
| `backend/src/services/automationService.ts` | Modify | 4 |
| `backend/src/services/IngressService.ts` | Modify | 4 |

Total: 1 new file, 9 modified files.

---

## Testing Requirements (per CLAUDE.md TDD mandate)

Each section requires tests written BEFORE implementation:

1. **JWT**: Test that `env.server.ts` throws when `JWT_SECRET` is unset. Test that `session.ts` and `proxy.ts` use the validated value.
2. **AppError.notImplemented**: Test factory produces correct code/statusCode. Test controller returns 501 for `AppError` with `NOT_IMPLEMENTED` code.
3. **groupService delegation**: Test `isActiveChannelAdmin` returns correct value when `groupMetadata` is present/absent. Test `download()` handles URL, base64, and missing attachment.
4. **Automation**: Test `executeAutomation` throws `AppError`. Test `IngressService` continues processing when automation execution fails.
