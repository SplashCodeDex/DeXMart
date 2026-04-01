import { requireActivePluginRegistry } from "../plugins/runtime.js";
import type { ChannelMeta } from "./plugins/types.js";
import type { ChannelId } from "./plugins/types.js";

// Re-export lightweight identifiers so existing consumers keep working.
export {
  CHAT_CHANNEL_ORDER,
  type ChatChannelId,
  CHANNEL_IDS,
  CHAT_CHANNEL_ALIASES,
  normalizeChatChannelId,
  normalizeChannelId,
} from "./identifiers.js";

import {
  CHAT_CHANNEL_ALIASES,
  CHAT_CHANNEL_ORDER,
  type ChatChannelId,
  normalizeChannelKey,
} from "./identifiers.js";

export type ChatChannelMeta = ChannelMeta;

const WEBSITE_URL = "https://openclaw.ai";

const CHAT_CHANNEL_META: Record<ChatChannelId, ChannelMeta> = {
  telegram: {
    id: "telegram",
    label: "Telegram",
    selectionLabel: "Telegram (Bot API)",
    detailLabel: "Telegram Bot",
    docsPath: "/channels/telegram",
    docsLabel: "telegram",
    blurb: "simplest way to get started — register a bot with @BotFather and get going.",
    systemImage: "paperplane",
    selectionDocsPrefix: "",
    selectionDocsOmitLabel: true,
    selectionExtras: [WEBSITE_URL],
  },
  whatsapp: {
    id: "whatsapp",
    label: "WhatsApp",
    selectionLabel: "WhatsApp (QR link)",
    detailLabel: "WhatsApp Web",
    docsPath: "/channels/whatsapp",
    docsLabel: "whatsapp",
    blurb: "works with your own number; recommend a separate phone + eSIM.",
    systemImage: "message",
  },
  discord: {
    id: "discord",
    label: "Discord",
    selectionLabel: "Discord (Bot API)",
    detailLabel: "Discord Bot",
    docsPath: "/channels/discord",
    docsLabel: "discord",
    blurb: "very well supported right now.",
    systemImage: "bubble.left.and.bubble.right",
  },
  irc: {
    id: "irc",
    label: "IRC",
    selectionLabel: "IRC (Server + Nick)",
    detailLabel: "IRC",
    docsPath: "/channels/irc",
    docsLabel: "irc",
    blurb: "classic IRC networks with DM/channel routing and pairing controls.",
    systemImage: "network",
  },
  googlechat: {
    id: "googlechat",
    label: "Google Chat",
    selectionLabel: "Google Chat (Chat API)",
    detailLabel: "Google Chat",
    docsPath: "/channels/googlechat",
    docsLabel: "googlechat",
    blurb: "Google Workspace Chat app with HTTP webhook.",
    systemImage: "message.badge",
  },
  slack: {
    id: "slack",
    label: "Slack",
    selectionLabel: "Slack (Socket Mode)",
    detailLabel: "Slack Bot",
    docsPath: "/channels/slack",
    docsLabel: "slack",
    blurb: "supported (Socket Mode).",
    systemImage: "number",
  },
  signal: {
    id: "signal",
    label: "Signal",
    selectionLabel: "Signal (signal-cli)",
    detailLabel: "Signal REST",
    docsPath: "/channels/signal",
    docsLabel: "signal",
    blurb: 'signal-cli linked device; more setup (David Reagans: "Hop on Discord.").',
    systemImage: "antenna.radiowaves.left.and.right",
  },
  imessage: {
    id: "imessage",
    label: "iMessage",
    selectionLabel: "iMessage (imsg)",
    detailLabel: "iMessage",
    docsPath: "/channels/imessage",
    docsLabel: "imessage",
    blurb: "this is still a work in progress.",
    systemImage: "message.fill",
  },
};

export function listChatChannels(): ChatChannelMeta[] {
  return CHAT_CHANNEL_ORDER.map((id) => CHAT_CHANNEL_META[id]);
}

export function listChatChannelAliases(): string[] {
  return Object.keys(CHAT_CHANNEL_ALIASES);
}

export function getChatChannelMeta(id: ChatChannelId): ChatChannelMeta {
  return CHAT_CHANNEL_META[id];
}

// Normalizes registered channel plugins (bundled or external).
//
// Keep this light: we do not import channel plugins here (those are "heavy" and can pull in
// monitors, web login, etc). The plugin registry must be initialized first.
export function normalizeAnyChannelId(raw?: string | null): ChannelId | null {
  const key = normalizeChannelKey(raw);
  if (!key) {
    return null;
  }

  const registry = requireActivePluginRegistry();
  const hit = registry.channels.find((entry) => {
    const id = String(entry.plugin.id ?? "")
      .trim()
      .toLowerCase();
    if (id && id === key) {
      return true;
    }
    return (entry.plugin.meta.aliases ?? []).some((alias) => alias.trim().toLowerCase() === key);
  });
  return hit?.plugin.id ?? null;
}

export function formatChannelPrimerLine(meta: ChatChannelMeta): string {
  return `${meta.label}: ${meta.blurb}`;
}

export function formatChannelSelectionLine(
  meta: ChatChannelMeta,
  docsLink: (path: string, label?: string) => string,
): string {
  const docsPrefix = meta.selectionDocsPrefix ?? "Docs:";
  const docsLabel = meta.docsLabel ?? meta.id;
  const docs = meta.selectionDocsOmitLabel
    ? docsLink(meta.docsPath)
    : docsLink(meta.docsPath, docsLabel);
  const extras = (meta.selectionExtras ?? []).filter(Boolean).join(" ");
  return `${meta.label} — ${meta.blurb} ${docsPrefix ? `${docsPrefix} ` : ""}${docs}${extras ? ` ${extras}` : ""}`;
}
