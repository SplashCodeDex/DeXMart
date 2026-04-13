/**
 * Task 5.9.1 — tenants/ → users/ Path Migration Verification
 *
 * Verifies that FirebaseService resolves all Firestore paths using
 * the B2C `users/{userId}/...` pattern instead of the legacy
 * `tenants/{tenantId}/...` pattern.
 *
 * These tests are RED until Task 5.9.2 updates firebase.ts and firestore.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock firebase.js ───────────────────────────────────────────────────────────
// Capture every collection() call so we can assert on the path.
const capturedPaths: string[] = [];

const mockDoc = {
  exists: true,
  id: "doc1",
  data: () => ({ id: "doc1", name: "test" }),
};

const mockDocRef = {
  get: vi.fn(async () => mockDoc),
  set: vi.fn(async () => {}),
  delete: vi.fn(async () => {}),
};

const mockColRef = {
  doc: vi.fn(() => mockDocRef),
  get: vi.fn(async () => ({ docs: [] })),
};

vi.mock("@/lib/firebase.js", () => ({
  db: {
    collection: vi.fn((path: string) => {
      capturedPaths.push(path);
      return mockColRef;
    }),
    batch: vi.fn(() => ({ delete: vi.fn(), set: vi.fn(), commit: vi.fn(async () => {}) })),
    doc: vi.fn(() => ({
      get: vi.fn(async () => ({ exists: false })),
      set: vi.fn(async () => {}),
    })),
  },
  admin: {
    auth: vi.fn(() => ({ verifyIdToken: vi.fn() })),
  },
}));

vi.mock("@/utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Import under test (after mocks) ──────────────────────────────────────────
// Dynamic import so mocks are registered before module evaluation.
const { firebaseService } = await import("./firebase.js");

// ── Helpers ───────────────────────────────────────────────────────────────────
const USER_ID = "user-abc123";

function lastPath(): string {
  return capturedPaths[capturedPaths.length - 1] ?? "";
}

beforeEach(() => {
  capturedPaths.length = 0;
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Task 5.9 — Firestore paths use users/{userId}/... (not tenants/)", () => {
  it("getDoc('channels', id, userId) resolves to users/{userId}/channels", async () => {
    await firebaseService.getDoc("channels", "chan-1", USER_ID).catch(() => {});
    expect(lastPath()).toBe(`users/${USER_ID}/channels`);
    expect(lastPath()).not.toContain("tenants/");
  });

  it("getDoc('agents', id, userId) resolves to users/{userId}/agents", async () => {
    await firebaseService.getDoc("agents", "agent-1", USER_ID).catch(() => {});
    expect(lastPath()).toBe(`users/${USER_ID}/agents`);
    expect(lastPath()).not.toContain("tenants/");
  });

  it("getCollection('contacts', userId) resolves to users/{userId}/contacts", async () => {
    await firebaseService.getCollection("contacts", USER_ID).catch(() => {});
    expect(lastPath()).toBe(`users/${USER_ID}/contacts`);
    expect(lastPath()).not.toContain("tenants/");
  });

  it("setDoc('campaigns', id, data, userId) resolves to users/{userId}/campaigns", async () => {
    await firebaseService.setDoc("campaigns", "camp-1", { id: "camp-1" } as any, USER_ID).catch(() => {});
    expect(lastPath()).toBe(`users/${USER_ID}/campaigns`);
    expect(lastPath()).not.toContain("tenants/");
  });

  it("nested path agents/{agentId}/channels resolves to users/{userId}/agents/{agentId}/channels", async () => {
    await firebaseService.getCollection("agents/agent-1/channels", USER_ID).catch(() => {});
    expect(lastPath()).toBe(`users/${USER_ID}/agents/agent-1/channels`);
    expect(lastPath()).not.toContain("tenants/");
  });

  it("nested auth path agents/{agentId}/channels/{chanId}/auth resolves under users/", async () => {
    await firebaseService.getCollection(
      "agents/agent-1/channels/chan-1/auth",
      USER_ID,
    ).catch(() => {});
    expect(lastPath()).toBe(`users/${USER_ID}/agents/agent-1/channels/chan-1/auth`);
    expect(lastPath()).not.toContain("tenants/");
  });

  it("getDoc('webhooks', id, userId) resolves to users/{userId}/webhooks", async () => {
    await firebaseService.getDoc("webhooks", "wh-1", USER_ID).catch(() => {});
    expect(lastPath()).toBe(`users/${USER_ID}/webhooks`);
    expect(lastPath()).not.toContain("tenants/");
  });
});
