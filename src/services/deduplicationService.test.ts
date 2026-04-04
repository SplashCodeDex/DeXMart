import { describe, it, expect, beforeEach, vi } from 'vitest';
import { deduplicationService } from './deduplicationService.js';

describe('DeduplicationService', () => {
    beforeEach(() => {
        deduplicationService.clear();
    });

    it('Scenario 6 (Clock Skew): should ignore messages older than 5 minutes', () => {
        const oldTimestamp = Date.now() - (6 * 60 * 1000); // 6 mins ago
        expect(deduplicationService.shouldProcess('msg1', oldTimestamp)).toBe(false);
    });

    it('Scenario 6 (Clock Skew): should ignore messages too far in the future', () => {
        const futureTimestamp = Date.now() + (6 * 60 * 1000); // 6 mins future
        expect(deduplicationService.shouldProcess('msg2', futureTimestamp)).toBe(false);
    });

    it('Deduplication: should block exact duplicate IDs', () => {
        const now = Date.now();
        expect(deduplicationService.shouldProcess('duplicate_id', now)).toBe(true);
        expect(deduplicationService.shouldProcess('duplicate_id', now)).toBe(false);
    });

    it('Normal Flow: should allow fresh messages within 5 mins', () => {
        const now = Date.now();
        expect(deduplicationService.shouldProcess('fresh_id', now - 1000)).toBe(true);
    });
});
