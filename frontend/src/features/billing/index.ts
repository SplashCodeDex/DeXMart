/**
 * Billing Feature Module
 *
 * Handles billing and subscription functionality including:
 * - Subscription management
 * - Payment methods
 * - Invoice history
 */

// Hooks
export { useSubscription } from './hooks/useSubscription';
export type { SubscriptionData } from './hooks/useSubscription';

// Components
export { BillingSettings } from './components/BillingSettings';
export { PricingTable } from './components/PricingTable';
export { InvoiceHistory } from './components/InvoiceHistory';
export { PaymentMethods } from './components/PaymentMethods';

// Schemas (Zod validation)
export * from './schemas';