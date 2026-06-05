/**
 * API Endpoint Constants
 *
 * Centralized endpoint definitions for type-safe API calls.
 */

export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    GOOGLE: "/api/auth/google",
    LOGOUT: "/api/auth/logout",
    VERIFY: "/api/auth/me",
    FORGOT_PASSWORD: "/api/auth/forgot-password",
    RESET_PASSWORD: "/api/auth/reset-password",
    REFRESH: "/api/auth/refresh",
  },

  // Agents (Protected via /api/internal)
  AGENTS: {
    LIST: "/api/internal/bots",
    COMMANDS: "/api/internal/bots/commands",
    GET: (agentId: string) => `/api/internal/bots/${agentId}` as const,
    CREATE: "/api/internal/bots",
    UPDATE: (agentId: string) => `/api/internal/bots/${agentId}` as const,
    DELETE: (agentId: string) => `/api/internal/bots/${agentId}` as const,
    CONNECT: (agentId: string) => `/api/internal/bots/${agentId}/connect` as const,
    DISCONNECT: (agentId: string) => `/api/internal/bots/${agentId}/disconnect` as const,
    QR_CODE: (agentId: string) => `/api/internal/bots/${agentId}/qr` as const,
    PAIRING_CODE: (agentId: string) => `/api/internal/bots/${agentId}/pairing-code` as const,
    STATUS: (agentId: string) => `/api/internal/bots/${agentId}/status` as const,
  },

  // Messages
  MESSAGES: {
    LIST: "/api/messages",
    GET: (messageId: string) => `/api/messages/${messageId}` as const,
    SEND: "/api/messages/send",
    BULK_SEND: "/api/messages/bulk",
    SCHEDULE: "/api/messages/schedule",
  },

  // Contacts
  CONTACTS: {
    LIST: "/api/contacts",
    GET: (contactId: string) => `/api/contacts/${contactId}` as const,
    CREATE: "/api/contacts",
    UPDATE: (contactId: string) => `/api/contacts/${contactId}` as const,
    DELETE: (contactId: string) => `/api/contacts/${contactId}` as const,
    IMPORT: "/api/contacts/import",
    EXPORT: "/api/contacts/export",
    CHECK_DUPLICATES: "/api/contacts/check-duplicates",
    IMPORT_HISTORY: "/api/contacts/imports",
    AUDIENCES: "/api/contacts/audiences",
  },

  // Analytics
  ANALYTICS: {
    DASHBOARD: "/api/analytics/dashboard",
    MESSAGES: "/api/analytics/messages",
    AGENTS: "/api/analytics/bots",
  },

  // Webhooks
  WEBHOOKS: {
    LIST: "/api/webhooks",
    CREATE: "/api/webhooks",
    DELETE: (id: string) => `/api/webhooks/${id}` as const,
  },

  // Settings
  SETTINGS: {
    PROFILE: "/api/settings/profile",
    NOTIFICATIONS: "/api/settings/notifications",
    API_KEYS: "/api/settings/api-keys",
    GET_TENANT: "/api/tenant/settings",
    UPDATE_TENANT: "/api/tenant/settings",
  },

  // Billing
  BILLING: {
    SUBSCRIPTION: "/api/billing/subscription",
    INVOICES: "/api/billing/invoices",
    PAYMENT_METHODS: "/api/billing/payment-methods",
    CHECKOUT: "/api/billing/checkout",
    PORTAL: "/api/billing/portal",
  },

  // Health
  HEALTH: "/api/health",

  // Tenant
  TENANT: {
    SETTINGS: "/api/tenant/settings",
  },

  // Authority
  AUTHORITY: {
    CAPABILITIES: "/api/authority/capabilities",
  },

  // Omnichannel
  OMNICHANNEL: {
    STATUS: "/api/omnichannel/status",
    PLATFORMS: "/api/omnichannel/platforms",
    CHANNELS: {
      ALL: "/api/internal/channels/all",
    },
    CRON: {
      STATUS: "/api/omnichannel/cron/status",
      LIST: "/api/omnichannel/cron/jobs",
      CREATE: "/api/omnichannel/cron/jobs",
      TOGGLE: (id: string) => `/api/omnichannel/cron/jobs/${id}/toggle` as const,
      RUN: (id: string) => `/api/omnichannel/cron/jobs/${id}/run` as const,
      DELETE: (id: string) => `/api/omnichannel/cron/jobs/${id}` as const,
      RUNS: (id: string) => `/api/omnichannel/cron/jobs/${id}/runs` as const,
    },
    SKILLS: {
      REPORT: "/api/omnichannel/skills/report",
      LIST: "/api/omnichannel/skills",
      TOGGLE: (key: string) => `/api/omnichannel/skills/${key}/toggle` as const,
      SAVE_KEY: (key: string) => `/api/omnichannel/skills/${key}/key` as const,
      INSTALL: (key: string) => `/api/omnichannel/skills/${key}/install` as const,
      APPROVALS: {
        LIST: "/api/omnichannel/skills/approvals",
        RESOLVE: (id: string) => `/api/omnichannel/skills/approvals/${id}/resolve` as const,
      },
    },
    AGENTS: {
      LIST: "/api/omnichannel/agents",
      CREATE: "/api/omnichannel/agents" as const,
      IDENTITY: (id: string) => `/api/omnichannel/agents/${id}/identity` as const,
      FILES: (id: string) => `/api/omnichannel/agents/${id}/files` as const,
      CONFIG: (id: string) => `/api/omnichannel/agents/${id}/config` as const,
      UPDATE: (id: string) => `/api/omnichannel/agents/${id}` as const,
      DELETE: (id: string) => `/api/omnichannel/agents/${id}` as const,
      CHANNELS: {
        LIST: (agentId: string) => `/api/internal/agents/${agentId}/channels` as const,
        CREATE: (agentId: string) => `/api/internal/agents/${agentId}/channels` as const,
        GET: (agentId: string, id: string) =>
          `/api/internal/agents/${agentId}/channels/${id}` as const,
        UPDATE: (agentId: string, id: string) =>
          `/api/internal/agents/${agentId}/channels/${id}` as const,
        DELETE: (agentId: string, id: string) =>
          `/api/internal/agents/${agentId}/channels/${id}` as const,
        MOVE: (agentId: string, id: string) =>
          `/api/internal/agents/${agentId}/channels/${id}/move` as const,
        CONNECT: (agentId: string, id: string) =>
          `/api/internal/agents/${agentId}/channels/${id}/connect` as const,
        DISCONNECT: (agentId: string, id: string) =>
          `/api/internal/agents/${agentId}/channels/${id}/disconnect` as const,
        QR_CODE: (agentId: string, id: string) =>
          `/api/internal/agents/${agentId}/channels/${id}/qr` as const,
        STATUS: (agentId: string, id: string) =>
          `/api/internal/agents/${agentId}/channels/${id}/status` as const,
      },
    },
    GATEWAY: {
      HEALTH: "/api/omnichannel/gateway/health",
    },
    USAGE: {
      TOTALS: "/api/omnichannel/usage/totals",
      DAILY: "/api/omnichannel/usage/daily",
      SESSIONS: "/api/omnichannel/usage/sessions",
      LOGS: (key: string) => `/api/omnichannel/usage/sessions/${key}/logs` as const,
    },
    SESSIONS: {
      LIST: "/api/omnichannel/sessions",
      DELETE: (key: string) => `/api/omnichannel/sessions/${key}` as const,
      PATCH: (key: string) => `/api/omnichannel/sessions/${key}` as const,
    },
    NODES: {
      LIST: "/api/omnichannel/nodes",
      DEVICES: "/api/omnichannel/devices",
      APPROVE: (id: string) => `/api/omnichannel/devices/${id}/approve` as const,
      REJECT: (id: string) => `/api/omnichannel/devices/${id}/reject` as const,
      REVOKE: (id: string) => `/api/omnichannel/devices/${id}/revoke` as const,
    },
    LOGS: {
      LIST: "/api/omnichannel/logs",
      STREAM: "/api/omnichannel/logs/stream",
    },
    COMMANDS: {
      LIST: (agentId?: string) =>
        `/api/internal/bots/commands${agentId ? `?agentId=${agentId}` : ""}` as const,
    },
  },
} as const;

export type ApiEndpoint = typeof API_ENDPOINTS;
