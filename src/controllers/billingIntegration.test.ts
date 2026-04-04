import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { createCheckoutSession } from './billingController.js';
import { handleStripeWebhook } from './stripeWebhookController.js';
import stripeService from '../services/stripeService.js';
import { db } from '../lib/firebase.js';

// Mock everything
vi.mock('../services/stripeService.js', () => ({
  default: {
    stripe: {
      customers: { create: vi.fn() },
      prices: { list: vi.fn() },
      checkout: { sessions: { create: vi.fn() } },
      webhooks: { constructEvent: vi.fn() },
      subscriptions: { retrieve: vi.fn() },
    },
  },
}));

vi.mock('../lib/firebase.js', () => ({
  db: {
    collection: vi.fn().mockReturnThis(),
    doc: vi.fn().mockReturnThis(),
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock('../services/ConfigService.js', () => ({
  ConfigService: {
    getInstance: vi.fn().mockReturnValue({
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test';
        if (key === 'NEXT_PUBLIC_APP_URL') return 'http://localhost:3000';
        return undefined;
      }),
    }),
  },
}));

describe('Billing Integration Flow', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      send: vi.fn(),
    };
  });

  it('should complete the full flow: checkout -> webhook -> firestore update', async () => {
    // 1. Create Checkout Session
    mockReq = {
      body: { planId: 'pro', interval: 'month' },
      user: { userId: 'user-123', tenantId: 'tenant-123', email: 'test@example.com' } as any,
    };

    (db.collection('').doc('').get as any).mockResolvedValue({
      exists: true,
      data: () => ({ stripeCustomerId: 'cus_123' }),
    });

    (stripeService.stripe.prices.list as any).mockResolvedValue({
      data: [{ id: 'price_123', metadata: { planId: 'pro', type: 'month' } }],
    });

    (stripeService.stripe.checkout.sessions.create as any).mockResolvedValue({
      id: 'cs_123',
      url: 'https://stripe.com/checkout'
    });

    await createCheckoutSession(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: { url: 'https://stripe.com/checkout' }
    });

    // 2. Simulate Webhook for Session Completion
    const webhookReq = {
      body: { id: 'evt_123' },
      headers: { 'stripe-signature': 'sig_123' },
    };

    // Reset mocks for webhook part
    (db.collection('').doc('').get as any).mockResolvedValue({ exists: false }); // Event not processed yet

    (stripeService.stripe.webhooks.constructEvent as any).mockReturnValue({
      id: 'evt_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_123',
          subscription: 'sub_123',
          customer: 'cus_123',
          metadata: { tenantId: 'tenant-123', userId: 'user-123', planId: 'pro' },
        }
      },
    });

    (stripeService.stripe.subscriptions.retrieve as any).mockResolvedValue({
      id: 'sub_123',
      status: 'trialing',
      current_period_start: 1735689600,
      current_period_end: 1735689600 + (30 * 24 * 60 * 60),
      trial_end: 1735689600 + (7 * 24 * 60 * 60),
      cancel_at_period_end: false,
    });

    await handleStripeWebhook(webhookReq as any as Request, mockRes as Response);

    // 3. Verify Final State in Firestore
    expect(db.collection).toHaveBeenCalledWith('tenants');
    expect(db.doc).toHaveBeenCalledWith('tenant-123');
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({
      plan: 'pro',
      subscriptionStatus: 'trialing',
      stripeSubscriptionId: 'sub_123',
    }));

    // Verify subscription record creation in SUBCOLLECTION
    expect(db.collection).toHaveBeenCalledWith('tenants');
    expect(db.doc).toHaveBeenCalledWith('tenant-123');
    expect(db.collection).toHaveBeenCalledWith('subscriptions');
    expect(db.doc).toHaveBeenCalledWith('sub_123');
    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({
      plan: 'pro',
      status: 'trialing',
      tenantId: 'tenant-123',
    }));
  });
});
