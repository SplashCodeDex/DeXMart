import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAgentIdentity } from "./useAgentIdentity";

// Mock the gateway rpc
const mockCall = vi.fn();
const mockRpc = {
  call: mockCall,
  subscribe: vi.fn(() => vi.fn()),
};

vi.mock("@/lib/gateway/gateway-hooks", () => ({
  useGateway: () => ({
    rpc: mockRpc,
    status: "connected",
  }),
}));

describe("useAgentIdentity", () => {
  const agentId = "test-agent";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch agent identity on mount", async () => {
    const mockIdentity = { id: agentId, name: "Test Agent", model: "gpt-4" };
    mockCall.mockResolvedValueOnce({ identity: mockIdentity });

    const { result } = renderHook(() => useAgentIdentity(agentId));

    // Wait for initial fetch
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockCall).toHaveBeenCalledWith("agent.identity.get", { agentId });
    expect(result.current.identity).toEqual(mockIdentity);
  });

  it("should update agent identity", async () => {
    const mockIdentity = { id: agentId, name: "Initial Name" };
    mockCall.mockResolvedValueOnce({ identity: mockIdentity }); // for mount
    
    const { result } = renderHook(() => useAgentIdentity(agentId));
    
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const updatedIdentity = { id: agentId, name: "Updated Name" };
    mockCall.mockResolvedValueOnce({ ok: true, agent: updatedIdentity });

    let success;
    await act(async () => {
      success = await result.current.updateIdentity({ name: "Updated Name" });
    });

    expect(mockCall).toHaveBeenCalledWith("agents.update", { id: agentId, name: "Updated Name" });
    expect(success).toBe(true);
    expect(result.current.identity?.name).toBe("Updated Name");
  });

  it("should handle fetch error", async () => {
    mockCall.mockRejectedValue(new Error("Fetch failed"));

    const { result } = renderHook(() => useAgentIdentity(agentId));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.error).toBe("Fetch failed");
  });
});
