/**
 * Billing Service
 *
 * Business logic layer using Result pattern for error handling
 */

import stripeService from './stripeService.js';
import { db } from '../lib/firebase.js';
import logger from '../utils/logger.js';
import { Result, success, failure, AppError } from '../types/result.js';
import {
  CreateCheckoutSessionRequestSchema,
  SubscriptionInfoResponseSchema,
  InvoiceResponseSchema,
  PaymentMethodResponseSchema,
  type CheckoutSessionResponse,
  type SubscriptionInfoResponse,
  type InvoiceResponse,
  type PaymentMethodResponse,
} from '@DeXMart/shared';
import { ConfigService } from './ConfigService.js';

export class BillingService {
  /**
   * Create a Stripe checkout session
   */
  async createCheckoutSession(
    tenantId: string,
    userId: string,
    userEmail: string,
    planId: string,
    interval: string
  ): Promise<Result<CheckoutSessionResponse, AppError>> {
    try {
      // Validate input with Zod
      const validatedInput = CreateCheckoutSessionRequestSchema.parse({
        planId,
        interval,
      });

      const tenantRef = db.collection('tenants').doc(tenantId);
      const tenantDoc = await tenantRef.get();

      if (!tenantDoc.exists) {
        return failure(AppError.notFound('Tenant not found'));
      }

      const tenantData = tenantDoc.data()!;
      let stripeCustomerId = tenantData.stripeCustomerId;

      const stripe = stripeService.stripe;
      if (!stripe) {
        return failure(AppError.serviceUnavailable('Stripe service not initialized'));
      }

      // Create Stripe customer if it doesn't exist
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            tenantId,
            userId,
          },
        });
        stripeCustomerId = customer.id;
        await tenantRef.update({ stripeCustomerId });
      }

      // Find the price ID
      const prices = await stripe.prices.list({
        active: true,
        expand: ['data.product'],
      });

      const price = prices.data.find(
        (p) => p.metadata.planId === validatedInput.planId && p.metadata.type === validatedInput.interval
      );

      if (!price) {
        logger.error('Stripe price not found', { planId: validatedInput.planId, interval: validatedInput.interval });
        return failure(
          AppError.badRequest('Price configuration not found in Stripe', {
            planId: validatedInput.planId,
            interval: validatedInput.interval,
          })
        );
      }

      const config = ConfigService.getInstance();
      const appUrl = config.get('NEXT_PUBLIC_APP_URL');

      // Create Checkout Session
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: price.id,
            quantity: 1,
          },
        ],
        subscription_data: {
          trial_period_days: 7,
          metadata: {
            tenantId,
            userId,
            planId: validatedInput.planId,
          },
        },
        success_url: `${appUrl}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/dashboard/billing?canceled=true`,
      });

      if (!session.url) {
        return failure(AppError.internal('Failed to create checkout session URL'));
      }

      return success({ url: session.url });
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'ZodError') {
          return failure(AppError.badRequest('Validation failed', (error as any).errors));
        }
        logger.error('Error creating checkout session', { error: error.message });
        return failure(AppError.internal(error.message));
      }
      return failure(AppError.internal('Unknown error creating checkout session'));
    }
  }

  /**
   * Get subscription info for a tenant
   */
  async getSubscription(tenantId: string): Promise<Result<SubscriptionInfoResponse, AppError>> {
    try {
      const tenantDoc = await db.collection('tenants').doc(tenantId).get();

      if (!tenantDoc.exists) {
        return failure(AppError.notFound('Tenant not found'));
      }

      const data = tenantDoc.data()!;

      const subscriptionInfo: SubscriptionInfoResponse = {
        plan: data.plan || 'starter',
        status: data.subscriptionStatus || 'trialing',
        trialEndsAt: data.trialEndsAt ? (data.trialEndsAt as any).toDate().toISOString() : null,
        currentPeriodEnd: data.currentPeriodEnd ? (data.currentPeriodEnd as any).toDate().toISOString() : null,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
      };

      // Validate output with Zod
      const validatedInfo = SubscriptionInfoResponseSchema.parse(subscriptionInfo);
      return success(validatedInfo);
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error('Error getting subscription', { error: error.message });
        return failure(AppError.internal(error.message));
      }
      return failure(AppError.internal('Unknown error getting subscription'));
    }
  }

  /**
   * Get invoices for a tenant
   */
  async getInvoices(tenantId: string): Promise<Result<InvoiceResponse[], AppError>> {
    try {
      const tenantDoc = await db.collection('tenants').doc(tenantId).get();

      if (!tenantDoc.exists) {
        return failure(AppError.notFound('Tenant not found'));
      }

      const tenantData = tenantDoc.data()!;
      const stripeCustomerId = tenantData.stripeCustomerId;

      if (!stripeCustomerId) {
        return success([]);
      }

      const stripe = stripeService.stripe;
      if (!stripe) {
        return failure(AppError.serviceUnavailable('Stripe service not initialized'));
      }

      const invoices = await stripe.invoices.list({
        customer: stripeCustomerId,
        limit: 100,
      });

      const formattedInvoices: InvoiceResponse[] = invoices.data.map((invoice) => {
        const invoiceData: InvoiceResponse = {
          id: invoice.id,
          date: new Date(invoice.created * 1000).toISOString(),
          amount: invoice.total,
          status: invoice.status === 'paid' ? 'paid' : invoice.status === 'open' ? 'pending' : 'failed',
          invoiceUrl: invoice.hosted_invoice_url || invoice.invoice_pdf || '',
          description: invoice.lines.data[0]?.description || 'Subscription payment',
        };

        // Validate each invoice with Zod
        return InvoiceResponseSchema.parse(invoiceData);
      });

      return success(formattedInvoices);
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error('Error getting invoices', { error: error.message });
        return failure(AppError.internal(error.message));
      }
      return failure(AppError.internal('Unknown error getting invoices'));
    }
  }

  /**
   * Get payment methods for a tenant
   */
  async getPaymentMethods(tenantId: string): Promise<Result<PaymentMethodResponse[], AppError>> {
    try {
      const tenantDoc = await db.collection('tenants').doc(tenantId).get();

      if (!tenantDoc.exists) {
        return failure(AppError.notFound('Tenant not found'));
      }

      const tenantData = tenantDoc.data()!;
      const stripeCustomerId = tenantData.stripeCustomerId;

      if (!stripeCustomerId) {
        return success([]);
      }

      const stripe = stripeService.stripe;
      if (!stripe) {
        return failure(AppError.serviceUnavailable('Stripe service not initialized'));
      }

      const paymentMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: 'card',
      });

      const customer = await stripe.customers.retrieve(stripeCustomerId);
      const defaultPaymentMethodId = (customer as any).invoice_settings?.default_payment_method;

      const formattedMethods: PaymentMethodResponse[] = paymentMethods.data.map((pm) => {
        const methodData: PaymentMethodResponse = {
          id: pm.id,
          brand: pm.card?.brand || 'card',
          last4: pm.card?.last4 || '0000',
          expiryMonth: pm.card?.exp_month || 1,
          expiryYear: pm.card?.exp_year || 2099,
          isDefault: pm.id === defaultPaymentMethodId,
        };

        // Validate each payment method with Zod
        return PaymentMethodResponseSchema.parse(methodData);
      });

      return success(formattedMethods);
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error('Error getting payment methods', { error: error.message });
        return failure(AppError.internal(error.message));
      }
      return failure(AppError.internal('Unknown error getting payment methods'));
    }
  }

  /**
   * Delete a payment method
   */
  async deletePaymentMethod(tenantId: string, paymentMethodId: string): Promise<Result<{ message: string }, AppError>> {
    try {
      const stripe = stripeService.stripe;
      if (!stripe) {
        return failure(AppError.serviceUnavailable('Stripe service not initialized'));
      }

      // Ownership check: Get tenant to get stripeCustomerId
      const tenantDoc = await db.collection('tenants').doc(tenantId).get();
      if (!tenantDoc.exists) {
        return failure(AppError.notFound('Tenant not found'));
      }
      const tenantData = tenantDoc.data()!;
      const stripeCustomerId = tenantData.stripeCustomerId;

      if (!stripeCustomerId) {
        return failure(AppError.forbidden('Tenant has no associated billing account'));
      }

      // Retrieve payment method to verify customer ownership
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (paymentMethod.customer !== stripeCustomerId) {
        logger.warn('Forbidden attempt to delete payment method', { tenantId, paymentMethodId });
        return failure(AppError.forbidden('You do not have permission to delete this payment method'));
      }

      await stripe.paymentMethods.detach(paymentMethodId);

      return success({ message: 'Payment method removed successfully' });
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error('Error deleting payment method', { error: error.message });
        return failure(AppError.internal(error.message));
      }
      return failure(AppError.internal('Unknown error deleting payment method'));
    }
  }
}

export default new BillingService();
