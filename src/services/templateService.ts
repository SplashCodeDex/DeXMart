import { firebaseService } from './FirebaseService.js';
import { TemplateSchema, MessageTemplate, Result } from '../types/contracts.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

export class TemplateService {
  private static instance: TemplateService;

  private constructor() {}

  public static getInstance(): TemplateService {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService();
    }
    return TemplateService.instance;
  }

  public async createTemplate(
    tenantId: string,
    data: Omit<MessageTemplate, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
  ): Promise<Result<MessageTemplate>> {
    try {
      const id = `tpl_${crypto.randomUUID()}`;
      const template: MessageTemplate = {
        ...data,
        id,
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const validation = TemplateSchema.safeParse(template);
      if (!validation.success) {
        return { success: false, error: new Error(validation.error.issues[0].message) };
      }

      await firebaseService.setDoc<'tenants/{tenantId}/templates'>('templates', id, template, tenantId);
      return { success: true, data: template };
    } catch (error: any) {
      logger.error('Error creating template', error);
      return { success: false, error };
    }
  }

  public async getTemplates(tenantId: string): Promise<Result<MessageTemplate[]>> {
    try {
      const templates = await firebaseService.getCollection<'tenants/{tenantId}/templates'>('templates', tenantId);
      return { success: true, data: templates };
    } catch (error: any) {
      logger.error('Error fetching templates', error);
      return { success: false, error };
    }
  }

  public async getTemplate(tenantId: string, templateId: string): Promise<Result<MessageTemplate | null>> {
    try {
      const template = await firebaseService.getDoc<'tenants/{tenantId}/templates'>('templates', templateId, tenantId);
      return { success: true, data: template };
    } catch (error: any) {
      logger.error('Error fetching template', error);
      return { success: false, error };
    }
  }

  public async deleteTemplate(tenantId: string, templateId: string): Promise<Result<void>> {
    try {
      await firebaseService.deleteDoc<'tenants/{tenantId}/templates'>('templates', templateId, tenantId);
      return { success: true, data: undefined };
    } catch (error: any) {
      logger.error('Error deleting template', error);
      return { success: false, error };
    }
  }
}