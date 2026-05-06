import logger from "@/utils/logger.js";
import { getCapabilities, PlanTier } from "../billing/auth-guard.js";
import * as cronOps from "../cron/service/ops.js";
import type { CronServiceState } from "../cron/service/state.js";
import type { CronJobCreate } from "../cron/types.js";

export interface FrequencyValidationResult {
  allowed: boolean;
  message?: string;
}

/**
 * CronManagerService — Policy + Execution layer for scheduled tasks.
 *
 * Responsibilities:
 *   1. Policy: validates that the requested schedule interval is allowed
 *      for the user's billing tier (via auth-guard capabilities)
 *   2. Execution: delegates job CRUD to OpenClaw's cron engine (src/cron/service/ops.ts)
 *
 * The OpenClaw cron engine (ops.ts) manages job storage, locking, state
 * persistence, and execution. CronManagerService enforces per-user tier limits
 * before any job is created or updated.
 *
 * Usage:
 *   const result = await cronManagerService.scheduleJob(cronState, 'pro', {
 *     name: 'daily-report',
 *     schedule: '0 9 * * *',   // 9am daily
 *     ... (CronJobCreate fields)
 *   });
 */
export class CronManagerService {
  private static instance: CronManagerService;

  private constructor() {}

  public static getInstance(): CronManagerService {
    if (!CronManagerService.instance) {
      CronManagerService.instance = new CronManagerService();
    }
    return CronManagerService.instance;
  }

  /**
   * Validates if the requested interval is allowed for the user's tier.
   *
   * @param tier      - User's billing plan tier
   * @param intervalMs - Requested interval in milliseconds
   */
  public validateFrequency(tier: PlanTier, intervalMs: number): FrequencyValidationResult {
    const caps = getCapabilities(tier);
    const minInterval = caps.minCronIntervalMs;

    if (intervalMs < minInterval) {
      const minDisplay =
        minInterval / (60 * 1000) >= 60
          ? `${minInterval / (60 * 60 * 1000)} hour(s)`
          : `${minInterval / (60 * 1000)} minutes`;
      const tierDisplay = tier.charAt(0).toUpperCase() + tier.slice(1);
      return {
        allowed: false,
        message: `Frequency too high. Your ${tierDisplay} plan allows a minimum interval of ${minDisplay}.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Validates frequency then creates a job in the cron engine.
   *
   * This is the fusion wiring point: DeXMart's tier policy + OpenClaw's cron execution.
   *
   * @param state      - OpenClaw CronServiceState (from createCronServiceState)
   * @param tier       - User's billing plan tier
   * @param intervalMs - The job's execution interval in ms (for tier validation)
   * @param job        - Job creation params (passed to ops.add)
   */
  public async scheduleJob(
    state: CronServiceState,
    tier: PlanTier,
    intervalMs: number,
    job: CronJobCreate,
  ): Promise<{ ok: boolean; error?: string; jobId?: string }> {
    // 1. Policy check: is the interval allowed for this tier?
    const validation = this.validateFrequency(tier, intervalMs);
    if (!validation.allowed) {
      return { ok: false, error: validation.message };
    }

    // 2. Execution: delegate to OpenClaw's cron engine
    try {
      const result = await cronOps.add(state, job);
      logger.info(`[CronManager] Scheduled job '${job.agentId ?? "unknown"}' for ${tier} tier`);
      return { ok: true, jobId: result?.id };
    } catch (err: any) {
      logger.error("[CronManager] Failed to schedule job:", err);
      return { ok: false, error: err?.message ?? "Failed to schedule job" };
    }
  }

  /**
   * Updates an existing cron job — validates new interval if provided.
   *
   * @param state      - OpenClaw CronServiceState
   * @param tier       - User's billing plan tier
   * @param jobId      - ID of the job to update
   * @param intervalMs - New interval (if changing frequency, triggers tier check)
   * @param patch      - Fields to update
   */
  public async updateJob(
    state: CronServiceState,
    tier: PlanTier,
    jobId: string,
    intervalMs: number | undefined,
    patch: Parameters<typeof cronOps.update>[2],
  ): Promise<{ ok: boolean; error?: string }> {
    if (intervalMs !== undefined) {
      const validation = this.validateFrequency(tier, intervalMs);
      if (!validation.allowed) {
        return { ok: false, error: validation.message };
      }
    }

    try {
      await cronOps.update(state, jobId, patch);
      return { ok: true };
    } catch (err: any) {
      logger.error(`[CronManager] Failed to update job ${jobId}:`, err);
      return { ok: false, error: err?.message ?? "Failed to update job" };
    }
  }

  /**
   * Removes a cron job from the engine.
   */
  public async removeJob(
    state: CronServiceState,
    jobId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      await cronOps.remove(state, jobId);
      return { ok: true };
    } catch (err: any) {
      logger.error(`[CronManager] Failed to remove job ${jobId}:`, err);
      return { ok: false, error: err?.message ?? "Failed to remove job" };
    }
  }
}

export const cronManagerService = CronManagerService.getInstance();
