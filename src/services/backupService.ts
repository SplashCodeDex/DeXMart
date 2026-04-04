import { db } from '../lib/firebase.js';
import logger from '../utils/logger.js';
import { Result } from '../types/index.js';
import { Timestamp } from 'firebase-admin/firestore';
import { googleDriveService } from './GoogleDriveService.js';
import { AppError, failure, success } from '../types/result.js';
import { Readable } from 'stream';

export interface BackupMetadata {
  id: string;
  tenantId: string;
  type: 'full' | 'database' | 'media';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  filePath?: string;
  driveFileId?: string;
  size?: number;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * Google Drive Backup Service
 * 2026 Mastermind Edition - Scalable & Resilient
 */
export class BackupService {
  private static instance: BackupService;

  private constructor() { }

  public static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  /**
   * Run an automated backup for a tenant
   */
  async runBackup(tenantId: string, type: 'full' | 'database' | 'media' = 'database'): Promise<Result<BackupMetadata>> {
    const backupId = `bak_${Date.now()}`;
    logger.info(`Starting ${type} backup for tenant ${tenantId} [ID: ${backupId}]`);

    try {
      // 1. Validate Billing & Auth configuration
      const tenantDoc = await db.collection('tenants').doc(tenantId).get();
      if (!tenantDoc.exists) {
        return failure(AppError.notFound('Tenant not found'));
      }

      const tenantData = tenantDoc.data()!;
      if (!['pro', 'enterprise'].includes(tenantData.plan || 'starter')) {
        return failure(AppError.forbidden('Google Drive backups are restricted to Pro and Enterprise plans.'));
      }

      if (!tenantData.googleRefreshToken) {
        return failure(AppError.badRequest('Google Drive integration is not connected. Please authorize in settings.'));
      }

      // 2. Initialize backup record
      const metadata: BackupMetadata = {
        id: backupId,
        tenantId,
        type,
        status: 'in_progress',
        createdAt: new Date()
      };

      await this.saveMetadata(metadata);

      // 3. Perform the actual backup
      // First, get the data buffer/stream
      let fileStream: Readable;
      let fileName: string;
      let mimeType: string;

      if (type === 'media' || type === 'full') {
        // Zipping media logic goes here when needed
        // We throw for now until the media archiver is written
        throw AppError.badRequest('Media/Full backup archiving is currently under construction.');
      } else {
        const dbExport = await this.exportTenantDatabase(tenantId);
        const jsonBuffer = Buffer.from(JSON.stringify(dbExport, null, 2));
        fileStream = Readable.from(jsonBuffer);
        fileName = `DeXMart_DB_Backup_${tenantId}_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      }

      // 4. Upload to user's Google Drive via GoogleDriveService
      const uploadResult = await googleDriveService.uploadFile(
        tenantData.googleRefreshToken,
        fileName,
        mimeType,
        fileStream
      );

      if (!uploadResult.success) {
        throw uploadResult.error;
      }

      // 5. Update record with success
      metadata.status = 'completed';
      metadata.completedAt = new Date();
      metadata.driveFileId = uploadResult.data.driveFileId;
      metadata.size = uploadResult.data.size;

      await this.saveMetadata(metadata);

      logger.info(`Backup ${backupId} completed successfully for tenant ${tenantId}`);
      return success(metadata);

    } catch (error: any) {
      logger.error(`Backup ${backupId} failed for tenant ${tenantId}:`, { error: error.message });

      const metadata: Partial<BackupMetadata> = {
        status: 'failed',
        error: error.message || 'Unknown backup error'
      };
      await db.collection('tenants').doc(tenantId).collection('backups').doc(backupId).set(metadata, { merge: true });

      return failure(error instanceof AppError ? error : AppError.internal(metadata.error as string));
    }
  }

  private async saveMetadata(metadata: BackupMetadata) {
    const { id, tenantId, ...data } = metadata;
    await db.collection('tenants').doc(tenantId).collection('backups').doc(id).set({
      ...data,
      updatedAt: Timestamp.now(),
      createdAt: metadata.createdAt ? Timestamp.fromDate(metadata.createdAt) : Timestamp.now(),
      completedAt: metadata.completedAt ? Timestamp.fromDate(metadata.completedAt) : null
    }, { merge: true });
  }

  private async exportTenantDatabase(tenantId: string): Promise<Record<string, any>> {
    const backupPayload: Record<string, any> = {};
    const tenantRef = db.collection('tenants').doc(tenantId);

    // List of targeted subcollections for database backups
    const collectionsToBackup = ['contacts', 'messages', 'flows', 'campaigns'];

    for (const collectionName of collectionsToBackup) {
      const snap = await tenantRef.collection(collectionName).get();
      backupPayload[collectionName] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    return backupPayload;
  }

  async listBackups(tenantId: string): Promise<Result<BackupMetadata[]>> {
    try {
      const snapshot = await db.collection('tenants').doc(tenantId).collection('backups')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();

      const backups = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          tenantId,
          ...data,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          completedAt: data.completedAt?.toDate?.() || data.completedAt,
        } as BackupMetadata;
      });

      return { success: true, data: backups };
    } catch (error: any) {
      return { success: false, error };
    }
  }
}

export const backupService = BackupService.getInstance();
export default backupService;
