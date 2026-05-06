import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useNodeDetail } from "./useNodeDetail";

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
  useRpcCall: (method: string) => {
    return async (params: any) => mockRpc.call(method, params);
  },
}));

// Mock crypto.randomUUID
if (typeof crypto === "undefined") {
  (global as any).crypto = { randomUUID: () => "test-uuid" };
} else if (!crypto.randomUUID) {
  (crypto as any).randomUUID = () => "test-uuid";
}

describe("useNodeDetail", () => {
  const nodeId = "test-node";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should describe a node", async () => {
    const mockDetail = { nodeId, name: "Test Node", connected: true };
    mockCall.mockResolvedValueOnce(mockDetail);

    const { result } = renderHook(() => useNodeDetail(nodeId));

    let detail;
    await act(async () => {
      detail = await result.current.describe();
    });

    expect(mockCall).toHaveBeenCalledWith("node.describe", { nodeId });
    expect(detail).toEqual(mockDetail);
  });

  it("should invoke a command on a node", async () => {
    const command = "test.command";
    const params = { foo: "bar" };
    const mockResult = { ok: true, payload: { success: true } };
    mockCall.mockResolvedValueOnce(mockResult);

    const { result } = renderHook(() => useNodeDetail(nodeId));

    let res;
    await act(async () => {
      res = await result.current.invoke(command, params);
    });

    expect(mockCall).toHaveBeenCalledWith(
      "node.invoke",
      expect.objectContaining({
        nodeId,
        command,
        params,
        idempotencyKey: expect.any(String),
      }),
    );
    expect(res).toEqual(mockResult);
  });

  it("should rename a node", async () => {
    const newName = "New Node Name";
    const mockResult = { nodeId, displayName: newName };
    mockCall.mockResolvedValueOnce(mockResult);

    const { result } = renderHook(() => useNodeDetail(nodeId));

    let res;
    await act(async () => {
      res = await result.current.rename(newName);
    });

    expect(mockCall).toHaveBeenCalledWith("node.rename", { nodeId, displayName: newName });
    expect(res).toEqual(mockResult);
  });
});
