import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TemplateService } from './templateService.js';
import { FirebaseService } from './FirebaseService.js';

// Mock dependencies
const { mockFirebase } = vi.hoisted(() => ({
  mockFirebase: {
    getCollection: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn(),
    deleteDoc: vi.fn(),
  }
}));

vi.mock('./FirebaseService.js', () => ({
  firebaseService: mockFirebase,
  FirebaseService: { getInstance: () => mockFirebase }
}));

describe('TemplateService', () => {
  let service: TemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = TemplateService.getInstance();
  });

  describe('createTemplate', () => {
    it('should create a valid template', async () => {
      const tenantId = 'tenant_1';
      const templateData = {
        name: 'Welcome Template',
        content: 'Hello {{name}}!',
        category: 'marketing' as const,
        mediaType: 'text' as const
      };

      mockFirebase.setDoc.mockResolvedValue(undefined);

      const result = await service.createTemplate(tenantId, templateData);

      expect(result.success).toBe(true);
      expect(mockFirebase.setDoc).toHaveBeenCalledWith(
        'templates',
        expect.any(String),
        expect.objectContaining({
          name: 'Welcome Template',
          content: 'Hello {{name}}!',
          tenantId
        }),
        tenantId
      );
    });
  });

  describe('getTemplates', () => {
    it('should return all templates for a tenant', async () => {
      const tenantId = 'tenant_1';
      const mockTemplates = [
        { id: '1', name: 'T1', tenantId, content: 'C1', createdAt: new Date(), updatedAt: new Date(), category: 'marketing', mediaType: 'text' }
      ];

      mockFirebase.getCollection.mockResolvedValue(mockTemplates);

      const result = await service.getTemplates(tenantId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].name).toBe('T1');
      }
    });
  });
});
