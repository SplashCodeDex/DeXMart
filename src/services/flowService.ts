import { db } from '../lib/firebase.js';
import logger from '../utils/logger.js';
import { Result } from '../types/index.js';
import { Timestamp } from 'firebase-admin/firestore';

export interface FlowData {
  id: string;
  name: string;
  description?: string;
  nodes: any[];
  edges: any[];
  isActive: boolean;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class FlowService {
  private static instance: FlowService;

  private constructor() {}

  public static getInstance(): FlowService {
    if (!FlowService.instance) {
      FlowService.instance = new FlowService();
    }
    return FlowService.instance;
  }

  async saveFlow(tenantId: string, flowData: Partial<FlowData>): Promise<Result<FlowData>> {
    try {
      const id = flowData.id || `flow_${Date.now()}`;
      const now = new Date();

      const data = {
        ...flowData,
        id,
        tenantId,
        updatedAt: Timestamp.fromDate(now),
        createdAt: flowData.createdAt ? Timestamp.fromDate(flowData.createdAt) : Timestamp.fromDate(now),
      };

      await db.collection('tenants').doc(tenantId).collection('flows').doc(id).set(data, { merge: true });

      logger.info(`Flow ${id} saved for tenant ${tenantId}`);
      
      return { 
        success: true, 
        data: { ...data, createdAt: now, updatedAt: now } as unknown as FlowData 
      };
    } catch (error: any) {
      logger.error('FlowService.saveFlow error:', error);
      return { success: false, error };
    }
  }

  async getFlow(tenantId: string, flowId: string): Promise<Result<FlowData>> {
    try {
      const doc = await db.collection('tenants').doc(tenantId).collection('flows').doc(flowId).get();
      
      if (!doc.exists) {
        return { success: false, error: new Error('Flow not found') };
      }

      const data = doc.data();
      return { 
        success: true, 
        data: {
          ...data,
          createdAt: data?.createdAt?.toDate?.() || data?.createdAt,
          updatedAt: data?.updatedAt?.toDate?.() || data?.updatedAt,
        } as FlowData 
      };
    } catch (error: any) {
      return { success: false, error };
    }
  }

  async listFlows(tenantId: string): Promise<Result<FlowData[]>> {
    try {
      const snapshot = await db.collection('tenants').doc(tenantId).collection('flows').get();
      const flows = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        } as FlowData;
      });
      return { success: true, data: flows };
    } catch (error: any) {
      return { success: false, error };
    }
  }

  async listActiveFlows(tenantId: string): Promise<Result<FlowData[]>> {
    try {
      const snapshot = await db.collection('tenants').doc(tenantId).collection('flows')
        .where('isActive', '==', true)
        .get();
      
      const flows = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        } as FlowData;
      });
      return { success: true, data: flows };
    } catch (error: any) {
      return { success: false, error };
    }
  }

  async deleteFlow(tenantId: string, flowId: string): Promise<Result<void>> {
    try {
      await db.collection('tenants').doc(tenantId).collection('flows').doc(flowId).delete();
      return { success: true, data: undefined };
    } catch (error: any) {
      return { success: false, error };
    }
  }
}

export const flowService = FlowService.getInstance();
export default flowService;
