import Stripe from 'stripe';
import { ConfigService } from './ConfigService.js';
import logger from '../utils/logger.js';

export interface CreateCustomerData {
  userId: string;
  email: string;
  name?: string;
  phone?: string;
}

export interface SubscriptionOptions {
  userId: string;
  [key: string]: unknown;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  priceId?: string;
  features: string[];
}

export class StripeService {
  private static instance: StripeService | null = null;
  public stripe: Stripe | null = null;
  private webhookSecret: string | null = null;
  private isInitialized: boolean = false;
  public plans: Record<string, SubscriptionPlan>;

  private constructor() {
    this.plans = {
      basic: {
        id: 'basic',
        name: 'Basic',
        price: 999, // $9.99
        currency: 'usd',
        interval: 'month',
        features: ['ai_requests:100', 'image_generation:25', 'commands:5000'],
      },
      pro: {
        id: 'pro',
        name: 'Pro',
        price: 2499, // $24.99
        currency: 'usd',
        interval: 'month',
        features: ['ai_requests:unlimited', 'image_generation:100', 'commands:unlimited', 'premium_commands', 'analytics', 'api_access'],
      },
      enterprise: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 9999, // $99.99
        currency: 'usd',
        interval: 'month',
        features: ['ai_requests:unlimited', 'image_generation:unlimited', 'commands:unlimited', 'premium_commands', 'analytics', 'api_access', 'white_label', 'custom_integrations', 'dedicated_support'],
      },
    };
  }

  public static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  async initialize(secretKey: string, webhookSecret: string) {
    try {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-12-15.clover' as any,
      });
      this.webhookSecret = webhookSecret;
      this.isInitialized = true;
      logger.info('Stripe service initialized successfully');
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to initialize Stripe service', { error: err.message });
      throw err;
    }
  }

  private getStripe(): Stripe {
    if (!this.stripe) {
      const config = ConfigService.getInstance();
      const secretKey = config.get('STRIPE_SECRET_KEY');
      if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured');
      
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-12-15.clover' as any,
      });
    }
    return this.stripe;
  }

  async createCustomer(customerData: CreateCustomerData) {
    const stripe = this.getStripe();
    try {
      const customer = await stripe.customers.create({
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        metadata: {
          userId: customerData.userId,
        },
      });
      return customer;
    } catch (error: unknown) {
      logger.error('Stripe createCustomer error:', error);
      throw error;
    }
  }

  async createSubscription(customerId: string, planKey: string, options: SubscriptionOptions = { userId: '' }) {
    const stripe = this.getStripe();
    try {
      const plan = this.plans[planKey];
      if (!plan) throw new Error(`Plan ${planKey} not found`);

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: plan.priceId || plan.id }],
        metadata: {
          planKey,
          userId: options.userId,
        },
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });
      return subscription;
    } catch (error: unknown) {
      logger.error('Stripe createSubscription error:', error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd = true) {
    const stripe = this.getStripe();
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: cancelAtPeriodEnd,
      });
      return subscription;
    } catch (error: unknown) {
      logger.error('Stripe cancelSubscription error:', error);
      throw error;
    }
  }

  async updateSubscriptionPlan(subscriptionId: string, newPlanKey: string) {
    const stripe = this.getStripe();
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      // This assumes the plan defines price IDs, which we'll need to handle.
      // For now, mapping planKey to a price from metadata or similar.
      const prices = await stripe.prices.list({ active: true });
      const price = prices.data.find(p => p.metadata.planId === newPlanKey && p.metadata.type === 'monthly');
      
      if (!price) throw new Error(`Price not found for plan: ${newPlanKey}`);

      const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: price.id,
          },
        ],
      });
      return updatedSubscription;
    } catch (error: unknown) {
      logger.error('Stripe updateSubscriptionPlan error:', error);
      throw error;
    }
  }

  async getCustomer(customerId: string) {
    const stripe = this.getStripe();
    try {
      return await stripe.customers.retrieve(customerId);
    } catch (error: any) {
      logger.error('Stripe getCustomer error:', error);
      throw error;
    }
  }

  async healthCheck() {
    if (!this.stripe) return { status: 'unhealthy', error: 'Stripe not initialized' };
    try {
      await this.stripe.balance.retrieve();
      return { status: 'healthy' };
    } catch (error: any) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  public static resetInstance(): void {
    StripeService.instance = null;
  }
}

export const stripeService = StripeService.getInstance();
export default stripeService;