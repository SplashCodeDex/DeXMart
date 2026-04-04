import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StripeService } from './stripeService.js';
import { ConfigService } from './ConfigService.js';

vi.mock('./ConfigService.js', () => ({
  ConfigService: {
    getInstance: vi.fn(),
  },
}));

describe('StripeService', () => {
  let mockConfig: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    StripeService.resetInstance();
    mockConfig = {
      get: vi.fn(),
    };
    (ConfigService.getInstance as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockConfig);
  });

  it('should initialize Stripe if secret key is present', () => {
    mockConfig.get.mockImplementation((key: string) => {
      if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
      return undefined;
    });

    const instance = StripeService.getInstance();
    expect(instance).toBeDefined();
    // Stripe instance is lazily loaded or created during initialize
  });

  it('should return the same instance (Singleton)', () => {
    mockConfig.get.mockReturnValue('sk_test_123');
    const instance1 = StripeService.getInstance();
    const instance2 = StripeService.getInstance();
    expect(instance1).toBe(instance2);
  });
});