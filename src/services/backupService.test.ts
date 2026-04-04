import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupService } from './backupService.js';
import { db } from '../lib/firebase.js';

vi.mock('../lib/firebase.js', () => ({
  db: {
    collection: vi.fn().mockReturnThis(),
    doc: vi.fn().mockReturnThis(),
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('./GoogleDriveService.js', () => ({
  googleDriveService: {
    uploadFile: vi.fn().mockResolvedValue({ success: true, data: { driveFileId: 'mock-drive-id', size: 1024 } })
  }
}));

describe('BackupService', () => {
  let service: BackupService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = BackupService.getInstance();
  });

  it('should run a backup and upload to Google Drive for a pro tenant', async () => {
    const tenantId = 'tenant-123';

    // Mock tenant doc fetching
    (db.get as any).mockResolvedValueOnce({
      exists: true,
      data: () => ({ plan: 'pro', googleRefreshToken: 'mock-token' })
    });
    // Mock the data scraping (contacts, messages, etc)
    (db.get as any).mockResolvedValue({
      docs: []
    });

    const result = await service.runBackup(tenantId, 'database');

    expect(result.success).toBe(true);
    expect(db.collection).toHaveBeenCalledWith('tenants');
    expect(db.doc).toHaveBeenCalledWith(tenantId);

    if (result.success) {
      expect(result.data.status).toBe('completed');
      expect(result.data.driveFileId).toBe('mock-drive-id');
      expect(result.data.size).toBe(1024);
    }
  });

  it('should prevent backups if tenant is on starter plan', async () => {
    const tenantId = 'tenant-free';

    (db.get as any).mockResolvedValueOnce({
      exists: true,
      data: () => ({ plan: 'starter' })
    });

    const result = await service.runBackup(tenantId, 'database');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('should prevent backups if Google Drive is not connected', async () => {
    const tenantId = 'tenant-pro-no-auth';

    (db.get as any).mockResolvedValueOnce({
      exists: true,
      data: () => ({ plan: 'pro' }) // No googleRefreshToken
    });

    const result = await service.runBackup(tenantId, 'database');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('should list backups for a tenant', async () => {
    const tenantId = 'tenant-123';
    const mockBackups = [
      { id: 'b1', type: 'database', status: 'completed', createdAt: { toDate: () => new Date() } },
    ];

    (db.get as any).mockResolvedValue({
      docs: mockBackups.map(b => ({
        id: b.id,
        data: () => b
      })),
      empty: false
    });

    const result = await service.listBackups(tenantId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('b1');
    }
  });
});
