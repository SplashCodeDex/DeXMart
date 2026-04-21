/**
 * Tests for usage-tracker.ts (Phase 3.1 spec).
 *
 * Strategy:
 *   - All Firestore I/O is mocked via the UsageFirestoreClient interface.
 *   - Verify accumulation, threshold behaviour, flush paths, and re-queue on failure.
 *   - Scheduler is NOT tested here (it uses real timers) — use integration tests for that.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  trackUsage,
  flushUserUsage,
  flushAllUsage,
  getPendingUsageCount,
  _clearPendingBatchForTests,
} from "./usage-tracker.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeFirestore() {
  const docs = new Map<string, Record<string, unknown>>();
  const setMock = vi.fn(async (path: string, id: string, data: Record<string, unknown>) => {
    const existing = docs.get(`${path}/${id}`) ?? {};
    docs.set(`${path}/${id}`, { ...existing, ...data });
  });

  return {
    client: {
      collection: (path: string) => ({
        doc: (id: string) => ({
          set: (data: Record<string, unknown>, _opts?: unknown) => setMock(path, id, data),
        }),
      }),
    },
    setMock,
    docs,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("trackUsage", () => {
  beforeEach(() => _clearPendingBatchForTests());

  it("accumulates increments for the same user and metric", () => {
    trackUsage("user-1", "messages", 1);
    trackUsage("user-1", "messages", 1);
    trackUsage("user-1", "messages", 3);
    expect(getPendingUsageCount()).toBe(3); // 3 individual increment calls
  });

  it("tracks different metrics independently", () => {
    trackUsage("user-1", "messages", 5);
    trackUsage("user-1", "agents", 2);
    expect(getPendingUsageCount()).toBe(2);
  });

  it("tracks different users independently", () => {
    trackUsage("user-1", "messages", 1);
    trackUsage("user-2", "messages", 1);
    expect(getPendingUsageCount()).toBe(2);
  });
});

describe("flushUserUsage", () => {
  beforeEach(() => _clearPendingBatchForTests());

  it("writes accumulated increments to Firestore", async () => {
    const { client, setMock } = makeFirestore();
    trackUsage("user-1", "messages", 10);
    trackUsage("user-1", "tokensIn", 500);

    await flushUserUsage("user-1", client as any);

    expect(setMock).toHaveBeenCalledOnce();
    const [, , payload] = setMock.mock.calls[0] as [any, any, any];
    expect(payload.usage.messages).toBe(10);
    expect(payload.usage.tokensIn).toBe(500);
  });

  it("clears the pending batch after successful flush", async () => {
    const { client } = makeFirestore();
    trackUsage("user-1", "messages", 5);

    await flushUserUsage("user-1", client as any);

    expect(getPendingUsageCount()).toBe(0);
  });

  it("is a no-op when there is nothing pending for the user", async () => {
    const { client, setMock } = makeFirestore();

    await flushUserUsage("user-1", client as any);

    expect(setMock).not.toHaveBeenCalled();
  });

  it("re-queues increments on Firestore failure", async () => {
    const client = {
      collection: () => ({
        doc: () => ({
          set: vi.fn().mockRejectedValue(new Error("Firestore unavailable")),
        }),
      }),
    };
    trackUsage("user-1", "messages", 7);

    await expect(flushUserUsage("user-1", client as any)).rejects.toThrow("Firestore unavailable");

    // The 7 messages must be re-queued so they aren't lost
    trackUsage("user-1", "messages", 0); // trigger to verify state
    // After re-queue, flushing with a working client should write 7
    const { client: goodClient, setMock } = makeFirestore();
    await flushUserUsage("user-1", goodClient as any);
    const [, , payload] = setMock.mock.calls[0] as [any, any, any];
    expect(payload.usage.messages).toBe(7);
  });
});

describe("flushAllUsage", () => {
  beforeEach(() => _clearPendingBatchForTests());

  it("flushes all users in one call", async () => {
    const { client, setMock } = makeFirestore();
    trackUsage("user-1", "messages", 3);
    trackUsage("user-2", "messages", 7);
    trackUsage("user-3", "channels", 1);

    await flushAllUsage(client as any);

    expect(setMock).toHaveBeenCalledTimes(3);
    expect(getPendingUsageCount()).toBe(0);
  });

  it("continues flushing remaining users when one fails", async () => {
    let callCount = 0;
    const client = {
      collection: () => ({
        doc: () => ({
          set: vi.fn(async () => {
            callCount++;
            if (callCount === 1) {
              throw new Error("first user fails");
            }
          }),
        }),
      }),
    };
    trackUsage("user-1", "messages", 1);
    trackUsage("user-2", "messages", 1);

    // Should not throw — uses Promise.allSettled internally
    await expect(flushAllUsage(client as any)).resolves.toBeUndefined();
    expect(callCount).toBe(2);
  });
});
