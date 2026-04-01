import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { toolRegistry } from './toolRegistry.js';
import logger from '@/utils/logger.js';
import { systemAuthorityService, PlanTier } from './SystemAuthorityService.js';
import type { Result } from '../types/index.js';

/**
 * Lazily import `loadWorkspaceSkillEntries` from the openclaw dist build.
 *
 * Why dynamic? The `tsx` loader incorrectly resolves the `types` export
 * condition from openclaw's package.json exports map, loading the raw `.ts`
 * source instead of the compiled `.js` dist. This causes the named export
 * to be missing at runtime.
 *
 * We locate the `openclaw` package by walking up from this file's directory
 * to find `node_modules/openclaw`, then import the compiled dist directly
 * via a `file://` URL (required on Windows where drive letters like `W:`
 * are mistaken for URL schemes).
 */
function findPackageRoot(startDir: string, packageName: string): string | null {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, 'node_modules', packageName, 'package.json');
    if (fs.existsSync(candidate)) return path.dirname(candidate);
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const _thisDir = path.dirname(fileURLToPath(import.meta.url));
const _openclawRoot = findPackageRoot(_thisDir, 'openclaw');
const _workspaceUrl = _openclawRoot
  ? pathToFileURL(path.join(_openclawRoot, 'dist', 'agents', 'skills', 'workspace.js')).href
  : null;

let _loadWorkspaceSkillEntries: ((workspaceDir: string, opts?: any) => any[]) | null = null;

async function getLoadWorkspaceSkillEntries() {
  if (!_loadWorkspaceSkillEntries) {
    if (!_workspaceUrl) {
      logger.warn('Could not locate openclaw package root, using empty fallback');
      _loadWorkspaceSkillEntries = () => [];
      return _loadWorkspaceSkillEntries;
    }
    
    try {
      const mod = await import(/* @vite-ignore */ _workspaceUrl);
      _loadWorkspaceSkillEntries = mod.loadWorkspaceSkillEntries;
      if (!_loadWorkspaceSkillEntries) {
        logger.warn('loadWorkspaceSkillEntries not found in openclaw module, using empty fallback');
        _loadWorkspaceSkillEntries = () => [];
      }
    } catch (error) {
      logger.error('Failed to dynamic import openclaw workspace:', error);
      _loadWorkspaceSkillEntries = () => [];
    }
  }
  return _loadWorkspaceSkillEntries;
}

/**
 * SkillsManager wraps OpenClaw's skills platform and handles
 * tier-based gating for DeXMart tenants.
 */
export class SkillsManager {
  private static instance: SkillsManager;

  private constructor() { }

  public static getInstance(): SkillsManager {
    if (!SkillsManager.instance) {
      SkillsManager.instance = new SkillsManager();
    }
    return SkillsManager.instance;
  }

  /**
   * Lists all available skills from the Unified Tool Registry.
   * This includes enriched schemas for FlowBuilder.
   */
  public async listAvailableSkills(tenantId?: string): Promise<any[]> {
    try {
      // Use the Unified Registry as the source of truth for "active" skills
      const tools = toolRegistry.getAllTools();

      // Also get the status report for installation/dependency info
      const loadFn = await getLoadWorkspaceSkillEntries();
      const statusEntries = await loadFn(process.cwd());

      // Get tenant-specific skill configuration if available
      let skillsConfig: Record<string, { enabled: boolean }> = {};
      let tier: PlanTier = 'starter';

      if (tenantId) {
        const { db } = await import('../lib/firebase.js');
        const tenantDoc = await db.collection('tenants').doc(tenantId).get();
        const data = tenantDoc.data();
        skillsConfig = data?.skillsConfig || {};
        tier = (data?.plan || 'starter') as PlanTier;
      }

      const caps = systemAuthorityService.getCapabilities(tier);

      return tools.map(tool => {
        const id = String(tool.name);
        const status = statusEntries.find((s: any) => s.skill?.name === id || s.metadata?.skillKey === id);
        const config = skillsConfig[id];

        // Determine required tier by checking where this skill first appears in the matrix
        let requiredTier: PlanTier = 'starter';
        if (!systemAuthorityService.isSkillAllowed('starter', id)) {
          requiredTier = systemAuthorityService.isSkillAllowed('pro', id) ? 'pro' : 'enterprise';
        }

        return {
          id,
          name: id,
          description: String(tool.description),
          parameters: tool.parameters,
          source: tool.source,
          category: tool.category || (tool.source === 'openclaw' ? 'Intelligence' : 'System'),
          emoji: status?.metadata?.emoji || (tool.source === 'openclaw' ? '🧠' : '⚙️'),
          enabled: config !== undefined ? config.enabled : false, // Default to false (Disabled by Default)
          requiredTier,
          status: status ? {
            disabled: config !== undefined ? !config.enabled : true,
            install: status.metadata?.install
          } : undefined
        };
      });
    } catch (error) {
      logger.error('Failed to list available skills:', error);
      return [];
    }
  }

  /**
   * Checks if a tenant is eligible for a specific skill based on their tier.
   */
  public async isTenantEligible(tenantId: string, skillId: string, tier?: PlanTier): Promise<boolean> {
    if (!tier) {
      const { db } = await import('../lib/firebase.js');
      const doc = await db.collection('tenants').doc(tenantId).get();
      tier = (doc.data()?.plan || 'starter') as PlanTier;
    }
    return systemAuthorityService.isSkillAllowed(tier, skillId);
  }

  /**
   * Securely execute a skill after verifying authority
   */
  public async executeSecureSkill(tenantId: string, skillId: string, params: any, context: any): Promise<Result<any>> {
    try {
      // 1. Gating Check
      const eligible = await this.isTenantEligible(tenantId, skillId);
      if (!eligible) {
        return { success: false, error: new Error(`UNAUTHORIZED_SKILL: Your current plan does not include the '${skillId}' skill.`) };
      }

      // 2. Execution
      return await toolRegistry.executeTool(skillId, params, context);
    } catch (error: any) {
      return { success: false, error };
    }
  }

  /**
   * Toggles a skill for a specific tenant.
   */
  public async toggleSkill(tenantId: string, skillId: string, enabled: boolean): Promise<any> {
    try {
      const { db } = await import('../lib/firebase.js');
      const tenantRef = db.collection('tenants').doc(tenantId);

      const doc = await tenantRef.get();
      if (!doc.exists) throw new Error('Tenant not found');

      const currentSkills = doc.data()?.skillsConfig || {};

      await tenantRef.set({
        skillsConfig: {
          ...currentSkills,
          [skillId]: { enabled }
        }
      }, { merge: true });

      logger.info(`Skill [${skillId}] ${enabled ? 'enabled' : 'disabled'} for tenant ${tenantId}`);
      return { skillId, enabled };
    } catch (error) {
      logger.error(`Failed to toggle skill ${skillId}:`, error);
      throw error;
    }
  }
}

export const skillsManager = SkillsManager.getInstance();
