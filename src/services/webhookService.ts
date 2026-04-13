import axios from 'axios';
import crypto from 'crypto';
import { firebaseService } from '@/persistence/firebase.js';
import { Webhook, WebhookSchema, WebhookEvent, Result } from '../types/contracts.js';
import { Timestamp } from 'firebase-admin/firestore';
import logger from '../utils/logger.js';

import { tenantConfigService } from './tenantConfigService.js';

/**
 * Scenario 28: Per-URL circuit breaker to prevent concurrent webhook delivery
 * failures from hammering a dead endpoint with exponential-backoff retries.
 *
 * States: CLOSED (normal) → OPEN (tripped, fast-fail) → HALF_OPEN (probe after cooldown)
 */
export class WebhookCircuitBreaker {
    private readonly FAILURE_THRESHOLD = 5;
    private readonly COOLDOWN_MS = 60_000; // 1 minute open before probe
    private readonly HALF_OPEN_PROBE_LIMIT = 1;

    private failures = new Map<string, number>();
    private lastFailureAt = new Map<string, number>();
    private halfOpenProbes = new Map<string, number>();

    isOpen(url: string): boolean {
        const failures = this.failures.get(url) ?? 0;
        if (failures < this.FAILURE_THRESHOLD) return false;

        const elapsed = Date.now() - (this.lastFailureAt.get(url) ?? 0);
        if (elapsed >= this.COOLDOWN_MS) {
            // Transition to HALF_OPEN — allow one probe through
            const probes = this.halfOpenProbes.get(url) ?? 0;
            if (probes < this.HALF_OPEN_PROBE_LIMIT) {
                this.halfOpenProbes.set(url, probes + 1);
                return false;
            }
        }
        return true;
    }

    recordSuccess(url: string): void {
        this.failures.delete(url);
        this.lastFailureAt.delete(url);
        this.halfOpenProbes.delete(url);
    }

    recordFailure(url: string): void {
        const prev = this.failures.get(url) ?? 0;
        this.failures.set(url, prev + 1);
        this.lastFailureAt.set(url, Date.now());
        this.halfOpenProbes.delete(url);
    }
}

export class WebhookService {
    private readonly circuitBreaker = new WebhookCircuitBreaker();
    /**
     * Create a new webhook for a tenant
     */
    async createWebhook(tenantId: string, data: Partial<Webhook>, metadata: { actor: string; ip?: string } = { actor: 'system' }): Promise<Result<Webhook>> {
        try {
            const webhookId = `wh_${Date.now()}`;
            const secret = crypto.randomBytes(32).toString('hex');

            const rawWebhook = {
                id: webhookId,
                url: data.url,
                events: data.events || [],
                secret: secret,
                isActive: true,
                name: data.name || 'External API Hook',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                ...data
            };

            const webhook = WebhookSchema.parse(rawWebhook);
            await firebaseService.setDoc<'users/{userId}/webhooks'>('webhooks', webhookId, webhook as any, tenantId);
            return { success: true, data: webhook };
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(`WebhookService.createWebhook error [${tenantId}]:`, err);
            return { success: false, error: err };
        }
    }

    /**
     * Get all webhooks for a tenant
     */
    async getWebhooks(tenantId: string): Promise<Result<Webhook[]>> {
        try {
            const webhooks = await firebaseService.getCollection<'users/{userId}/webhooks'>('webhooks', tenantId);
            return { success: true, data: webhooks as Webhook[] };
        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            return { success: false, error: err };
        }
    }

    /**
     * Dispatch an event to all relevant webhooks for a tenant
     */
    async dispatch(tenantId: string, event: WebhookEvent, payload: any): Promise<void> {
        try {
            // Feature Flag Check
            const isEnabled = await tenantConfigService.isFeatureEnabled(tenantId, 'webhooksEnabled');
            if (!isEnabled) return;

            const webhooksResult = await this.getWebhooks(tenantId);
            if (!webhooksResult.success) return;

            const activeHooks = webhooksResult.data.filter(h => h.isActive && h.events.includes(event));

            for (const hook of activeHooks) {
                this.sendWebhook(hook, event, payload).catch(err => {
                    logger.error(`Webhook dispatch failed for ${hook.url}:`, err);
                });
            }
        } catch (error) {
            logger.error(`WebhookService.dispatch error [${tenantId}]:`, error);
        }
    }

    /**
     * Internal method to send the HTTP POST request with signature
     */
    private async sendWebhook(hook: Webhook, event: WebhookEvent, payload: any): Promise<void> {
        // Scenario 28: Fast-fail if the endpoint's circuit is open
        if (this.circuitBreaker.isOpen(hook.url)) {
            logger.warn(`[WebhookService] Circuit OPEN for ${hook.url} — skipping delivery of '${event}'`);
            return;
        }

        const timestamp = Date.now();
        // 2026 Security Fix: Use actual tenant context from payload if available, or hook.tenantId
        const tenantId = payload.tenantId || (hook.name || '').split('_')[0]; // Fallback logic or update schema

        const body = JSON.stringify({
            event,
            timestamp,
            tenantId: tenantId,
            data: payload
        });

        // HMAC SHA256 Signing for security
        const signature = crypto
            .createHmac('sha256', hook.secret)
            .update(body)
            .digest('hex');

        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                await axios.post(hook.url, body, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-DeXMart-Signature': signature,
                        'X-DeXMart-Timestamp': timestamp.toString(),
                        'User-Agent': 'DeXMart-Webhook-Engine/1.0'
                    },
                    timeout: 5000
                });
                this.circuitBreaker.recordSuccess(hook.url);
                logger.debug(`Webhook delivered: ${event} -> ${hook.url}`);
                return;
            } catch (error) {
                attempts++;
                if (attempts >= maxAttempts) {
                    this.circuitBreaker.recordFailure(hook.url);
                    logger.warn(`Webhook failed after ${maxAttempts} attempts: ${hook.url}`);
                } else {
                    // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
                }
            }
        }
    }

    /**
     * Delete a webhook
     */
    async deleteWebhook(tenantId: string, webhookId: string, metadata: { actor: string; ip?: string } = { actor: 'system' }): Promise<Result<void>> {
        try {
            await firebaseService.deleteDoc<'users/{userId}/webhooks'>('webhooks', webhookId, tenantId);
            return { success: true, data: undefined };
        } catch (error: unknown) {
            return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
        }
    }
}

export const webhookService = new WebhookService();
export default webhookService;
