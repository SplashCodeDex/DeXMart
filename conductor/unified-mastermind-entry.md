# Unified Mastermind Entry Point Implementation Plan (Architectural Integrity Edition)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify DeXMart SaaS API and OpenClaw Gateway into a single process (`src/main.ts`) with shared state, architectural integrity, and zero-config agent auth.

**Architecture:**
1.  **Singleton Guard**: Use dynamic `import()` in `main.ts` to ensure `GlobalContext` (DeXMart) initializes singletons before OpenClaw modules are loaded.
2.  **Auth Precedence**: Configure the engine for `env-first` precedence to allow `OPENAI_API_KEY` from `.env` to work without manual profile registration.
3.  **Passive Gateway Mode**: Force `OPENCLAW_SKIP_CHANNELS=1` within the unified process to ensure DeXMart's `ChannelService` is the sole authority for WhatsApp sessions.
4.  **Graceful Shutdown Registry**: A centralized orchestrator in `main.ts` to sequence the teardown of RPC, REST, and Messaging services.

---

### Task 0: Singleton Guarding & Orchestration Refactor

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Implement Dynamic Bootstrapping**
Refactor `main()` to use dynamic imports. This prevents top-level imports from hijacking the `ConfigService` singleton.
```typescript
async function main() {
  // 1. Initialize DeXMart Context first
  const { default: initializeContext } = await import("./lib/context.js");
  const context = await initializeContext();

  // 2. Set Gateway Environment Overrides
  process.env.OPENCLAW_SKIP_CHANNELS = "1"; // De-conflict watchdogs

  // 3. Start SaaS API
  const { MultiTenantApp } = await import("./server/multiTenantApp.js");
  const app = new MultiTenantApp();
  await app.initialize();
  await app.start();

  // 4. Start Gateway Server
  if (context.config.get("system.useServer")) {
    const { startGatewayServer } = await import("./gateway/server.js");
    await startGatewayServer({
      port: 19001,
      dev: true,
    });
  }
}
```

### Task 1: Architectural Auth Fix (Env-First)

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Set Credential Precedence**
In `main.ts`, ensure the config is set to prioritize environment variables for the `dev` profile.
```typescript
// Inside main() after initializeContext()
context.config.set("agents.defaults.credentialPrecedence", "env-first");
```

### Task 2: Graceful Shutdown Registry

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Implement shutdown sequencer**
Create a registry to ensure services stop in the correct order (Gateway -> Watchdog -> API).
```typescript
const shutdownRegistry: (() => Promise<void>)[] = [];

process.on('SIGTERM', async () => {
  logger.info(">>> [MASTERMIND] Initiating graceful shutdown...");
  for (const task of shutdownRegistry.reverse()) {
    try { await task(); } catch (e) { logger.error(e); }
  }
  process.exit(0);
});
```

### Task 3: Update Startup Pipeline

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Point scripts to unified entry**
```json
{
  "scripts": {
    "dev": "node scripts/run-node.mjs src/main.ts",
    "dev:backend": "node scripts/run-node.mjs src/main.ts",
    "gateway:dev": "node scripts/run-node.mjs src/main.ts"
  }
}
```

### Task 4: Verification

- [ ] **Step 1: Run `pnpm run dev`**
- [ ] **Step 2: Verify Port 3001 and 19001 are active.**
- [ ] **Step 3: Confirm `OPENAI_API_KEY` works without `auth-profiles.json` changes.**
- [ ] **Step 4: Verify single "Resuming channels" log from DeXMart.**
