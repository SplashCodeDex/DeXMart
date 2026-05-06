/**
 * Route Constants
 *
 * Centralized route definitions for type-safe navigation.
 */

export const ROUTES = {
  // Public routes
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  FORGOT_PASSWORD: "/forgot-password",

  // Dashboard routes
  DASHBOARD: "/dashboard",
  DASHBOARD_HOME: "/dashboard/home",
  BOTS: "/bots",
  BOT_DETAIL: (botId: string) => `/bots/${botId}` as const,
  BOT_SETTINGS: (botId: string) => `/bots/${botId}/settings` as const,
  NEW_BOT: "/bots/new",
  MESSAGES: "/messages",
  SETTINGS: "/settings",
  BILLING: "/billing",

  // Legal
  PRIVACY: "/privacy",
  TERMS: "/terms",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
