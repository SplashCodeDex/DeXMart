import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useGateway } from "@/lib/gateway/gateway-hooks";
import { useAgentsCrud } from "./useAgentsCrud";

vi.mock("@/lib/gateway/gateway-hooks", () => ({
  useGateway: vi.fn(),
}));

describe("useAgentsCrud", () => {
  const mockRpc = {
    call: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useGateway as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      rpc: mockRpc,
      status: "connected",
    });
  });

  it("should create an agent successfully", async () => {
    mockRpc.call.mockResolvedValue({ ok: true, agent: { id: "new-agent-id" } });

    const { result } = renderHook(() => useAgentsCrud());

    let response: any;
    await act(async () => {
      response = await result.current.createAgent({ name: "New Agent" });
    });

    expect(mockRpc.call).toHaveBeenCalledWith("agents.create", { name: "New Agent" });
    expect(response).toEqual({
      success: true,
      data: "new-agent-id",
      message: "Agent created successfully",
    });
  });

  it("should delete an agent successfully", async () => {
    mockRpc.call.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useAgentsCrud());

    let success;
    await act(async () => {
      success = await result.current.deleteAgent("agent-to-delete");
    });

    expect(mockRpc.call).toHaveBeenCalledWith("agents.delete", {
      id: "agent-to-delete",
      deleteFiles: true,
    });
    expect(success).toBe(true);
  });

  it("should fail to create an agent if RPC fails", async () => {
    mockRpc.call.mockRejectedValue(new Error("RPC Error"));

    const { result } = renderHook(() => useAgentsCrud());

    let response: any;
    await act(async () => {
      response = await result.current.createAgent({ name: "New Agent" });
    });

    expect(response?.success).toBe(false);
  });
});
