import Redis from "ioredis";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db, admin } from "../../lib/firebase.js";
import { UserContextResolver } from "../tenant-context.js";

// Mock ConfigService to avoid env/file-system dependencies in unit tests
vi.mock("../../services/ConfigService.js", () => ({
  ConfigService: {
    getInstance: vi.fn(() => ({ get: vi.fn() })),
  },
}));

// Mock logger to avoid winston/tslog dependencies in unit tests
vi.mock("../../utils/logger.js", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Dependencies
vi.mock("../../lib/firebase.js", () => ({
  db: {
    collection: vi.fn(),
  },
  admin: {
    auth: vi.fn().mockReturnValue({
      verifyIdToken: vi.fn(),
    }),
  },
}));

vi.mock("ioredis", () => {
  const MockRedis = vi.fn(function (this: any) {
    this.get = vi.fn();
    this.setex = vi.fn();
    this.del = vi.fn();
  });
  return { default: MockRedis };
});

// Implementation will be in ../context-resolver.js
import { UserContextResolverImpl } from "../context-resolver.js";

/**
 * Helper to set up the Firestore mock chain for the dual-path resolution.
 *
 * The resolver calls different collection paths depending on whether the ID
 * is a tenantId (prefix "tenant-") or a Firebase Auth UID:
 *   - Path A (tenantId): tenants/{tenantId} → tenants/{tenantId}/users/{ownerId} → tenants/{tenantId}/usage/current
 *   - Path B (UID):      users/{uid} → tenants/{tenantId} → tenants/{tenantId}/users/{uid} → tenants/{tenantId}/usage/current
 */
function setupFirestoreMock(config: {
  usersLookup?: { exists: boolean; data?: () => any };
  tenantDoc?: { exists: boolean; data?: () => any };
  tenantUserDoc?: { exists: boolean; data?: () => any };
  usageDoc?: { exists: boolean; data?: () => any };
}) {
  const {
    usersLookup = { exists: false },
    tenantDoc = { exists: false },
    tenantUserDoc = { exists: false },
    usageDoc = { exists: false, data: () => ({}) },
  } = config;

  (db.collection as any).mockImplementation((collectionName: string) => {
    if (collectionName === "users") {
      return {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(usersLookup),
        }),
      };
    }
    if (collectionName === "tenants") {
      return {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(tenantDoc),
          collection: vi.fn().mockImplementation((sub: string) => {
            if (sub === "users") {
              return {
                doc: vi.fn().mockReturnValue({
                  get: vi.fn().mockResolvedValue(tenantUserDoc),
                }),
              };
            }
            if (sub === "usage") {
              return {
                doc: vi.fn().mockReturnValue({
                  get: vi.fn().mockResolvedValue(usageDoc),
                }),
              };
            }
            return {
              doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }) }),
            };
          }),
        }),
      };
    }
    return { doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }) }) };
  });
}

describe("UserContextResolverImpl", () => {
  let resolver: UserContextResolver;
  let redis: any;

  beforeEach(() => {
    vi.clearAllMocks();
    redis = new Redis();
    resolver = new UserContextResolverImpl(db as any, admin as any, redis);
  });

  describe("fromUserId", () => {
    it("should resolve from Redis cache if available", async () => {
      const mockContext = { userId: "user-123", plan: "pro" };
      redis.get.mockResolvedValue(JSON.stringify(mockContext));

      const result = await resolver.fromUserId("user-123");

      expect(result.userId).toBe("user-123");
      expect(redis.get).toHaveBeenCalledWith("user:context:user-123");
      expect(db.collection).not.toHaveBeenCalled(); // No Firestore call on cache hit
    });

    it("should resolve from Firestore via UID path (Path B) when cache misses", async () => {
      redis.get.mockResolvedValue(null);

      setupFirestoreMock({
        usersLookup: {
          exists: true,
          data: () => ({
            id: "user-123",
            email: "test@example.com",
            tenantId: "tenant-abc",
            role: "owner",
            plan: "pro",
          }),
        },
        tenantDoc: {
          exists: true,
          data: () => ({
            plan: "pro",
            ownerId: "user-123",
            name: "Test Workspace",
            subscriptionStatus: "active",
          }),
        },
        tenantUserDoc: {
          exists: true,
          data: () => ({ displayName: "Test User", email: "test@example.com", role: "owner" }),
        },
        usageDoc: {
          exists: true,
          data: () => ({ messagesThisPeriod: 10 }),
        },
      });

      const result = await resolver.fromUserId("user-123");

      expect(result.userId).toBe("tenant-abc");
      expect(result.plan).toBe("pro");
      expect(result.displayName).toBe("Test User");
      expect(redis.setex).toHaveBeenCalledWith(
        "user:context:user-123",
        300, // 5 min TTL
        expect.any(String),
      );
    });

    it("should resolve from Firestore via tenantId path (Path A) when ID starts with tenant-", async () => {
      redis.get.mockResolvedValue(null);

      setupFirestoreMock({
        tenantDoc: {
          exists: true,
          data: () => ({
            plan: "starter",
            ownerId: "firebase-uid-456",
            name: "My Workspace",
            subscriptionStatus: "trialing",
          }),
        },
        tenantUserDoc: {
          exists: true,
          data: () => ({ displayName: "Adema", email: "adema@example.com" }),
        },
        usageDoc: {
          exists: true,
          data: () => ({ messagesThisPeriod: 5 }),
        },
      });

      const result = await resolver.fromUserId("tenant-f7980402-99cb-4674-8374-4e442a2ccc6c");

      expect(result.userId).toBe("tenant-f7980402-99cb-4674-8374-4e442a2ccc6c");
      expect(result.plan).toBe("starter");
      expect(result.displayName).toBe("Adema");
      expect(result.subscription.isTrial).toBe(true);
      // Should NOT call the users lookup collection for tenant- prefixed IDs
      expect(db.collection).not.toHaveBeenCalledWith("users");
    });

    it("should throw error if user not found in Firestore (UID path)", async () => {
      redis.get.mockResolvedValue(null);
      setupFirestoreMock({
        usersLookup: { exists: false },
      });

      await expect(resolver.fromUserId("non-existent")).rejects.toThrow("User not found");
    });

    it("should throw error if tenant not found (tenantId path)", async () => {
      redis.get.mockResolvedValue(null);
      setupFirestoreMock({
        tenantDoc: { exists: false },
      });

      await expect(resolver.fromUserId("tenant-does-not-exist")).rejects.toThrow(
        "Tenant not found",
      );
    });
  });

  describe("fromToken", () => {
    it("should verify token and resolve from userId", async () => {
      const mockDecodedToken = { uid: "user-jwt-123" };
      const verifyIdToken = vi.fn().mockResolvedValue(mockDecodedToken);
      (admin.auth as any).mockReturnValue({ verifyIdToken });

      const spy = vi
        .spyOn(resolver, "fromUserId")
        .mockResolvedValue({ userId: "user-jwt-123" } as any);

      const result = await resolver.fromToken("valid-jwt");

      expect(result.userId).toBe("user-jwt-123");
      expect(spy).toHaveBeenCalledWith("user-jwt-123");
    });
  });

  describe("fromChannelId", () => {
    it("should resolve via channel mapping", async () => {
      const channelId = "whatsapp-123";
      const userId = "user-mapped-123";

      redis.get.mockResolvedValueOnce(userId); // cache hit for channel mapping
      const spy = vi.spyOn(resolver, "fromUserId").mockResolvedValue({ userId } as any);

      const result = await resolver.fromChannelId(channelId);

      expect(result.userId).toBe(userId);
      expect(spy).toHaveBeenCalledWith(userId);
    });
  });
});
