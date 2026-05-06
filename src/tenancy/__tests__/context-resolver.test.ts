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
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
      })),
    })),
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

    it("should resolve from Firestore if Redis cache is missing", async () => {
      const mockUserData = { id: "user-123", email: "test@example.com", plan: "pro" };
      const mockUsageData = { messagesThisPeriod: 10 };

      redis.get.mockResolvedValue(null);

      // Firestore chain: collection('users').doc(userId) -> user doc
      // Firestore chain: collection('users').doc(userId).collection('usage').doc('current') -> usage doc
      const userDocGet = vi.fn().mockResolvedValue({ exists: true, data: () => mockUserData });
      const usageDocGet = vi.fn().mockResolvedValue({ exists: true, data: () => mockUsageData });

      const usageDocRef = { get: usageDocGet };
      const usageCollectionRef = { doc: vi.fn().mockReturnValue(usageDocRef) };

      const userDocRef = {
        get: userDocGet,
        collection: vi.fn().mockReturnValue(usageCollectionRef),
      };

      (db.collection as any).mockReturnValue({
        doc: vi.fn().mockReturnValue(userDocRef),
      });

      const result = await resolver.fromUserId("user-123");

      expect(result.userId).toBe("user-123");
      expect(result.plan).toBe("pro");
      expect(redis.setex).toHaveBeenCalledWith(
        "user:context:user-123",
        300, // 5 min TTL
        expect.any(String),
      );
    });

    it("should throw error if user not found in Firestore", async () => {
      redis.get.mockResolvedValue(null);
      (db.collection as any).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: false }),
        }),
      });

      await expect(resolver.fromUserId("non-existent")).rejects.toThrow("User not found");
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
