import logger from '@/utils/logger.js';
import { firebaseService } from '@/services/FirebaseService.js';
import { Result } from '../types/contracts.js';
import { Timestamp } from 'firebase-admin/firestore';

export interface ChannelSlot {
    id: string;
    type: 'whatsapp' | 'telegram' | 'discord';
    status: 'connected' | 'disconnected' | 'qr_pending' | 'error';
    linkedAgentId: string | null;
    tenantId: string;
    updatedAt: any;
}

/**
 * Unified Channel Manager Service
 * 
 * Manages "Connectivity Slots" (Phones) and their dynamic links to "Agents" (Brains).
 */
export class ChannelManagerService {
    private static instance: ChannelManagerService;

    private constructor() {}

    public static getInstance(): ChannelManagerService {
        if (!ChannelManagerService.instance) {
            ChannelManagerService.instance = new ChannelManagerService();
        }
        return ChannelManagerService.instance;
    }

    /**
     * Links an Agent (Brain) to a specific Channel Slot (Phone).
     */
    public async linkAgentToSlot(
        tenantId: string, 
        slotId: string, 
        agentId: string
    ): Promise<Result<void>> {
        try {
            logger.info(`Linking agent ${agentId} to slot ${slotId} for tenant ${tenantId}`);

            // 1. Verify Agent exists (Simplified for this phase)
            // Ideally check tenants/{tenantId}/agents/{agentId}

            // 2. Update Slot in Firestore
            await firebaseService.setDoc<'tenants/{tenantId}/slots'>(
                'slots', 
                slotId, 
                { 
                    linkedAgentId: agentId, 
                    updatedAt: Timestamp.now() 
                } as any, 
                tenantId, 
                true
            );

            return { success: true, data: undefined };
        } catch (error: any) {
            logger.error(`Failed to link agent ${agentId} to slot ${slotId}:`, error);
            return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
        }
    }

    /**
     * Unlinks an Agent from a Channel Slot.
     */
    public async unlinkAgentFromSlot(
        tenantId: string, 
        slotId: string
    ): Promise<Result<void>> {
        try {
            await firebaseService.setDoc<'tenants/{tenantId}/slots'>(
                'slots', 
                slotId, 
                { 
                    linkedAgentId: null, 
                    updatedAt: Timestamp.now() 
                } as any, 
                tenantId, 
                true
            );
            return { success: true, data: undefined };
        } catch (error: any) {
            return { success: false, error: error as Error };
        }
    }
}

export const channelManagerService = ChannelManagerService.getInstance();
