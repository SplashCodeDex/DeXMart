/**
 * platform-metadata.ts — DeXMart: Channel Platform UI Metadata
 *
 * Provides dashboard metadata (label, icon, fields) for all supported channel
 * platforms. This is strictly UI data — channel lifecycle is managed by
 * OpenClaw's native plugin system (createChannelManager / extensions/).
 *
 * Extracted from the deprecated registry.ts which also contained adapter class
 * references. Adapter classes have been removed in Phase 5 (Task 5.5).
 */

export interface PlatformField {
  id: string;
  label: string;
  placeholder: string;
  type?: "text" | "password";
}

export interface PlatformMetadata {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  fields: PlatformField[];
  /** Whether this channel is managed by OpenClaw's native plugin system */
  nativeOpenClaw?: boolean;
}

const PLATFORM_METADATA: Record<string, PlatformMetadata> = {
  whatsapp: {
    id: "whatsapp",
    label: "WhatsApp",
    description:
      "Create a WhatsApp channel instance. You will link your device using a QR code or pairing code next.",
    icon: "SiWhatsapp",
    color: "bg-green-500",
    fields: [
      {
        id: "deviceName",
        label: "Device Name (Shows on Linked Devices)",
        placeholder: "e.g., Acme Corp Support",
      },
    ],
  },
  telegram: {
    id: "telegram",
    label: "Telegram",
    description: "Enter your bot token from @BotFather",
    icon: "SiTelegram",
    color: "bg-blue-400",
    fields: [{ id: "token", label: "Bot Token", placeholder: "123456789:ABCdef..." }],
  },
  discord: {
    id: "discord",
    label: "Discord",
    description: "Enter your Discord Bot Token",
    icon: "SiDiscord",
    color: "bg-indigo-500",
    fields: [{ id: "token", label: "Bot Token", placeholder: "MTAxNj..." }],
  },
  slack: {
    id: "slack",
    label: "Slack",
    description: "Enter your Slack Bot Token and App Token",
    icon: "SiSlack",
    color: "bg-purple-500",
    fields: [
      { id: "botToken", label: "Bot Token", placeholder: "xoxb-..." },
      { id: "appToken", label: "App Token", placeholder: "xapp-..." },
    ],
  },
  signal: {
    id: "signal",
    label: "Signal",
    description: "Link your Signal account",
    icon: "SiSignal",
    color: "bg-blue-700",
    fields: [{ id: "phone", label: "Phone Number", placeholder: "+1234567890" }],
  },
  imessage: {
    id: "imessage",
    label: "iMessage",
    description: "Enter your Apple ID or Phone Number associated with iMessage",
    icon: "MessageSquare",
    color: "bg-blue-400",
    fields: [
      {
        id: "identifier",
        label: "Identifier",
        placeholder: "user@example.com or +123...",
      },
    ],
  },
  irc: {
    id: "irc",
    label: "IRC",
    description: "Enter your IRC server and nickname details",
    icon: "Hash",
    color: "bg-gray-500",
    fields: [
      { id: "server", label: "Server", placeholder: "irc.libera.chat" },
      { id: "nick", label: "Nickname", placeholder: "DeXMartBot" },
    ],
  },
  googlechat: {
    id: "googlechat",
    label: "Google Chat",
    description: "Enter your Google Chat Space ID and credentials",
    icon: "SiGooglechat",
    color: "bg-yellow-500",
    fields: [
      { id: "spaceId", label: "Space ID", placeholder: "spaces/..." },
      { id: "token", label: "Access Token / Webhook", placeholder: "..." },
    ],
  },
  msteams: {
    id: "msteams",
    label: "Microsoft Teams",
    description: "Connect to Microsoft Teams using Bot Framework credentials",
    icon: "SiMicrosoftteams",
    color: "bg-blue-600",
    nativeOpenClaw: true,
    fields: [
      {
        id: "appId",
        label: "Microsoft App ID",
        placeholder: "00000000-0000-0000-0000-000000000000",
      },
      { id: "appPassword", label: "App Password", placeholder: "..." },
    ],
  },
  matrix: {
    id: "matrix",
    label: "Matrix",
    description: "Connect to a Matrix homeserver",
    icon: "SiMatrix",
    color: "bg-black",
    nativeOpenClaw: true,
    fields: [
      { id: "homeserverUrl", label: "Homeserver URL", placeholder: "https://matrix.org" },
      { id: "accessToken", label: "Access Token", placeholder: "syt_..." },
    ],
  },
  facebook: {
    id: "facebook",
    label: "Facebook Messenger",
    description:
      "Connect your Facebook Page. You will need a Page Access Token and App Secret from Meta.",
    icon: "SiFacebook",
    color: "bg-blue-600",
    nativeOpenClaw: true,
    fields: [
      {
        id: "pageAccessToken",
        label: "Page Access Token",
        placeholder: "EAAG...",
        type: "password",
      },
      { id: "appSecret", label: "App Secret", placeholder: "...", type: "password" },
      {
        id: "verifyToken",
        label: "Verify Token",
        placeholder: "dexmart_verification_token",
      },
    ],
  },
};

/** Returns metadata for a platform by ID, or undefined if not found. */
export function getPlatformMetadata(platformId: string): PlatformMetadata | undefined {
  return PLATFORM_METADATA[platformId];
}

/** Returns all supported platform metadata entries. */
export function getSupportedPlatforms(): PlatformMetadata[] {
  return Object.values(PLATFORM_METADATA);
}
