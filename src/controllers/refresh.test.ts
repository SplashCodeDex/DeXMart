import { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/firebase.js";
import { refresh } from "./authController.js";

// Hoist mocks so they are accessible in beforeEach for proper reset
const mockGet = vi.hoisted(() => vi.fn());
const mockBatch = vi.hoisted(() => ({
  delete: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  commit: vi.fn().mockResolvedValue({}),
}));

// Mock dependencies
vi.mock("@/lib/firebase.js", () => {
  const mockCollection: any = vi.fn(() => ({
    doc: vi.fn(() => ({
      get: mockGet,
      delete: vi.fn().mockResolvedValue({}),
    })),
  }));

  return {
    db: {
      collection: mockCollection,
      batch: vi.fn(() => mockBatch),
    },
    admin: {
      auth: () => ({
        createCustomToken: vi.fn().mockResolvedValue("custom-token"),
      }),
    },
  };
});

vi.mock("@/services/ConfigService.js", () => {
  const mockConfigInstance = {
    get: vi.fn((key: string) => {
      if (key === "JWT_SECRET") return "test-secret";
      if (key === "auth.jwtExpires") return "4h";
      if (key === "auth.refreshExpires") return "7d";
      return null;
    }),
  };
  return {
    ConfigService: {
      getInstance: () => mockConfigInstance,
    },
    config: mockConfigInstance,
    default: mockConfigInstance,
  };
});

describe("authController - refresh", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mockGet fully (clears Once queues) to prevent cross-test contamination
    mockGet.mockReset();
    // Re-apply default commit implementation after reset
    mockBatch.commit.mockResolvedValue({});
    req = {
      cookies: { refreshToken: "old-refresh-token" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      cookie: vi.fn().mockReturnThis(),
    };
  });

  it("should fail if no refresh token provided", async () => {
    req.cookies = {};
    await refresh(req as Request, res as Response);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("should rotate tokens for valid refresh token", async () => {
    const mockRt = {
      exists: true,
      data: () => ({
        userId: "user-1",
        tenantId: "tenant-1",
        familyId: "family-1",
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 10000)),
      }),
      ref: { delete: vi.fn() },
    };

    mockGet.mockResolvedValueOnce(mockRt);
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ email: "test@example.com", role: "owner" }),
    });

    await refresh(req as Request, res as Response);

    expect(db.batch).toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith("token", expect.any(String), expect.any(Object));
    expect(res.cookie).toHaveBeenCalledWith("refreshToken", expect.any(String), expect.any(Object));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it("should fail for non-existent token (Potential Fraud)", async () => {
    mockGet.mockResolvedValue({ exists: false });

    await refresh(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
