import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  // DATABASE_URL removed as we use Firestore exclusively

  // Channel Config
  CHANNEL_NAME: z.string().default('DeXMart'),
  CHANNEL_PREFIX: z.string().default('^[.#!?]'),
  CHANNEL_PHONE_NUMBER: z.string().optional(),
  GROUP_JID: z.string().optional(),
  NEWSLETTER_JID: z.string().default('120363416372653441@newsletter'),
  SESSION_ID: z.string().default('default'),
  TENANT_ID: z.string().default('system'),

  // NOTE: OWNER_NAME and OWNER_NUMBER are now per-tenant settings in Firestore
  // See: TenantConfigService.getTenantSettings()

  // Auth Adapter
  AUTH_ADAPTER: z.enum(['default', 'mysql', 'mongodb', 'firebase']).default('default'),

  // Firebase
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_TABLE_NAME: z.string().default('DeXMart'),
  FIREBASE_SESSION: z.string().default('state'),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  FIREBASE_WEB_API_KEY: z.string().optional(), // Required for Firebase Auth REST API login

  // App URL & Frontend
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://127.0.0.1:3000'),
  JWT_SECRET: z.string().default('secret'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_GLOBAL_REQ: z.coerce.number().default(100),
  RATE_LIMIT_USER_REQ: z.coerce.number().default(30),
  RATE_LIMIT_CMD_REQ: z.coerce.number().default(10),
  RATE_LIMIT_AI_REQ: z.coerce.number().default(5),
  RATE_LIMIT_DOWNLOAD_REQ: z.coerce.number().default(3),
  RATE_LIMIT_PREMIUM_REQ: z.coerce.number().default(100),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // System
  USE_SERVER: z.coerce.boolean().default(true),
  CHANNEL_COOLDOWN_MS: z.coerce.number().default(10000),
  TIME_ZONE: z.string().default('Africa/Accra'),
  REQUIRE_CHANNEL_GROUP_MEMBERSHIP: z.coerce.boolean().default(false),
  REQUIRE_GROUP_SEWA: z.coerce.boolean().default(false),
  UNAVAILABLE_AT_NIGHT: z.coerce.boolean().default(false),
  PRIVATE_PREMIUM_ONLY: z.coerce.boolean().default(false),
  RESTRICT_COMMANDS: z.coerce.boolean().default(false),
  USE_COIN: z.coerce.boolean().default(true),
  MAX_LISTENERS: z.coerce.number().default(50),
  REPORT_ERROR_TO_OWNER: z.coerce.boolean().default(true),
  SELF_OWNER: z.coerce.boolean().default(false),
  SELF_REPLY: z.coerce.boolean().default(true),
  USE_PAIRING_CODE: z.coerce.boolean().default(false),
  CUSTOM_PAIRING_CODE: z.string().default('UMBR4L15'),
  USE_STORE: z.coerce.boolean().default(false),

  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // AI & Gemini
  GOOGLE_GEMINI_API_KEY: z.string().optional(),
  META_AI_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-pro'),
  GEMINI_TEMP: z.coerce.number().default(0.7),
  GEMINI_TOP_P: z.coerce.number().default(0.8),
  GEMINI_TOP_K: z.coerce.number().default(40),
  GEMINI_MAX_TOKENS: z.coerce.number().default(2048),
  AI_MEMORY_MAX_SIZE: z.coerce.number().default(1000),
  AI_MEMORY_TTL: z.coerce.number().default(3600000),
  AI_MEMORY_CLEANUP_INTERVAL: z.coerce.number().default(300000),
  AI_SUMMARIZE_THRESHOLD: z.coerce.number().default(16),
  AI_MESSAGES_TO_SUMMARIZE: z.coerce.number().default(10),
  AI_HISTORY_PRUNE_LENGTH: z.coerce.number().default(6),
  AI_MAX_SPAWN_DEPTH: z.coerce.number().default(5),
  GROUP_LINK: z.string().url().optional(),

  // Connection
  CONN_MAX_RETRIES: z.coerce.number().default(15),
  CONN_BASE_DELAY: z.coerce.number().default(3000),
  CONN_MAX_DELAY: z.coerce.number().default(300000),
  CONN_BACKOFF_MULTIPLIER: z.coerce.number().default(1.5),
  CONN_CB_THRESHOLD: z.coerce.number().default(5),
  CONN_CB_TIMEOUT: z.coerce.number().default(600000),
});

export type EnvConfig = z.infer<typeof envSchema>;
