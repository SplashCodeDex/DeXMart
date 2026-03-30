import { getStartGatewayServer } from '@/utils/openclawImports.js';
import AuditService from './auditService.js';
import MultiTenantService from './multiTenantService.js';
import { getPlanLimits } from '../utils/featureGating.js';
import BillingService from './billingService.js';

/**
 * OpenClawGateway is a singleton service that manages the lifecycle
 * of the OpenClaw engine within the DeXMart backend.
 *
 * Serves as the proxy layer between the DeXMart REST API and
 * OpenClaw's internal JSON-RPC-style gateway methods.
 */
export class OpenClawGateway {
  private static instance: OpenClawGateway;
  private server: any | null = null;
  private initialized = false;
  private startTime = Date.now();

  private constructor() { }

  /**
   * Gets the singleton instance of OpenClawGateway.
   */
  public static getInstance(): OpenClawGateway {
    if (!OpenClawGateway.instance) {
      OpenClawGateway.instance = new OpenClawGateway();
    }
    return OpenClawGateway.instance;
  }

  /**
   * Safe helper to import openclaw internal modules.
   * Returns null (never throws) if the module is unavailable.
   */
  private async safeImport(path: string): Promise<any> {
    try {
      return await import(path);
    } catch (error: any) {
      console.error(`Failed to import OpenClaw module [${path}]:`, error.message);
      return null;
    }
  }

  /**
   * Helper: loads OpenClaw config (reusable across multiple proxy methods).
   */
  private async loadConfig(): Promise<any> {
    const configMod = await this.safeImport('../../../openclaw/src/config/config.js');
    if (!configMod || typeof configMod.loadConfig !== 'function') {
      throw new Error('OpenClaw loadConfig is not available');
    }
    return configMod.loadConfig();
  }

  // ═══════════════════════════════════════════════════════
  //  LIFECYCLE
  // ═══════════════════════════════════════════════════════

  /**
   * Initializes the OpenClaw gateway server.
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Default port for OpenClaw Gateway is 18789
      const startGatewayServer = await getStartGatewayServer();
      this.server = await (startGatewayServer as any)(18789);
      this.initialized = true;
      this.startTime = Date.now();
      console.log('OpenClaw Gateway initialized successfully.');
      
      // Hydrate tenant configurations into in-memory overrides
      await this.hydrateOverrides();
    } catch (error) {
      console.error('Failed to initialize OpenClaw Gateway:', error);
      throw error;
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public getEngine(): any | null {
    return this.server;
  }

  public async shutdown(): Promise<void> {
    if (this.server) {
      this.initialized = false;
      this.server = null;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  SKILLS
  // ═══════════════════════════════════════════════════════

  public async getSkillReport(): Promise<any> {
    try {
      const workspace = await this.safeImport('../../../openclaw/src/agents/skills/workspace.js');
      if (!workspace || typeof workspace.loadWorkspaceSkillEntries !== 'function') {
        throw new Error('OpenClaw loadWorkspaceSkillEntries is not available');
      }
      const skills = await workspace.loadWorkspaceSkillEntries(process.cwd());
      return { workspaceDir: process.cwd(), managedSkillsDir: '', skills: skills || [] };
    } catch (error: any) {
      console.error('Failed to load OpenClaw skills:', error);
      return { skills: [], error: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════
  //  AGENTS
  // ═══════════════════════════════════════════════════════

  public async getAgents(): Promise<any> {
    try {
      const cfg = await this.loadConfig();
      const sessionUtils = await this.safeImport('../../../openclaw/src/gateway/session-utils.js');
      if (!sessionUtils || typeof sessionUtils.listAgentsForGateway !== 'function') {
        throw new Error('OpenClaw listAgentsForGateway is not available');
      }
      const result = await sessionUtils.listAgentsForGateway(cfg);
      return { defaultId: result?.defaultId, agents: result?.agents || [] };
    } catch (error: any) {
      console.error('Failed to load OpenClaw agents:', error);
      return { agents: [], error: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════
  //  HEALTH
  // ═══════════════════════════════════════════════════════

  public async getHealth(): Promise<any> {
    try {
      const healthState = await this.safeImport('../../../openclaw/src/gateway/server/health-state.js');
      if (!healthState || typeof healthState.getHealthCache !== 'function') {
        throw new Error('OpenClaw getHealthCache is not available');
      }
      const health = await healthState.getHealthCache();
      return { ...health, uptimeMs: Date.now() - this.startTime };
    } catch (error: any) {
      return { status: 'error', uptimeMs: 0, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════
  //  CRON JOBS
  // ═══════════════════════════════════════════════════════

  private async getCronModule(): Promise<any> {
    const cronMod = await this.safeImport('../../../openclaw/src/cron/service.js');
    if (!cronMod) throw new Error('OpenClaw cron module is not available');
    return cronMod;
  }

  public async getCronStatus(): Promise<any> {
    try {
      const cron = await this.getCronModule();
      if (typeof cron.getCronStatus === 'function') {
        return await cron.getCronStatus();
      }
      // Fallback: If the function is not directly exported, construct from list
      const jobs = await this.listCronJobs();
      const enabledJobs = (jobs || []).filter((j: any) => j.enabled);
      const nextWakeAtMs = enabledJobs.reduce((min: number | null, j: any) => {
        const next = j.state?.nextRunAtMs;
        if (next == null) return min;
        return min == null ? next : Math.min(min, next);
      }, null as number | null);
      return { enabled: enabledJobs.length > 0, jobs: (jobs || []).length, nextWakeAtMs };
    } catch (error: any) {
      console.error('getCronStatus error:', error.message);
      return { enabled: false, jobs: 0, nextWakeAtMs: null };
    }
  }

  public async listCronJobs(): Promise<any[]> {
    try {
      const cron = await this.getCronModule();
      if (typeof cron.listCronJobs === 'function') {
        return await cron.listCronJobs({ includeDisabled: true });
      }
      return [];
    } catch (error: any) {
      console.error('listCronJobs error:', error.message);
      return [];
    }
  }

  public async addCronJob(params: any): Promise<any> {
    const cron = await this.getCronModule();
    if (typeof cron.addCronJob !== 'function') {
      throw new Error('OpenClaw addCronJob is not available');
    }
    return await cron.addCronJob(params);
  }

  public async updateCronJob(id: string, patch: any): Promise<any> {
    const cron = await this.getCronModule();
    if (typeof cron.updateCronJob !== 'function') {
      throw new Error('OpenClaw updateCronJob is not available');
    }
    return await cron.updateCronJob(id, patch);
  }

  public async removeCronJob(id: string): Promise<any> {
    const cron = await this.getCronModule();
    if (typeof cron.removeCronJob !== 'function') {
      throw new Error('OpenClaw removeCronJob is not available');
    }
    return await cron.removeCronJob(id);
  }

  public async runCronJob(id: string): Promise<any> {
    const cron = await this.getCronModule();
    if (typeof cron.runCronJob !== 'function') {
      throw new Error('OpenClaw runCronJob is not available');
    }
    return await cron.runCronJob(id, 'force');
  }

  public async getCronRuns(id: string, limit = 50): Promise<any> {
    try {
      const runLogMod = await this.safeImport('../../../openclaw/src/cron/run-log.js');
      if (!runLogMod) throw new Error('OpenClaw run-log module is not available');

      const { readCronRunLogEntries, resolveCronRunLogPath } = runLogMod;
      const cfg = await this.loadConfig();
      const logPath = resolveCronRunLogPath({ storePath: cfg.cronStorePath || cfg.storePath, jobId: id });
      const entries = await readCronRunLogEntries(logPath, { limit, jobId: id });
      return { entries };
    } catch (error: any) {
      console.error('getCronRuns error:', error.message);
      return { entries: [] };
    }
  }

  // ═══════════════════════════════════════════════════════
  //  USAGE & COST
  // ═══════════════════════════════════════════════════════

  private async getUsageModule(): Promise<any> {
    const usageMod = await this.safeImport('../../../openclaw/src/infra/session-cost-usage.js');
    if (!usageMod) throw new Error('OpenClaw usage module is not available');
    return usageMod;
  }

  public async getUsageTotals(days = 30): Promise<any> {
    try {
      const usage = await this.getUsageModule();
      if (!usage || typeof usage.loadCostUsageSummary !== 'function') {
        throw new Error('OpenClaw loadCostUsageSummary is not available');
      }
      return await usage.loadCostUsageSummary({ days });
    } catch (error: any) {
      console.error('getUsageTotals error:', error.message);
      return { days, totals: {}, daily: [] };
    }
  }

  public async getUsageDaily(days = 30): Promise<any> {
    try {
      const summary = await this.getUsageTotals(days);
      return { daily: summary?.daily || [] };
    } catch (error: any) {
      console.error('getUsageDaily error:', error.message);
      return { daily: [] };
    }
  }

  public async getUsageSessions(days = 30): Promise<any> {
    try {
      const usage = await this.getUsageModule();
      if (!usage || typeof usage.discoverAllSessions !== 'function') {
        throw new Error('OpenClaw discoverAllSessions is not available');
      }
      const sessions = await usage.discoverAllSessions({
        startMs: Date.now() - days * 24 * 60 * 60 * 1000
      });
      return { sessions };
    } catch (error: any) {
      console.error('getUsageSessions error:', error.message);
      return { sessions: [] };
    }
  }

  public async getSessionLogs(sessionId: string): Promise<any> {
    try {
      const usage = await this.getUsageModule();
      if (!usage || typeof usage.loadSessionCostSummary !== 'function') {
        throw new Error('OpenClaw loadSessionCostSummary is not available');
      }
      const summary = await usage.loadSessionCostSummary({ sessionId });
      return summary || { entries: [] };
    } catch (error: any) {
      console.error('getSessionLogs error:', error.message);
      return { entries: [] };
    }
  }

  // ═══════════════════════════════════════════════════════
  //  SESSIONS
  // ═══════════════════════════════════════════════════════

  public async listSessions(): Promise<any> {
    try {
      const cfg = await this.loadConfig();
      const sessionUtils = await this.safeImport('../../../openclaw/src/gateway/session-utils.js');
      if (!sessionUtils || typeof sessionUtils.loadCombinedSessionStoreForGateway !== 'function') {
        throw new Error('OpenClaw loadCombinedSessionStoreForGateway is not available');
      }
      const store = await sessionUtils.loadCombinedSessionStoreForGateway(cfg);
      const sessions = Object.entries(store || {}).map(([key, entry]: [string, any]) => ({
        key,
        kind: entry?.kind || 'unknown',
        label: entry?.label,
        displayName: entry?.displayName,
        updatedAt: entry?.updatedAt || null,
        sessionId: entry?.sessionId,
        model: entry?.model,
        modelProvider: entry?.modelProvider,
      }));
      return { ts: Date.now(), count: sessions.length, sessions };
    } catch (error: any) {
      console.error('listSessions error:', error.message);
      return { ts: Date.now(), count: 0, sessions: [] };
    }
  }

  public async deleteSession(key: string): Promise<any> {
    try {
      const sessionsPatchMod = await this.safeImport('../../../openclaw/src/gateway/sessions-patch.js');
      if (sessionsPatchMod && typeof sessionsPatchMod.deleteSession === 'function') {
        return await sessionsPatchMod.deleteSession(key);
      }
      throw new Error('OpenClaw deleteSession is not available');
    } catch (error: any) {
      console.error('deleteSession error:', error.message);
      throw error;
    }
  }

  public async patchSession(key: string, patch: any): Promise<any> {
    try {
      const sessionsPatchMod = await this.safeImport('../../../openclaw/src/gateway/sessions-patch.js');
      if (sessionsPatchMod && typeof sessionsPatchMod.applySessionsPatchToStore === 'function') {
        const cfg = await this.loadConfig();
        return await sessionsPatchMod.applySessionsPatchToStore(cfg, key, patch);
      }
      throw new Error('OpenClaw applySessionsPatchToStore is not available');
    } catch (error: any) {
      console.error('patchSession error:', error.message);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  NODES & DEVICES
  // ═══════════════════════════════════════════════════════

  public async listNodes(): Promise<any> {
    try {
      const nodePairing = await this.safeImport('../../../openclaw/src/infra/node-pairing.js');
      if (!nodePairing || typeof nodePairing.listNodePairing !== 'function') {
        throw new Error('OpenClaw listNodePairing is not available');
      }
      const list = await nodePairing.listNodePairing();
      return {
        nodes: list?.paired || [],
        pending: list?.pending || []
      };
    } catch (error: any) {
      console.error('listNodes error:', error.message);
      return { nodes: [], pending: [] };
    }
  }

  public async listDevices(): Promise<any> {
    try {
      const devicePairing = await this.safeImport('../../../openclaw/src/infra/device-pairing.js');
      if (!devicePairing || typeof devicePairing.listDevicePairing !== 'function') {
        throw new Error('OpenClaw listDevicePairing is not available');
      }
      const list = await devicePairing.listDevicePairing();
      return { pending: list?.pending || [], paired: list?.paired || [] };
    } catch (error: any) {
      console.error('listDevices error:', error.message);
      return { pending: [], paired: [] };
    }
  }

  public async approveDevice(requestId: string): Promise<any> {
    const devicePairing = await this.safeImport('../../../openclaw/src/infra/device-pairing.js');
    if (!devicePairing || typeof devicePairing.approveDevicePairing !== 'function') {
      throw new Error('OpenClaw approveDevicePairing is not available');
    }
    const approved = await devicePairing.approveDevicePairing(requestId);
    if (!approved) throw new Error('Unknown requestId');
    return { requestId, device: approved.device };
  }

  public async rejectDevice(requestId: string): Promise<any> {
    const devicePairing = await this.safeImport('../../../openclaw/src/infra/device-pairing.js');
    if (!devicePairing || typeof devicePairing.rejectDevicePairing !== 'function') {
      throw new Error('OpenClaw rejectDevicePairing is not available');
    }
    const rejected = await devicePairing.rejectDevicePairing(requestId);
    if (!rejected) throw new Error('Unknown requestId');
    return rejected;
  }

  public async revokeDevice(deviceId: string): Promise<any> {
    const devicePairing = await this.safeImport('../../../openclaw/src/infra/device-pairing.js');
    if (!devicePairing || typeof devicePairing.revokeDeviceToken !== 'function') {
      throw new Error('OpenClaw revokeDeviceToken is not available');
    }
    return await devicePairing.revokeDeviceToken({ deviceId, role: 'device' });
  }

  // ═══════════════════════════════════════════════════════
  //  LOGS
  // ═══════════════════════════════════════════════════════

  public async getLogs(opts: { limit?: number; level?: string }): Promise<any> {
    try {
      const loggingMod = await this.safeImport('../../../openclaw/src/logging.js');
      if (!loggingMod || typeof loggingMod.getResolvedLoggerSettings !== 'function') {
        throw new Error('OpenClaw logging module is not available');
      }
      const { file: logFile } = loggingMod.getResolvedLoggerSettings();

      const fs = await import('node:fs/promises');
      const stat = await fs.stat(logFile).catch(() => null);
      if (!stat) return { lines: [], cursor: 0, size: 0 };

      const limit = Math.min(opts.limit || 100, 5000);
      const maxBytes = 250_000;
      const size = stat.size;
      const start = Math.max(0, size - maxBytes);

      const handle = await fs.open(logFile, 'r');
      try {
        const length = Math.max(0, size - start);
        const buffer = Buffer.alloc(length);
        const readResult = await handle.read(buffer, 0, length, start);
        const text = buffer.toString('utf8', 0, readResult.bytesRead);
        const lines = text.split('\n').filter(Boolean);

        // Parse structured log lines (JSON)
        const parsed = lines.map((raw: string) => {
          try { return { ...JSON.parse(raw), raw }; }
          catch { return { raw, message: raw }; }
        });

        // Filter by level if requested
        const filtered = opts.level
          ? parsed.filter((e: any) => e.level === opts.level)
          : parsed;

        return { lines: filtered.slice(-limit), cursor: size, size };
      } finally {
        await handle.close();
      }
    } catch (error: any) {
      console.error('getLogs error:', error.message);
      return { lines: [], cursor: 0, size: 0 };
    }
  }

  public async streamLogs(onEntry: (entry: any) => void): Promise<(() => void) | null> {
    try {
      const loggingMod = await this.safeImport('../../../openclaw/src/logging.js');
      if (!loggingMod || typeof loggingMod.getResolvedLoggerSettings !== 'function') {
        throw new Error('OpenClaw logging module is not available');
      }
      const { file: logFile } = loggingMod.getResolvedLoggerSettings();

      const { watch } = await import('node:fs');
      let lastSize = 0;
      try {
        const fs = await import('node:fs/promises');
        const stat = await fs.stat(logFile);
        lastSize = stat.size;
      } catch { /* file may not exist yet */ }

      const watcher = watch(logFile, async () => {
        try {
          const fs = await import('node:fs/promises');
          const stat = await fs.stat(logFile);
          if (stat.size <= lastSize) { lastSize = stat.size; return; }
          const handle = await fs.open(logFile, 'r');
          try {
            const length = stat.size - lastSize;
            const buffer = Buffer.alloc(length);
            await handle.read(buffer, 0, length, lastSize);
            const text = buffer.toString('utf8');
            const lines = text.split('\n').filter(Boolean);
            for (const line of lines) {
              try { onEntry(JSON.parse(line)); }
              catch { onEntry({ raw: line, message: line }); }
            }
          } finally { await handle.close(); }
          lastSize = stat.size;
        } catch { /* ignore transient read errors */ }
      });

      return () => watcher.close();
    } catch (error: any) {
      console.error('streamLogs error:', error.message);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  BOOT-TIME HYDRATION
  // ═══════════════════════════════════════════════════════

  /**
   * Hydrates the in-memory config override store from Firestore on boot.
   * This ensures that tenant-specific configurations survive server restarts
   * without relying on the config.json5 file for tenant data.
   *
   * Should be called once during gateway initialization, after the engine starts.
   */
  public async hydrateOverrides(): Promise<void> {
    try {
      const overridesMod = await this.safeImport('../../../openclaw/src/config/runtime-overrides.js');
      if (!overridesMod) {
        console.warn('[OpenClawGateway] runtime-overrides module unavailable — skipping hydration');
        return;
      }

      const { setConfigOverride } = overridesMod;

      // Fetch all active tenants
      const tenants = await MultiTenantService.listTenants();
      if (!tenants || tenants.length === 0) {
        console.info('[OpenClawGateway] No tenants found for hydration');
        return;
      }

      let hydratedCount = 0;
      const { TenantConfigService } = await import('./tenantConfigService.js');
      const configService = TenantConfigService.getInstance();

      for (const tenant of tenants) {
        try {
          const settingsResult = await configService.getTenantSettings(tenant.id);
          if (!settingsResult.success) continue;

          // Flatten settings into dot-notation override paths
          const flattenObj = (obj: Record<string, unknown>, prefix: string): void => {
            for (const [key, value] of Object.entries(obj)) {
              const fullPath = `${prefix}.${key}`;
              if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                flattenObj(value as Record<string, unknown>, fullPath);
              } else {
                setConfigOverride(fullPath, value);
              }
            }
          };

          flattenObj(
            settingsResult.data as unknown as Record<string, unknown>,
            `acp.tenants.${tenant.id}.tenantSettings`
          );
          hydratedCount++;
        } catch (err) {
          console.warn(`[OpenClawGateway] Failed to hydrate tenant ${tenant.id}:`, err);
        }
      }

      console.info(`[OpenClawGateway] ✅ Hydrated ${hydratedCount}/${tenants.length} tenant configs into memory`);
    } catch (error: any) {
      console.error('[OpenClawGateway] Hydration failed:', error.message);
      // Non-fatal: the system can still operate with defaults
    }
  }

  // ═══════════════════════════════════════════════════════
  //  CONTROL PLANE (FUSION)
  // ═══════════════════════════════════════════════════════

  /**
   * Returns the current live configuration of the OpenClaw engine.
   */
  public async getLiveConfig(): Promise<any> {
    try {
      const snapshot = await this.loadConfig();
      return snapshot;
    } catch (error: any) {
      console.error('getLiveConfig error:', error.message);
      throw error;
    }
  }

  /**
   * Patches the OpenClaw configuration with multi-tenant isolation,
   * enterprise gating, and audit logging.
   */
  public async patchConfig(tenantId: string, patch: any, metadata: { actor: string; ip?: string }): Promise<any> {
    try {
      // 1. Enterprise Gating: Check plan limits
      const tenant = await MultiTenantService.getTenant(tenantId);
      if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

      const subscriptionResult = await BillingService.getSubscription(tenantId);
      if (!subscriptionResult.success) {
        throw new Error(`Failed to verify billing status for ${tenantId}`);
      }
      const subscription = subscriptionResult.data;
      const planLimits = getPlanLimits(subscription.plan as any);

      // Simple gating example: Webhook limit check if patch contains 'hooks'
      if (patch.hooks && Array.isArray(patch.hooks)) {
        if (subscription.plan !== 'enterprise') { // Simple gating example
           if (patch.hooks.length > planLimits.maxChannels) {
             throw new Error(`Plan ${subscription.plan} limit exceeded for webhooks`);
           }
        }
      }

      // 2. In-Memory Override (Zero-Downtime Config Sync)
      // Instead of writing to config.json5 and restarting the engine via SIGUSR1,
      // we leverage OpenClaw's native runtime-overrides system. Since DeXMart
      // imports OpenClaw as a library (same V8 heap), setConfigOverride() mutates
      // the in-memory store that applyConfigOverrides() reads from in io.ts:614.
      const overridesMod = await this.safeImport('../../../openclaw/src/config/runtime-overrides.js');

      if (!overridesMod) {
        throw new Error('OpenClaw runtime-overrides module is missing');
      }

      const { setConfigOverride } = overridesMod;

      // Flatten the patch object into dot-notation paths for setConfigOverride
      const flattenPatch = (obj: Record<string, unknown>, prefix = ''): Array<{ path: string; value: unknown }> => {
        const entries: Array<{ path: string; value: unknown }> = [];
        for (const [key, value] of Object.entries(obj)) {
          const fullPath = prefix ? `${prefix}.${key}` : key;
          if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            entries.push(...flattenPatch(value as Record<string, unknown>, fullPath));
          } else {
            entries.push({ path: fullPath, value });
          }
        }
        return entries;
      };

      // Namespace all overrides under the tenantId to prevent cross-tenant leakage
      const namespacedPatch = { acp: { tenants: { [tenantId]: patch } } };
      const overrideEntries = flattenPatch(namespacedPatch);
      const failedOverrides: string[] = [];

      for (const entry of overrideEntries) {
        const result = setConfigOverride(entry.path, entry.value);
        if (!result.ok) {
          failedOverrides.push(`${entry.path}: ${result.error}`);
        }
      }

      if (failedOverrides.length > 0) {
        throw new Error(`Config override failed for paths: ${failedOverrides.join(', ')}`);
      }

      // 3. Audit Logging
      await AuditService.logEvent({
        eventType: 'CONTROL_PLANE_PATCH',
        actor: metadata.actor,
        action: 'PATCH_ENGINE_CONFIG',
        resource: 'engine_config',
        resourceId: tenantId,
        riskLevel: 'LOW',
        ipAddress: metadata.ip,
        metadata: {
          patch,
          target: 'in_memory_override',
          overrideCount: overrideEntries.length
        }
      });

      return {
        ok: true,
        restart: null, // No restart needed — overrides are live immediately
        overrideCount: overrideEntries.length
      };

    } catch (error: any) {
      console.error('patchConfig error:', error.message);
      
      // Log failed attempt
      await AuditService.logEvent({
        eventType: 'CONTROL_PLANE_PATCH_ERROR',
        actor: metadata.actor,
        action: 'PATCH_ENGINE_CONFIG',
        resource: 'engine_config',
        resourceId: tenantId,
        riskLevel: 'MEDIUM',
        ipAddress: metadata.ip,
        details: { error: error.message },
        metadata: { patch }
      }).catch(() => {});

      throw error;
    }
  }
}
