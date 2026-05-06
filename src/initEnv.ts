/**
 * Environment Initialization — MUST be imported FIRST in main.ts
 *
 * MUST BE STRICTLY SYNCHRONOUS. Do not use top-level await here, meaning
 * do not use `await import()`. If this yields, the Node ESM loader will
 * immediately proceed to evaluate sibling imports (like logger and ConfigManager)
 * before the environment variables are actually loaded.
 */
import { loadCentralEnv } from "@splashcodex/api-key-manager/env";
import dotenv from "dotenv";

// 1. Load shared developer keys (~/codedex/env/)
try {
  const result: any = loadCentralEnv({ silent: false });
  if (result && result.loaded) {
    console.log(
      `[Env] ✅ Loaded central env from ${result.envDir} (${result.filesLoaded.join(", ")})`,
    );
  }
} catch (error: any) {
  // Not available in CI or prod environments, or missing dir
  console.log(`[Env] ⚠️ Central env skipped: ${error.message}`);
}

// 2. Load project-specific .env (overrides central env values)
const result = dotenv.config({ override: true });
if (result.error) {
  console.log(`[Env] ⚠️ Local .env not found or failed to load: ${result.error.message}`);
} else {
  console.log(`[Env] ✅ Loaded local .env overrides`);
}
