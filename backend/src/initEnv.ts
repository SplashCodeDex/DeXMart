/**
 * Environment Initialization — MUST be imported FIRST in main.ts
 *
 * Uses top-level await to ensure process.env is populated BEFORE
 * any other module (ConfigManager, logger, etc.) evaluates.
 */

// 1. Load shared developer keys (~/codedex/env/)
try {
  const { loadCentralEnv } = await import('@splashcodex/api-key-manager/env');
  loadCentralEnv();
} catch {
  // Not available in CI or prod environments — proceed without it
}

// 2. Load project-specific .env (overrides central env)
await import('dotenv/config');
