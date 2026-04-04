/**
 * BillingService Tests
 *
 * Test coverage for BillingService following PROJECT_RULES.md
 * Target: 80%+ coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingService } from './billingService.js';
import { AppError } from '../types/result.js';

// Mock dependencies
vi.mock('./stripeService.js', () => ({
  default: {
    stripe: null,
  },
}));

vi.mock('../lib/firebase.js', () => ({
  db: {
    collection: vi.fn(),
  },
}));

vi.mock('../utils/logger.js', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('./ConfigService.js', () => ({
  ConfigService: {
    getInstance: vi.fn(() => ({
      get: vi.fn(() => 'http://localhost:3000'),
    })),
  },
}));

describe('BillingService', () => {
  let billingService: BillingService;

  beforeEach(() => {
    vi.clearAllMocks();
    billingService = new BillingService();
  });

  describe('createCheckoutSession', () => {
    it('should validate input with Zod and reject invalid planId', async () => {
      const result = await billingService.createCheckoutSession(
        'tenant_123',
        'user_123',
        'user@example.com',
        'invalid_plan',
        'month'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AppError);
      }
    });

    it('should validate input with Zod and reject invalid interval', async () => {
      const result = await billingService.createCheckoutSession(
        'tenant_123',
        'user_123',
        'user@example.com',
        'starter',
        'invalid_interval'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AppError);
      }
    });

    it('should return AppError when tenant not found', async () => {
      const { db } = await import('../lib/firebase.js');

      vi.mocked(db.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false }),
        })),
      } as any);

      const result = await billingService.createCheckoutSession(
        'tenant_123',
        'user_123',
        'user@example.com',
        'starter',
        'month'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toBe('Tenant not found');
      }
    });

    it('should return AppError when Stripe is not initialized', async () => {
      const { db } = await import('../lib/firebase.js');

      vi.mocked(db.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ stripeCustomerId: 'cus_123' })
          }),
        })),
      } as any);

      const result = await billingService.createCheckoutSession(
        'tenant_123',
        'user_123',
        'user@example.com',
        'starter',
        'month'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVICE_UNAVAILABLE');
        expect(result.error.message).toBe('Stripe service not initialized');
      }
    });
  });

  describe('getSubscription', () => {
    it('should return subscription info for existing tenant', async () => {
      const { db } = await import('../lib/firebase.js');

      const mockDate = new Date('2024-02-01T00:00:00Z');

      vi.mocked(db.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              plan: 'pro',
              subscriptionStatus: 'active',
              trialEndsAt: { toDate: () => mockDate },
              currentPeriodEnd: { toDate: () => mockDate },
              cancelAtPeriodEnd: false,
            })
          }),
        })),
      } as any);

      const result = await billingService.getSubscription('tenant_123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.plan).toBe('pro');
        expect(result.data.status).toBe('active');
        expect(result.data.cancelAtPeriodEnd).toBe(false);
      }
    });

    it('should return default values when fields are missing', async () => {
      const { db } = await import('../lib/firebase.js');

      vi.mocked(db.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({})
          }),
        })),
      } as any);

      const result = await billingService.getSubscription('tenant_123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.plan).toBe('starter');
        expect(result.data.status).toBe('trialing');
        expect(result.data.trialEndsAt).toBeNull();
      }
    });

    it('should return AppError when tenant not found', async () => {
      const { db } = await import('../lib/firebase.js');

      vi.mocked(db.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false }),
        })),
      } as any);

      const result = await billingService.getSubscription('tenant_123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('getInvoices', () => {
    it('should return empty array when no Stripe customer ID exists', async () => {
      const { db } = await import('../lib/firebase.js');

      vi.mocked(db.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({})
          }),
        })),
      } as any);

      const result = await billingService.getInvoices('tenant_123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('should return AppError when tenant not found', async () => {
      const { db } = await import('../lib/firebase.js');

      vi.mocked(db.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false }),
        })),
      } as any);

      const result = await billingService.getInvoices('tenant_123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('getPaymentMethods', () => {
    it('should return empty array when no Stripe customer ID exists', async () => {
      const { db } = await import('../lib/firebase.js');

      vi.mocked(db.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({})
          }),
        })),
      } as any);

      const result = await billingService.getPaymentMethods('tenant_123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('should return AppError when tenant not found', async () => {
      const { db } = await import('../lib/firebase.js');

      vi.mocked(db.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false }),
        })),
      } as any);

      const result = await billingService.getPaymentMethods('tenant_123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('deletePaymentMethod', () => {
    it('should return AppError when Stripe is not initialized', async () => {
      const result = await billingService.deletePaymentMethod('tenant_123', 'pm_123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVICE_UNAVAILABLE');
      }
    });

    it('should return FORBIDDEN when payment method belongs to another customer', async () => {
      const { db } = await import('../lib/firebase.js');
      const stripeService = (await import('./stripeService.js')).default;

      // Mock Stripe initialized
      stripeService.stripe = {
        paymentMethods: {
          retrieve: vi.fn().mockResolvedValue({ customer: 'cus_another' }),
          detach: vi.fn(),
        },
      } as any;

      // Mock Tenant with different customer ID
      vi.mocked(db.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ stripeCustomerId: 'cus_tenant' })
          }),
        })),
      } as any);

      const result = await billingService.deletePaymentMethod('tenant_123', 'pm_123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('should successfully detach payment method when ownership matches', async () => {
      const { db } = await import('../lib/firebase.js');
      const stripeService = (await import('./stripeService.js')).default;

      const detachMock = vi.fn().mockResolvedValue({});
      stripeService.stripe = {
        paymentMethods: {
          retrieve: vi.fn().mockResolvedValue({ customer: 'cus_tenant' }),
          detach: detachMock,
        },
      } as any;

      vi.mocked(db.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ stripeCustomerId: 'cus_tenant' })
          }),
        })),
      } as any);

      const result = await billingService.deletePaymentMethod('tenant_123', 'pm_123');

      expect(result.success).toBe(true);
      expect(detachMock).toHaveBeenCalledWith('pm_123');
    });
  });

  describe('AppError helpers', () => {
    it('should create badRequest error with correct properties', () => {
      const error = AppError.badRequest('Invalid input', { field: 'email' });

      expect(error.code).toBe('BAD_REQUEST');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid input');
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should create notFound error', () => {
      const error = AppError.notFound('Resource not found');

      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });

    it('should create unauthorized error', () => {
      const error = AppError.unauthorized('Not authorized');

      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
    });

    it('should create forbidden error', () => {
      const error = AppError.forbidden('Access denied');

      expect(error.code).toBe('FORBIDDEN');
      expect(error.statusCode).toBe(403);
    });

    it('should create serviceUnavailable error', () => {
      const error = AppError.serviceUnavailable('Service down');

      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.statusCode).toBe(503);
    });

    it('should create internal error', () => {
      const error = AppError.internal('Internal error', { trace: '123' });

      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ trace: '123' });
    });
  });
});
