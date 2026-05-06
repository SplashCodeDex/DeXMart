import { Request, Response } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/firebase.js";
import { cacheService } from "@/services/cache.js";
import { logout } from "./authController.js";

// Mock dependencies
vi.mock("@/services/cache.js", () => ({
  cacheService: {
    blacklistToken: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("@/lib/firebase.js", () => ({
  db: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        delete: vi.fn().mockResolvedValue({}),
      })),
    })),
  },
}));

describe("authController - logout", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      cookies: { token: "valid-token", refreshToken: "valid-refresh-token" },
      headers: {},
    };
    res = {
      clearCookie: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  it("should blacklist tokens and clear cookies on logout", async () => {
    await logout(req as Request, res as Response);

    expect(cacheService.blacklistToken).toHaveBeenCalledWith("valid-token", 900);
    expect(db.collection).toHaveBeenCalledWith("refreshTokens");
    expect(res.clearCookie).toHaveBeenCalledWith("token", expect.any(Object));
    expect(res.clearCookie).toHaveBeenCalledWith("refreshToken", expect.any(Object));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
