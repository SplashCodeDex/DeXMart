import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CronManagerService } from './CronManagerService';

describe('CronManagerService', () => {
    let service: CronManagerService;

    beforeEach(() => {
        service = CronManagerService.getInstance();
    });

    it('should reject high frequency (5 min) for Starter plan', () => {
        const result = service.validateFrequency('starter', 5 * 60 * 1000); // 5 mins
        expect(result.allowed).toBe(false);
        expect(result.message).toContain('Starter plan');
    });

    it('should allow low frequency (1 hour) for Starter plan', () => {
        const result = service.validateFrequency('starter', 60 * 60 * 1000); // 1 hour
        expect(result.allowed).toBe(true);
    });

    it('should allow high frequency (5 min) for Enterprise plan', () => {
        const result = service.validateFrequency('enterprise', 5 * 60 * 1000); // 5 mins
        expect(result.allowed).toBe(true);
    });
});
