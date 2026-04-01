import { socketService } from './socketService.js';
import logger from '../utils/logger.js';

export type MastermindEventType = 
    | 'reasoning:start'
    | 'reasoning:thought'
    | 'tool:invoke'
    | 'tool:result'
    | 'agent:spawn'
    | 'reasoning:complete'
    | 'reasoning:error';

export interface MastermindEventPayload {
    agentId: string;
    sessionId?: string;
    parentAgentId?: string;
    content?: string;
    toolName?: string;
    params?: any;
    result?: any;
    error?: string;
    stage?: 'planning' | 'researching' | 'auditing' | 'synthesizing' | 'executing';
}

/**
 * MastermindStreamService
 * 
 * Encapsulates real-time reasoning event emission for DeXMart Agents.
 * Uses the unified SocketService for tenant-scoped delivery.
 */
export class MastermindStreamService {
    private static instance: MastermindStreamService;

    private constructor() {}

    public static getInstance(): MastermindStreamService {
        if (!MastermindStreamService.instance) {
            MastermindStreamService.instance = new MastermindStreamService();
        }
        return MastermindStreamService.instance;
    }

    /**
     * Emits a mastermind event to the tenant's socket room.
     */
    public emit(tenantId: string, type: MastermindEventType, payload: MastermindEventPayload): void {
        try {
            socketService.emitToTenant(tenantId, 'mastermind_event', {
                type,
                ...payload
            });
            
            logger.debug(`[MastermindStream] Emitted ${type} for agent ${payload.agentId} (Tenant: ${tenantId})`);
        } catch (error: any) {
            logger.error(`[MastermindStream] Failed to emit ${type}:`, error);
        }
    }

    // --- Helper Methods for common events ---

    public start(tenantId: string, agentId: string, sessionId?: string) {
        this.emit(tenantId, 'reasoning:start', { agentId, sessionId });
    }

    public thought(tenantId: string, agentId: string, content: string, stage?: MastermindEventPayload['stage']) {
        this.emit(tenantId, 'reasoning:thought', { agentId, content, stage });
    }

    public invokeTool(tenantId: string, agentId: string, toolName: string, params: any) {
        this.emit(tenantId, 'tool:invoke', { agentId, toolName, params });
    }

    public toolResult(tenantId: string, agentId: string, toolName: string, result: any) {
        this.emit(tenantId, 'tool:result', { agentId, toolName, result });
    }

    public spawnAgent(tenantId: string, parentAgentId: string, childAgentId: string, task: string) {
        this.emit(tenantId, 'agent:spawn', { agentId: childAgentId, parentAgentId, content: task });
    }

    public complete(tenantId: string, agentId: string, content?: string) {
        this.emit(tenantId, 'reasoning:complete', { agentId, content });
    }

    public error(tenantId: string, agentId: string, error: string) {
        this.emit(tenantId, 'reasoning:error', { agentId, error });
    }
}

export const mastermindStreamService = MastermindStreamService.getInstance();
