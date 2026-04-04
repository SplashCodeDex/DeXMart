import { firebaseService } from '@/services/FirebaseService.js';
import { Agent, AgentSchema, Result } from '../types/contracts.js';
import { Timestamp } from 'firebase-admin/firestore';
import logger from '@/utils/logger.js';
import channelService from './ChannelService.js';
import { systemAuthorityService } from './SystemAuthorityService.js';

/**
 * Agent Service
 *
 * Manages AI Agents (Brains) and provides the parent scope for Active Channels.
 */
export class AgentService {
  private static instance: AgentService;

  private constructor() { }

  public static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  /**
   * Ensure a system_default agent exists for the tenant.
   * Required for Webhook-Only connectivity.
   */
  async ensureSystemAgent(tenantId: string): Promise<Result<Agent>> {
    try {
      const systemAgentId = 'system_default';
      const existing = await firebaseService.getDoc<'tenants/{tenantId}/agents'>('agents', systemAgentId, tenantId);

      if (existing) {
        return { success: true, data: existing as Agent };
      }

      const rawAgent = {
        id: systemAgentId,
        name: 'System Default Agent',
        personality: 'A background system agent for standard connectivity.',
        memorySearch: false,
        boundChannels: [],
        skills: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const agent = AgentSchema.parse(rawAgent);
      await firebaseService.setDoc<'tenants/{tenantId}/agents'>('agents', systemAgentId, agent as any, tenantId);

      logger.info(`System Default Agent created for tenant ${tenantId}`);
      return { success: true, data: agent };
    } catch (error: any) {
      logger.error(`AgentService.ensureSystemAgent error [${tenantId}]:`, error);
      return { success: false, error };
    }
  }

  /**
   * Get an agent by ID
   */
  async getAgent(tenantId: string, agentId: string): Promise<Result<Agent>> {
    try {
      const doc = await firebaseService.getDoc<'tenants/{tenantId}/agents'>('agents', agentId, tenantId);
      if (!doc) {
        return { success: false, error: new Error(`Agent not found: ${agentId}`) };
      }
      return { success: true, data: doc as Agent };
    } catch (error: any) {
      return { success: false, error };
    }
  }

  /**
   * List all agents for a tenant
   */
  async getAllAgents(tenantId: string): Promise<Result<Agent[]>> {
    try {
      const docs = await firebaseService.getCollection<'tenants/{tenantId}/agents'>('agents', tenantId);
      return { success: true, data: docs as Agent[] };
    } catch (error: any) {
      return { success: false, error };
    }
  }

  /**
   * Create a custom AI Agent
   */
  async createAgent(tenantId: string, agentData: Partial<Agent>): Promise<Result<Agent>> {
    try {
      // 1. Check authority for agent creation
      const auth = await systemAuthorityService.checkAuthority(tenantId, 'create_agent');
      if (!auth.allowed) {
        return { success: false, error: new Error(auth.error || 'Agent creation limit reached') };
      }

      const agentId = agentData.id || `agent_${Date.now()}`;
      const rawAgent = {
        ...agentData,
        id: agentId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        boundChannels: [],
        skills: agentData.skills || [],
        memorySearch: agentData.memorySearch ?? true
      };

      const agent = AgentSchema.parse(rawAgent);
      await firebaseService.setDoc<'tenants/{tenantId}/agents'>('agents', agentId, agent as any, tenantId);

      // 2. Record usage
      await systemAuthorityService.recordUsage(tenantId, 'agents', 1);

      return { success: true, data: agent };
    } catch (error: any) {
      return { success: false, error };
    }
  }

  /**
   * Delete an agent and logically cascade to connections
   */
  async deleteAgent(tenantId: string, agentId: string): Promise<Result<void>> {
    try {
      if (agentId === 'system_default') {
        throw new Error('Cannot delete the system default agent.');
      }

      // 1. Get all child channels
      const channelsResult = await channelService.getChannelsForAgent(tenantId, agentId);
      if (channelsResult.success) {
        // 2. Shut down and delete each channel
        for (const channel of channelsResult.data) {
          logger.info(`Cascading delete: Removing channel ${channel.id} for agent ${agentId}`);
          await channelService.deleteChannel(tenantId, channel.id, agentId);
        }
      }

      // 3. Delete the agent itself
      await firebaseService.deleteDoc<'tenants/{tenantId}/agents'>('agents', agentId, tenantId);

      // 4. Record usage decrement
      await systemAuthorityService.recordUsage(tenantId, 'agents', -1);

      logger.info(`Agent ${agentId} deleted for tenant ${tenantId}`);
      return { success: true, data: undefined };
    } catch (error: any) {
      return { success: false, error };
    }
  }
}

export const agentService = AgentService.getInstance();
export default agentService;
