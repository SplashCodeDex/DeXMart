import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkBotLimit, checkFeatureAccess } from './planMiddleware.js';
import { multiTenantService } from '@/services/multiTenantService.js';
import { Request, Response, NextFunction } from 'express';

vi.mock('@/services/multiTenantService.js', () => ({
  multiTenantService: {
    canAddBot: vi.fn(),
    getTenant: vi.fn(),
  },
}));

describe('Plan Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      user: {
        tenantId: 'tenant-123',
      } as any,
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe('checkBotLimit', () => {
    it('should call next if bot limit is not reached', async () => {
      (multiTenantService.canAddBot as any).mockResolvedValue({ success: true, data: true });

      await checkBotLimit(req as Request, res as Response, next);

      expect(multiTenantService.canAddBot).toHaveBeenCalledWith('tenant-123');
      expect(next).toHaveBeenCalled();
    });

    it('should return 403 if bot limit is reached', async () => {
      (multiTenantService.canAddBot as any).mockResolvedValue({ success: true, data: false });

      await checkBotLimit(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'LIMIT_REACHED' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if tenantId is missing', async () => {
      req.user = undefined;
      await checkBotLimit(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 500 if service fails', async () => {
      (multiTenantService.canAddBot as any).mockResolvedValue({ success: false, error: new Error('DB Error') });

      await checkBotLimit(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('checkFeatureAccess', () => {
    it('should allow access to AI for pro plan', async () => {
      (multiTenantService.getTenant as any).mockResolvedValue({
        success: true,
        data: { plan: 'pro' }
      });

      const middleware = checkFeatureAccess('ai');
      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access to AI for starter plan', async () => {
      (multiTenantService.getTenant as any).mockResolvedValue({
        success: true,
        data: { plan: 'starter' }
      });

      const middleware = checkFeatureAccess('ai');
      await middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow access to backups for all plans', async () => {
      (multiTenantService.getTenant as any).mockResolvedValue({
        success: true,
        data: { plan: 'starter' }
      });

      const middleware = checkFeatureAccess('backups');
      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 500 if tenant fetch fails', async () => {
      (multiTenantService.getTenant as any).mockResolvedValue({ success: false, error: new Error('DB Error') });

      const middleware = checkFeatureAccess('ai');
      await middleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
