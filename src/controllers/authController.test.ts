import { Request, Response } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db, admin } from "@/lib/firebase.js";
import { firebaseService } from "@/persistence/firebase.js";
import { multiTenantService } from "@/services/multiTenantService.js";
import { loginWithGoogle, updateProfile } from "./authController.js";

// Mock dependencies
vi.mock("@/persistence/firebase.js", () => ({
  firebaseService: {
    verifyIdToken: vi.fn(),
  },
}));

vi.mock("@/services/multiTenantService.js", () => ({
  multiTenantService: {
    initializeTenant: vi.fn(),
  },
}));

// Create a helper for the mock document
const createMockDoc = (exists: boolean, data?: any) => ({
  exists,
  data: () => data,
  update: vi.fn().mockResolvedValue({}),
});

const mockUpdate = vi.fn().mockResolvedValue({});

vi.mock("@/lib/firebase.js", () => {
  const mockGet = vi.fn();

  // Recursive mock function to handle collection().doc().collection().doc()...
  const mockCollection: any = vi.fn(() => ({
    doc: vi.fn(() => ({
      get: mockGet,
      set: vi.fn().mockResolvedValue({}),
      update: mockUpdate,
      delete: vi.fn().mockResolvedValue({}),
      collection: mockCollection, // Allow nested collections
    })),
    where: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: mockGet,
      })),
    })),
  }));

  return {
    db: {
      collection: mockCollection,
    },
    admin: {
      auth: () => ({
        setCustomUserClaims: vi.fn().mockResolvedValue({}),
        createCustomToken: vi.fn().mockResolvedValue("custom-token"),
        updateUser: vi.fn().mockResolvedValue({}),
      }),
    },
  };
});

vi.mock("@/services/ConfigService.js", () => {
  const configMap: Record<string, string> = {
    JWT_SECRET: "jwt-secret",
    "auth.jwtExpires": "24h",
    "auth.refreshExpires": "30d",
  };
  return {
    ConfigService: {
      getInstance: () => ({
        get: vi.fn().mockImplementation((key: string) => configMap[key] ?? null),
      }),
    },
    config: {
      get: vi.fn().mockImplementation((key: string) => configMap[key] ?? null),
    },
  };
});

describe("authController - loginWithGoogle", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      body: { idToken: "test-id-token" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      cookie: vi.fn().mockReturnThis(),
    };
  });

  it("should login an existing user", async () => {
    (firebaseService.verifyIdToken as any).mockResolvedValue({
      uid: "uid-123",
      email: "test@example.com",
      name: "Test User",
    });

    const mockGet = db.collection("any").doc("any").get as any;

    // Sequence of gets in loginWithGoogle:
    // 1. lookupDoc = await db.collection('users').doc(uid).get();
    mockGet.mockResolvedValueOnce(createMockDoc(true, { tenantId: "tenant-123", role: "owner" }));
    // 2. userDoc = await db.collection('tenants').doc(tenantId).collection('users').doc(uid).get();
    mockGet.mockResolvedValueOnce(
      createMockDoc(true, { id: "uid-123", email: "test@example.com", displayName: "Test User" }),
    );
    // 3. tenantDoc = await db.collection('tenants').doc(tenantId).get();
    mockGet.mockResolvedValueOnce(
      createMockDoc(true, { id: "tenant-123", name: "Test Tenant", subdomain: "test" }),
    );

    await loginWithGoogle(req as Request, res as Response);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          user: expect.objectContaining({ id: "uid-123" }),
        }),
      }),
    );
  });

  it("should auto-initialize a new user", async () => {
    (firebaseService.verifyIdToken as any).mockResolvedValue({
      uid: "uid-new",
      email: "new@example.com",
      name: "New User",
    });

    const mockGet = db.collection("any").doc("any").get as any;
    const mockLimitGet = db.collection("any").where("any", "==", "any").limit(1).get as any;

    // 1. lookupDoc.get() -> exists: false
    mockGet.mockResolvedValueOnce(createMockDoc(false));
    // 2. emailConflict.get() -> empty: true
    mockLimitGet.mockResolvedValueOnce({ empty: true });

    (multiTenantService.initializeTenant as any).mockResolvedValue({
      success: true,
      data: {
        tenant: { id: "tenant-new", name: "New Tenant", subdomain: "new" },
        user: { id: "uid-new" },
      },
    });

    // 3. userDoc.get()
    mockGet.mockResolvedValueOnce(createMockDoc(true, { id: "uid-new", email: "new@example.com" }));
    // 4. tenantDoc.get()
    mockGet.mockResolvedValueOnce(createMockDoc(true, { id: "tenant-new", name: "New Tenant" }));

    await loginWithGoogle(req as Request, res as Response);

    expect(multiTenantService.initializeTenant).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it("should return 409 for email conflict", async () => {
    (firebaseService.verifyIdToken as any).mockResolvedValue({
      uid: "uid-google",
      email: "conflict@example.com",
    });

    const mockGet = db.collection("any").doc("any").get as any;
    const mockLimitGet = db.collection("any").where("any", "==", "any").limit(1).get as any;

    mockGet.mockResolvedValueOnce(createMockDoc(false));
    mockLimitGet.mockResolvedValueOnce({ empty: false });

    await loginWithGoogle(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("authController - updateProfile", () => {
  let req: any;
  let res: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      user: { userId: "uid-123", tenantId: "tenant-abc" },
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  it("should update display name and return 200", async () => {
    req.body = { name: "Alice Smith" };

    await updateProfile(req, res as Response);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { name: "Alice Smith" } });
  });

  it("should trim whitespace from name", async () => {
    req.body = { name: "  Bob   " };

    await updateProfile(req, res as Response);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { name: "Bob" } });
  });

  it("should return 400 when name is empty string", async () => {
    req.body = { name: "   " };

    await updateProfile(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it("should return 400 when name is missing", async () => {
    req.body = {};

    await updateProfile(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should return 400 when name exceeds 100 characters", async () => {
    req.body = { name: "A".repeat(101) };

    await updateProfile(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "validation_error" }),
      }),
    );
  });

  it("should accept name at exactly 100 characters", async () => {
    req.body = { name: "A".repeat(100) };

    await updateProfile(req, res as Response);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { name: "A".repeat(100) } }),
    );
  });

  it("should return 401 when user context is missing", async () => {
    req.user = undefined;

    await updateProfile(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("should return 500 when Firestore write fails", async () => {
    req.body = { name: "Charlie" };
    mockUpdate.mockRejectedValueOnce(new Error("Firestore unavailable"));

    await updateProfile(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});
