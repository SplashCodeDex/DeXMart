import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { createCheckoutSession } from './billingController.js';
import stripeService from '../services/stripeService.js';
import { db } from '../lib/firebase.js';

// Mock dependencies
vi.mock('../services/stripeService.js', () => ({
  default: {
    stripe: {
      customers: {
        create: vi.fn(),
      },
      prices: {
        list: vi.fn(),
      },
      checkout: {
        sessions: {
          create: vi.fn(),
        },
      },
    },
  },
}));

vi.mock('../lib/firebase.js', () => ({
  db: {
    collection: vi.fn().mockReturnThis(),
    doc: vi.fn().mockReturnThis(),
    get: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../services/ConfigService.js', () => ({
  ConfigService: {
    getInstance: vi.fn().mockReturnValue({
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'NEXT_PUBLIC_APP_URL') return 'http://localhost:3000';
        return undefined;
      }),
    }),
  },
}));

describe('BillingController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      body: {
        planId: 'pro',
        interval: 'month',
      },
      user: {
        userId: 'user-123',
        tenantId: 'tenant-123',
        email: 'test@example.com',
      } as any,
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  it('should create a checkout session and return the URL', async () => {
    // Mock Firestore tenant doc
    (db.collection('').doc('').get as any).mockResolvedValue({
      exists: true,
      data: () => ({ stripeCustomerId: 'cus_123' }),
    });

    // Mock Stripe prices list
    (stripeService.stripe.prices.list as any).mockResolvedValue({
      data: [
        { id: 'price_123', metadata: { planId: 'pro', type: 'month' } },
      ],
    });

    // Mock Stripe checkout session create
    const mockSession = { url: 'https://checkout.stripe.com/test' };
    (stripeService.stripe.checkout.sessions.create as any).mockResolvedValue(mockSession);

    await createCheckoutSession(mockReq as Request, mockRes as Response);

    expect(stripeService.stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      customer: 'cus_123',
      line_items: [expect.objectContaining({ price: 'price_123' })],
    }));
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: { url: mockSession.url }
    });
  });

  it('should create a customer if it does not exist', async () => {
    // Mock Firestore tenant doc WITHOUT stripeCustomerId
    (db.collection('').doc('').get as any).mockResolvedValue({
      exists: true,
      data: () => ({}),
    });

    // Mock Stripe customer create
    (stripeService.stripe.customers.create as any).mockResolvedValue({ id: 'cus_new' });

    // Mock Stripe prices list
    (stripeService.stripe.prices.list as any).mockResolvedValue({
      data: [
        { id: 'price_123', metadata: { planId: 'pro', type: 'month' } },
      ],
    });

    // Mock Stripe checkout session create
    (stripeService.stripe.checkout.sessions.create as any).mockResolvedValue({ url: 'ok' });

    await createCheckoutSession(mockReq as Request, mockRes as Response);

    expect(stripeService.stripe.customers.create).toHaveBeenCalled();
    expect(db.collection('').doc('').update as any).toHaveBeenCalledWith({ stripeCustomerId: 'cus_new' });
  });

  it('should return 400 if planId is missing', async () => {
    mockReq.body.planId = undefined;
    await createCheckoutSession(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });
});