/**
 * registry.ts — DeXMart Fusion: Channel Platform Registry
 *
 * Maps platform IDs to UI metadata and adapter constructors.
 * This is the single source of truth for which channels DeXMart supports
 * and how the dashboard presents them to users.
 *
 * The adapterClass field is typed as a constructor or null — null means the
 * channel is managed entirely by OpenClaw's native plugin lifecycle
 * (createChannelManager) and does not need a DeXMart adapter instance.
 *
 * Channels with a non-null adapterClass (WhatsApp, Telegram, Discord, Slack,
 * Signal, iMessage, IRC, GoogleChat) have DeXMart adapters that provide
 * DeXMart-specific features: anti-ban, Firestore auth, campaign support,
 * multi-tenant isolation, and the outbound queue worker.
 */

// ── Platform Metadata Type ────────────────────────────────────────────────────

export interface PlatformField {
  id: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'password';
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

export interface RegistryEntry {
  metadata: PlatformMetadata;
  /** DeXMart adapter constructor, or null if managed by OpenClaw plugin system */
  adapterClass: (new (...args: any[]) => any) | null;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const REGISTRY: Record<string, RegistryEntry> = {
  whatsapp: {
    metadata: {
      id: 'whatsapp',
      label: 'WhatsApp',
      description:
        'Create a WhatsApp channel instance. You will link your device using a QR code or pairing code next.',
      icon: 'SiWhatsapp',
      color: 'bg-green-500',
      fields: [
        {
          id: 'deviceName',
          label: 'Device Name (Shows on Linked Devices)',
          placeholder: 'e.g., Acme Corp Support',
        },
      ],
    },
    // WhatsApp adapter is DeXMart-native: wraps OpenClaw's createWaSocket()
    // with Firestore auth, anti-ban queue, and Firestore session persistence.
    // Lazy-imported to avoid circular deps at module init time.
    adapterClass: null, // set at runtime via setWhatsAppAdapterClass()
  },

  telegram: {
    metadata: {
      id: 'telegram',
      label: 'Telegram',
      description: 'Enter your bot token from @BotFather',
      icon: 'SiTelegram',
      color: 'bg-blue-400',
      fields: [{ id: 'token', label: 'Bot Token', placeholder: '123456789:ABCdef...' }],
    },
    adapterClass: null,
  },

  discord: {
    metadata: {
      id: 'discord',
      label: 'Discord',
      description: 'Enter your Discord Bot Token',
      icon: 'SiDiscord',
      color: 'bg-indigo-500',
      fields: [{ id: 'token', label: 'Bot Token', placeholder: 'MTAxNj...' }],
    },
    adapterClass: null,
  },

  slack: {
    metadata: {
      id: 'slack',
      label: 'Slack',
      description: 'Enter your Slack Bot Token and App Token',
      icon: 'SiSlack',
      color: 'bg-purple-500',
      fields: [
        { id: 'botToken', label: 'Bot Token', placeholder: 'xoxb-...' },
        { id: 'appToken', label: 'App Token', placeholder: 'xapp-...' },
      ],
    },
    adapterClass: null,
  },

  signal: {
    metadata: {
      id: 'signal',
      label: 'Signal',
      description: 'Link your Signal account',
      icon: 'SiSignal',
      color: 'bg-blue-700',
      fields: [{ id: 'phone', label: 'Phone Number', placeholder: '+1234567890' }],
    },
    adapterClass: null,
  },

  imessage: {
    metadata: {
      id: 'imessage',
      label: 'iMessage',
      description: 'Enter your Apple ID or Phone Number associated with iMessage',
      icon: 'MessageSquare',
      color: 'bg-blue-400',
      fields: [
        {
          id: 'identifier',
          label: 'Identifier',
          placeholder: 'user@example.com or +123...',
        },
      ],
    },
    adapterClass: null,
  },

  irc: {
    metadata: {
      id: 'irc',
      label: 'IRC',
      description: 'Enter your IRC server and nickname details',
      icon: 'Hash',
      color: 'bg-gray-500',
      fields: [
        { id: 'server', label: 'Server', placeholder: 'irc.libera.chat' },
        { id: 'nick', label: 'Nickname', placeholder: 'DeXMartBot' },
      ],
    },
    adapterClass: null,
  },

  googlechat: {
    metadata: {
      id: 'googlechat',
      label: 'Google Chat',
      description: 'Enter your Google Chat Space ID and credentials',
      icon: 'SiGooglechat',
      color: 'bg-yellow-500',
      fields: [
        { id: 'spaceId', label: 'Space ID', placeholder: 'spaces/...' },
        { id: 'token', label: 'Access Token / Webhook', placeholder: '...' },
      ],
    },
    adapterClass: null,
  },

  // ── OpenClaw-native channels (managed by OpenClaw plugin system) ────────────
  // These channels have no DeXMart adapter. They are started/stopped by
  // OpenClaw's createChannelManager() via the extensions/ plugin system.
  // The registry entry provides dashboard metadata only.

  msteams: {
    metadata: {
      id: 'msteams',
      label: 'Microsoft Teams',
      description: 'Connect to Microsoft Teams using Bot Framework credentials',
      icon: 'SiMicrosoftteams',
      color: 'bg-blue-600',
      nativeOpenClaw: true,
      fields: [
        {
          id: 'appId',
          label: 'Microsoft App ID',
          placeholder: '00000000-0000-0000-0000-000000000000',
        },
        { id: 'appPassword', label: 'App Password', placeholder: '...' },
      ],
    },
    adapterClass: null,
  },

  matrix: {
    metadata: {
      id: 'matrix',
      label: 'Matrix',
      description: 'Connect to a Matrix homeserver',
      icon: 'SiMatrix',
      color: 'bg-black',
      nativeOpenClaw: true,
      fields: [
        { id: 'homeserverUrl', label: 'Homeserver URL', placeholder: 'https://matrix.org' },
        { id: 'accessToken', label: 'Access Token', placeholder: 'syt_...' },
      ],
    },
    adapterClass: null,
  },

  facebook: {
    metadata: {
      id: 'facebook',
      label: 'Facebook Messenger',
      description:
        'Connect your Facebook Page. You will need a Page Access Token and App Secret from Meta.',
      icon: 'SiFacebook',
      color: 'bg-blue-600',
      nativeOpenClaw: true,
      fields: [
        {
          id: 'pageAccessToken',
          label: 'Page Access Token',
          placeholder: 'EAAG...',
          type: 'password',
        },
        { id: 'appSecret', label: 'App Secret', placeholder: '...', type: 'password' },
        {
          id: 'verifyToken',
          label: 'Verify Token',
          placeholder: 'dexmart_verification_token',
        },
      ],
    },
    adapterClass: null,
  },
};

// ── Boot-time Registration ────────────────────────────────────────────────────
// WhatsApp adapter is registered at module load time using a dynamic import
// to avoid circular dependency (registry → WhatsappAdapter → registry via ChannelManager).
// This is the fusion wiring: registry knows about WhatsappAdapter, but doesn't
// import it at the top level.
import('./whatsapp/WhatsappAdapter.js')
  .then(({ WhatsappAdapter }) => {
    REGISTRY['whatsapp'].adapterClass = WhatsappAdapter;
  })
  .catch((err) => {
    // Non-fatal at module load — WhatsApp will be unavailable until adapter loads
    console.warn('[Registry] Failed to load WhatsappAdapter:', err);
  });

// ── Late Registration (avoids circular import at module init) ─────────────────

/**
 * Register an adapter class for a platform at runtime.
 * Use this to avoid circular imports between the registry and adapter files.
 *
 * @example
 *   import { WhatsappAdapter } from './whatsapp/WhatsappAdapter.js';
 *   registerAdapterClass('whatsapp', WhatsappAdapter);
 */
export function registerAdapterClass(
  platformId: string,
  adapterClass: new (...args: any[]) => any,
): void {
  if (!REGISTRY[platformId]) {
    throw new Error(`[Registry] Unknown platform: ${platformId}`);
  }
  REGISTRY[platformId].adapterClass = adapterClass;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns UI metadata for all supported platforms (for dashboard channel picker). */
export function getSupportedPlatforms(): PlatformMetadata[] {
  return Object.values(REGISTRY).map((entry) => entry.metadata);
}

/** Returns the adapter constructor for a platform, or null if OpenClaw-native. */
export function getPlatformAdapter(
  type: string,
): (new (...args: any[]) => any) | null | undefined {
  return REGISTRY[type]?.adapterClass;
}

/** Returns the UI metadata for a platform, or undefined if not found. */
export function getPlatformMetadata(type: string): PlatformMetadata | undefined {
  return REGISTRY[type]?.metadata;
}

/** Returns true if a platform is managed by OpenClaw's native plugin system. */
export function isNativeOpenClawChannel(type: string): boolean {
  return REGISTRY[type]?.metadata?.nativeOpenClaw === true;
}
