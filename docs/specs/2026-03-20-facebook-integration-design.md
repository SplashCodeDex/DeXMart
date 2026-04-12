# Facebook Messenger Integration Design (Hybrid Architecture)

> [!CAUTION]
> **OUTDATED — Pre-Fusion Architecture (2026-03-20)**
>
> This spec was written **before** the True Fusion plan (Phase 4) was completed. It references:
> - `GenericOpenClawAdapter` — **deleted** in Phase 1 restructure
> - `backend/src/services/channels/` — **deprecated** parallel channel system (scheduled for removal in Phase 5)
> - `openclaw/src/facebook/` — should now be `extensions/facebook/` (the canonical channel location)
>
> **Correct approach (post-Fusion):** Facebook must be implemented as a native OpenClaw **extension plugin** in `extensions/facebook/`, following the same pattern as `extensions/whatsapp/` and `extensions/telegram/`. No adapter wrappers, no `ChannelManager` registration. See `docs/architecture/FUSION_STRATEGY.md` Section 5 and `docs/PROJECT_RULES.md` Rules 3-4.
>
> The **business logic** in this spec (Graph API integration, webhook validation, credential storage) is still valid. Only the **architectural wiring** is outdated.

**Date:** 2026-03-20
**Status:** ~~Approved~~ → OUTDATED (superseded by True Fusion architecture)
**Author:** Adema (Gemini CLI)

## 1. Overview

This document outlines the architectural and technical design for integrating Facebook Messenger into the **DeXMart** omnichannel platform. The integration follows a **Hybrid Architecture**, prioritizing a robust, official **Direct Token (BYO)** implementation as the foundation (Phase 1), with a roadmap for a seamless, managed "One-Click" OAuth flow (Phase 2).

This design leverages the existing **OpenClaw** engine and **DeXMart Mastermind** infrastructure, ensuring Facebook operates as a first-class, AI-capable channel alongside WhatsApp and Telegram.

## 2. Architecture & Data Flow

### 2.1 The "Mastermind Adapter" Pattern

The integration integrates into DeXMart's existing `GenericOpenClawAdapter` pattern:

1.  **OpenClaw Core (`openclaw/src/facebook/`)**: A new, dedicated module within the OpenClaw package handles the low-level communication with Meta's Graph API.
2.  **DeXMart Bridge (`backend/src/services/channels/`)**: The backend registers `facebook` as a supported platform type in `registry.ts`.
3.  **Generic Adapter**: The existing `GenericOpenClawAdapter` routes outbound messages from DeXMart to the OpenClaw core and normalizes inbound webhooks.

### 2.2 Data Flow

**Inbound (User -> Facebook -> DeXMart):**
1.  User sends a message to the connected Facebook Page.
2.  Meta sends a `POST` request to `https://api.dexmart.ai/api/webhooks/facebook`.
3.  **OpenClaw Webhook Handler**:
    *   Validates `X-Hub-Signature-256` using the stored `App Secret`.
    *   Parses the proprietary Messenger JSON payload.
    *   Normalizes the event into a `CommonMessage` object (standardized text, media, sender info).
4.  **Ingress Service**: The normalized message is pushed to the `IngressService`.
5.  **Mastermind Brain**: The AI processes the message, applying RAG (knowledge base) and tool execution logic.

**Outbound (DeXMart -> Facebook -> User):**
1.  The AI (or human agent) generates a response.
2.  `ChannelManager` routes the message to the `GenericOpenClawAdapter` for the specific channel ID.
3.  **OpenClaw `sendMessageFacebook`**:
    *   Retrieves the tenant's `Page Access Token` from secure storage.
    *   Constructs the Graph API payload (`messaging_type: "RESPONSE"`).
    *   Handles text chunking (splitting >2000 char messages).
    *   Uploads media attachments if present.
    *   Executes the `POST` request to `graph.facebook.com`.

## 3. Technical Implementation Details

### 3.1 OpenClaw Module (`openclaw/src/facebook`)

*   **`send.ts`**:
    *   `sendMessageFacebook(to, text, opts)`: Core function.
    *   `sendReactionFacebook(to, emoji)`: Maps generic emojis to Messenger reactions.
    *   `sendActionFacebook(to, action)`: Handles "typing_on", "mark_seen".
*   **`webhook.ts`**:
    *   `handleFacebookWebhook(req, res)`: Express middleware for signature validation and initial parsing.
    *   `challengeHandler(req, res)`: Handles the specific `hub.verify_token` challenge required by Meta during webhook setup.

### 3.2 Backend Service Updates (`backend/src/services`)

*   **`channels/registry.ts`**: Add the Facebook definition:
    ```typescript
    facebook: {
      metadata: {
        id: 'facebook',
        label: 'Facebook Messenger',
        icon: 'SiFacebook',
        color: 'bg-blue-600',
        fields: [
          { id: 'pageAccessToken', label: 'Page Access Token', type: 'password' },
          { id: 'appSecret', label: 'App Secret', type: 'password' },
          { id: 'verifyToken', label: 'Verify Token', placeholder: 'dexmart_verification_token' }
        ]
      },
      adapterClass: GenericOpenClawAdapter
    }
    ```

### 3.3 Storage Schema (Firestore)

Credentials are stored in the isolated `auth` subcollection for each channel:
`tenants/{tenantId}/agents/{agentId}/channels/{channelId}/auth/credentials`

```json
{
  "pageAccessToken": "EAAG...",
  "appSecret": "...",
  "verifyToken": "...",
  "pageId": "123456789",
  "updatedAt": "Timestamp"
}
```

## 4. Dashboard & UX

### 4.1 "Add Channel" Modal
*   **Dynamic Rendering**: The frontend's `AddChannelModal` component automatically renders the Facebook card based on the updated `registry.ts` metadata.
*   **Secure Input**: Password fields for the Access Token and App Secret mask the input by default.
*   **Guidance**: Tooltips/Info icons link directly to the Meta Developer Portal documentation for generating tokens.

### 4.2 Unified Inbox
*   **Iconography**: Use the standard `SiFacebook` (Lucide/React-Icons) icon to distinguish Facebook threads.
*   **Media Rendering**: Standardize Facebook image/video attachments to use the existing `MediaPreview` component.

## 5. Security & Compliance

*   **Signature Verification**: **Mandatory**. No webhook is processed without a valid `sha256` signature matching the stored App Secret.
*   **Token Encryption**: Page Access Tokens are encrypted at rest (if DeXMart's storage encryption layer is active) or strictly ACL-gated via Firestore Security Rules.
*   **Rate Limiting**: Implementation of a "Leaky Bucket" limiter in the `sendMessageFacebook` function to respect Meta's strict outbound limits (preventing Page bans).

## 6. Phase 2 Roadmap (Future)

*   **One-Click OAuth**: Implement a centralized "DeXMart Platform App" to handle the OAuth handshake, returning the Page Access Token automatically.
*   **Instagram Support**: Leverage the shared underlying Graph API to add `instagram` as a channel type with minimal code duplication (sharing ~90% of the `facebook` module).
