/**
 * App Configuration Constants
 */

export const APP_CONFIG = {
  name: "DeXMart",
  description: "WhatsApp Bot Management Platform",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001",
  contactEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@DeXMart.com",
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;

export const LIMITS = {
  FREE: {
    maxBots: 1,
    maxMessagesPerDay: 100,
    maxTeamMembers: 1,
  },
  PRO: {
    maxBots: 5,
    maxMessagesPerDay: 10000,
    maxTeamMembers: 5,
  },
  ENTERPRISE: {
    maxBots: 50,
    maxMessagesPerDay: 100000,
    maxTeamMembers: 50,
  },
} as const;
