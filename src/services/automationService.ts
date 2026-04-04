import { db } from '../lib/firebase.js';
import logger from '../utils/logger.js';
import { Result } from '../types/index.js';
import { Timestamp } from 'firebase-admin/firestore';

export interface AutomationTrigger {
    type: 'message_received' | 'contact_tagged' | 'timer' | 'webhook';
    config: Record<string, any>;
}

export interface AutomationAction {
    type: 'send_message' | 'apply_tag' | 'notify_admin' | 'ai_process' | 'execute_skill';
    config: Record<string, any>;
}

export interface Automation {
    id: string;
    tenantId: string;
    name: string;
    description?: string;
    trigger: AutomationTrigger;
    actions: AutomationAction[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export class AutomationService {
    private static instance: AutomationService;

    private constructor() { }

    public static getInstance(): AutomationService {
        if (!AutomationService.instance) {
            AutomationService.instance = new AutomationService();
        }
        return AutomationService.instance;
    }

    async createAutomation(tenantId: string, data: Partial<Automation>): Promise<Result<Automation>> {
        try {
            const id = `auto_${Date.now()}`;
            const now = new Date();
            const automation: Automation = {
                id,
                tenantId,
                name: data.name || 'New Automation',
                description: data.description,
                trigger: data.trigger || { type: 'message_received', config: {} },
                actions: data.actions || [],
                isActive: data.isActive ?? true,
                createdAt: now,
                updatedAt: now,
            };

            await db.collection('tenants').doc(tenantId).collection('automations').doc(id).set({
                ...automation,
                createdAt: Timestamp.fromDate(automation.createdAt),
                updatedAt: Timestamp.fromDate(automation.updatedAt),
            });

            return { success: true, data: automation };
        } catch (error: any) {
            logger.error('AutomationService.createAutomation error:', error);
            return { success: false, error };
        }
    }

    async listAutomations(tenantId: string): Promise<Result<Automation[]>> {
        try {
            const snapshot = await db.collection('tenants').doc(tenantId).collection('automations').get();
            const automations = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    createdAt: data.createdAt?.toDate?.() || data.createdAt,
                    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
                } as Automation;
            });
            return { success: true, data: automations };
        } catch (error: any) {
            return { success: false, error };
        }
    }

    async toggleAutomation(tenantId: string, id: string, isActive: boolean): Promise<Result<void>> {
        try {
            await db.collection('tenants').doc(tenantId).collection('automations').doc(id).update({
                isActive,
                updatedAt: Timestamp.now(),
            });
            return { success: true, data: undefined };
        } catch (error: any) {
            return { success: false, error };
        }
    }

    /**
     * Executes an automation. Implementation pending in Mastermind.
     */
    async executeAutomation(tenantId: string, automationId: string, context: any): Promise<void> {
        logger.info(`[AutomationService] Executing automation ${automationId} for tenant ${tenantId} (Pending implementation)`);
        // Implementation would involve iterating over actions
    }
}

export const automationService = AutomationService.getInstance();
export default automationService;
