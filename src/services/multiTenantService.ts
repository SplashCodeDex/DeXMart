import { firebaseService } from '@/services/FirebaseService.js';
import logger from '@/utils/logger.js';
import crypto from 'crypto';
import { Tenant, TenantSchema, Result, TenantUser, TenantUserSchema } from '@/types/index.js';
import { Timestamp } from 'firebase-admin/firestore';
import { getPlanLimits } from '@/utils/featureGating.js';
import { db } from '@/lib/firebase.js';

export class MultiTenantService {
  private static instance: MultiTenantService;

  private constructor() { }

  public static getInstance(): MultiTenantService {
    if (!MultiTenantService.instance) {
      MultiTenantService.instance = new MultiTenantService();
    }
    return MultiTenantService.instance;
  }

  /**
   * Initialize a new tenant with an owner and lookup entry (Atomic)
   */
  async initializeTenant(payload: {
    userId: string;
    email: string;
    displayName: string;
    tenantName: string;
    subdomain: string;
    plan?: string;
    photoURL?: string;
  }): Promise<Result<{ tenant: Tenant; user: TenantUser }>> {
    const { userId, email, displayName, tenantName, subdomain, plan: rawPlan = 'starter', photoURL } = payload;
    const tenantId = `tenant-${crypto.randomUUID()}`;

    // Type-safe plan narrowing
    const plan = (rawPlan.toLowerCase() === 'starter' || rawPlan.toLowerCase() === 'pro' || rawPlan.toLowerCase() === 'enterprise')
      ? (rawPlan.toLowerCase() as 'starter' | 'pro' | 'enterprise')
      : 'starter';

    const limits = getPlanLimits(plan);

    try {
      const result = await db.runTransaction(async (transaction) => {
        // 1. Create Tenant
        const tenantData: any = {
          id: tenantId,
          name: tenantName,
          subdomain: subdomain.toLowerCase(),
          plan: plan.toLowerCase(),
          subscriptionStatus: 'trialing',
          status: 'active',
          ownerId: userId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          trialEndsAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
          settings: {
            maxChannels: limits.maxChannels,
            aiEnabled: plan !== 'starter',
            timezone: 'UTC'
          }
        };
        const validatedTenant = TenantSchema.parse(tenantData);
        transaction.set(db.collection('tenants').doc(tenantId), validatedTenant);

        // 2. Create User in subcollection
        const userData: any = {
          id: userId,
          email,
          displayName,
          role: 'owner',
          plan: plan.toLowerCase(),
          subscriptionStatus: 'trialing',
          trialEndsAt: tenantData.trialEndsAt,
          joinedAt: Timestamp.now(),
          lastLogin: Timestamp.now(),
        };
        if (photoURL) userData.photoURL = photoURL;

        const validatedUser = TenantUserSchema.parse(userData);
        transaction.set(db.collection('tenants').doc(tenantId).collection('users').doc(userId), validatedUser);

        // 3. Create Global Lookup Entry
        transaction.set(db.collection('users').doc(userId), {
          id: userId,
          email,
          tenantId,
          role: 'owner',
          createdAt: Timestamp.now()
        });

        return { tenant: validatedTenant, user: validatedUser };
      });

      logger.info(`Tenant and Owner initialized: ${tenantId} / ${userId}`);

      // Ensure the system_default agent document exists.
      // This runs outside the Firestore transaction so it can use AgentService freely.
      // Non-fatal: if this fails, the agent is created lazily on first channel fetch.
      try {
        const { agentService } = await import('./AgentService.js');
        await agentService.ensureSystemAgent(tenantId);
      } catch (agentErr) {
        logger.warn(`[MultiTenantService] Could not pre-create system_default agent for ${tenantId}:`, agentErr);
      }

      return { success: true, data: result };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('MultiTenantService.initializeTenant error:', err);
      return { success: false, error: err };
    }
  }

  /**
   * Create a new tenant
   */
  async createTenant(tenantData: Partial<Tenant>): Promise<Result<Tenant>> {
    if (!tenantData.id) {
      return { success: false, error: new Error('Tenant ID is required') };
    }

    try {
      const plan = tenantData.plan || 'starter';
      const limits = getPlanLimits(plan);
      const maxChannels = limits.maxChannels;

      const rawData = {
        id: tenantData.id,
        name: tenantData.name || 'New Workspace',
        subdomain: (tenantData.subdomain || tenantData.id).toLowerCase(),
        plan: plan,
        subscriptionStatus: 'trialing',
        status: 'active',
        ownerId: tenantData.ownerId || '',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        trialEndsAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days trial
        settings: {
          maxChannels: maxChannels,
          aiEnabled: plan !== 'starter',
          timezone: 'UTC',
          ...tenantData.settings
        }
      };

      // Zero-Trust Validation before write
      const data = TenantSchema.parse(rawData);

      await firebaseService.setDoc('tenants', data.id, data);
      logger.info(`Tenant created: ${data.id}`);
      return { success: true, data };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`MultiTenantService.createTenant error [${tenantData.id}]:`, err);
      return { success: false, error: err };
    }
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<Result<Tenant>> {
    if (!tenantId) {
      return { success: false, error: new Error('Tenant ID is required for lookup') };
    }
    try {
      const doc = await firebaseService.getDoc('tenants', tenantId);
      if (!doc) {
        return { success: false, error: new Error(`Tenant not found: ${tenantId}`) };
      }

      // Zero-Trust Validation on read
      const data = TenantSchema.parse(doc);
      return { success: true, data };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`MultiTenantService.getTenant error [${tenantId}]:`, err);
      return { success: false, error: err };
    }
  }

  /**
   * Update tenant data
   */
  async updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Result<void>> {
    try {
      const result = await this.getTenant(tenantId);
      if (!result.success) return result as Result<never>;

      const updatedData = {
        ...result.data,
        ...updates,
        updatedAt: Timestamp.now()
      };

      // Validation
      const validated = TenantSchema.parse(updatedData);

      await firebaseService.setDoc('tenants', tenantId, validated);
      return { success: true, data: undefined };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`MultiTenantService.updateTenant error [${tenantId}]:`, err);
      return { success: false, error: err };
    }
  }

  /**
   * Alias for canAddChannel to satisfy plan middleware naming conventions.
   */
  async canAddBot(tenantId: string): Promise<Result<boolean>> {
    return this.canAddChannel(tenantId);
  }

  /**
   * Check if tenant has reached channel limit
   */
  async canAddChannel(tenantId: string): Promise<Result<boolean>> {
    const tenantResult = await this.getTenant(tenantId);
    if (!tenantResult.success) {
      logger.error(`MultiTenantService.canAddChannel failed to get tenant [${tenantId}]:`, tenantResult.error);
      return tenantResult as Result<never>;
    }

    const tenant = tenantResult.data;
    const plan = tenant.plan || 'starter';
    const limits = getPlanLimits(plan);
    const maxChannels = limits.maxChannels;

    try {
      // Get all channels for this tenant
      const { channelService } = await import('./ChannelService.js');
      const channelsResult = await channelService.getAllChannelsAcrossAgents(tenantId);
      const currentChannelCount = channelsResult.success ? channelsResult.data.length : 0;

      if (currentChannelCount >= maxChannels) {
        return {
          success: true,
          data: false
        };
      }

      return { success: true, data: true };
    } catch (error) {
      logger.error(`MultiTenantService.canAddChannel failed to count channels [${tenantId}]:`, error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * List all tenants (Admin only)
   */
  async listTenants(): Promise<Tenant[]> {
    try {
      const snapshot = await firebaseService.getCollection('tenants');
      return snapshot.map(doc => TenantSchema.parse(doc));
    } catch (error) {
      logger.error('MultiTenantService.listTenants error:', error);
      return [];
    }
  }
}

export const multiTenantService = MultiTenantService.getInstance();
export default multiTenantService;
