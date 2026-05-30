import { renderHook, act } from "@testing-library/react";
import { runTransaction } from "firebase/firestore";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuth } from "@/features/auth";
import { getClientFirestore } from "@/lib/firebase/client";
import { useAuthorityStore } from "@/stores/useAuthorityStore";
import { type ActionResult } from "@/types/api";
import { useCreateAgent } from "./useCreateAgent";

// Mock Auth
vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

// Mock Firebase
vi.mock("@/lib/firebase/client", () => ({
  getClientFirestore: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  runTransaction: vi.fn(),
  doc: vi.fn(),
  collection: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "mock-timestamp"),
}));

describe("useCreateAgent", () => {
  const mockUser = { id: "user_123", tenantId: "tenant_123", plan: "starter" };
  const mockAgentData = {
    name: "Test Agent",
    iconName: "bot",
    systemPrompt: "You are a test agent.",
    model: "gemini-1.5-flash" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ user: mockUser });
    (getClientFirestore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({});

    // Default store state
    useAuthorityStore.setState({
      tier: "starter",
      capabilities: {
        maxMessages: 1000,
        maxAgents: 1,
        maxChannelSlots: 1,
        minCronIntervalMs: 3600000,
        allowedSkills: [],
        features: {} as any,
        models: ["gemini-1.5-flash"],
      },
    });
  });

  it("should fail if user is not authenticated", async () => {
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ user: null });
    const { result } = renderHook(() => useCreateAgent());

    let response: ActionResult<string> | undefined;
    await act(async () => {
      response = await result.current.createAgent(mockAgentData);
    });

    expect(response?.success).toBe(false);
    if (response && !response.success) {
      expect(response.error.code).toBe("unauthorized");
    }
  });

  it("should fail if Starter plan already has 1 agent", async () => {
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { ...mockUser, plan: "starter" },
    });

    // Mock transaction to show 1 existing agent
    (runTransaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (
        _db: unknown,
        cb: (t: {
          get: ReturnType<typeof vi.fn>;
          set: ReturnType<typeof vi.fn>;
          update?: ReturnType<typeof vi.fn>;
        }) => unknown,
      ) => {
        return cb({
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({ agentCount: 1 }),
          }),
          set: vi.fn(),
        });
      },
    );

    const { result } = renderHook(() => useCreateAgent());

    let response: ActionResult<string> | undefined;
    await act(async () => {
      response = await result.current.createAgent(mockAgentData);
    });

    expect(response?.success).toBe(false);
    if (response && !response.success) {
      expect(response.error.code).toBe("tier_limit_reached");
      expect(response.error.message).toContain("Starter plan");
    }
  });

  it("should succeed if Pro plan has < 5 agents", async () => {
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { ...mockUser, plan: "pro" },
    });

    // Mock Pro tier in store
    useAuthorityStore.setState({
      tier: "pro",
      capabilities: {
        maxMessages: 10000,
        maxAgents: 5,
        maxChannelSlots: 3,
        minCronIntervalMs: 900000,
        allowedSkills: [],
        features: {} as any,
        models: ["gemini-1.5-flash", "gemini-1.5-pro"],
      },
    });

    // Mock transaction to show 2 existing agents (limit is 5)
    (runTransaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (
        _db: unknown,
        cb: (t: {
          get: ReturnType<typeof vi.fn>;
          set: ReturnType<typeof vi.fn>;
          update?: ReturnType<typeof vi.fn>;
        }) => unknown,
      ) => {
        return cb({
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({ agentCount: 2 }),
          }),
          set: vi.fn(),
          update: vi.fn(),
        });
      },
    );

    const { result } = renderHook(() => useCreateAgent());

    let response: ActionResult<string> | undefined;
    await act(async () => {
      response = await result.current.createAgent(mockAgentData);
    });

    expect(response?.success).toBe(true);
  });
});
