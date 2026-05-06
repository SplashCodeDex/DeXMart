import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "@/lib/api/client";
import type { Capabilities } from "@/types/authority";
import { useAuthorityStore } from "./useAuthorityStore";

vi.mock("@/lib/api/client", () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockCapabilities: Capabilities = {
  maxMessages: 10000,
  maxAgents: 5,
  maxChannelSlots: 3,
  minCronIntervalMs: 900000,
  allowedSkills: ["basic_reply", "web_search"],
  features: {
    marketing: true,
    backups: true,
    aiReasoning: true,
    aiMessageSpinning: false,
  },
  models: ["gemini-pro"],
};

describe("useAuthorityStore", () => {
  beforeEach(() => {
    useAuthorityStore.setState({
      tier: "starter",
      capabilities: null,
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  it("should initialize with default values", () => {
    const state = useAuthorityStore.getState();
    expect(state.tier).toBe("starter");
    expect(state.capabilities).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  describe("fetchCapabilities", () => {
    it("should populate tier and capabilities on success", async () => {
      (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { tier: "pro", capabilities: mockCapabilities },
      });

      await useAuthorityStore.getState().fetchCapabilities();

      const state = useAuthorityStore.getState();
      expect(state.tier).toBe("pro");
      expect(state.capabilities).toEqual(mockCapabilities);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("should set error when API returns failure", async () => {
      (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: { message: "Unauthorized" },
      });

      await useAuthorityStore.getState().fetchCapabilities();

      const state = useAuthorityStore.getState();
      expect(state.capabilities).toBeNull();
      expect(state.error).toBe("Unauthorized");
      expect(state.isLoading).toBe(false);
    });

    it("should set error when API throws", async () => {
      (api.get as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network failure"),
      );

      await useAuthorityStore.getState().fetchCapabilities();

      const state = useAuthorityStore.getState();
      expect(state.capabilities).toBeNull();
      expect(state.error).toBe("Network failure");
      expect(state.isLoading).toBe(false);
    });
  });

  describe("isFeatureAllowed", () => {
    it("should return false when capabilities are not loaded", () => {
      expect(useAuthorityStore.getState().isFeatureAllowed("marketing")).toBe(false);
    });

    it("should return correct feature flag from capabilities", () => {
      useAuthorityStore.setState({ capabilities: mockCapabilities });

      expect(useAuthorityStore.getState().isFeatureAllowed("marketing")).toBe(true);
      expect(useAuthorityStore.getState().isFeatureAllowed("aiMessageSpinning")).toBe(false);
    });
  });

  describe("isSkillAllowed", () => {
    it("should return false when capabilities are not loaded", () => {
      expect(useAuthorityStore.getState().isSkillAllowed("web_search")).toBe(false);
    });

    it("should return true for skills in the allowed list", () => {
      useAuthorityStore.setState({ capabilities: mockCapabilities });

      expect(useAuthorityStore.getState().isSkillAllowed("web_search")).toBe(true);
      expect(useAuthorityStore.getState().isSkillAllowed("basic_reply")).toBe(true);
    });

    it("should return false for skills not in the allowed list", () => {
      useAuthorityStore.setState({ capabilities: mockCapabilities });

      expect(useAuthorityStore.getState().isSkillAllowed("custom_scripting")).toBe(false);
    });
  });

  describe("getLimit", () => {
    it("should return 0 when capabilities are not loaded", () => {
      expect(useAuthorityStore.getState().getLimit("maxAgents")).toBe(0);
      expect(useAuthorityStore.getState().getLimit("maxChannelSlots")).toBe(0);
    });

    it("should return correct numeric limits from capabilities", () => {
      useAuthorityStore.setState({ capabilities: mockCapabilities });

      expect(useAuthorityStore.getState().getLimit("maxAgents")).toBe(5);
      expect(useAuthorityStore.getState().getLimit("maxChannelSlots")).toBe(3);
      expect(useAuthorityStore.getState().getLimit("maxMessages")).toBe(10000);
    });
  });
});
