import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAgentFiles } from "./useAgentFiles";

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

describe("useAgentFiles", () => {
  const agentId = "test-agent";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list files for an agent", async () => {
    const mockFiles = [
      { name: "soul.md", path: "/path/soul.md", missing: false, size: 100, updatedAtMs: 123 },
      { name: "tools.md", path: "/path/tools.md", missing: true },
    ];
    mockCall.mockResolvedValueOnce({ agentId, workspace: "/path", files: mockFiles });

    const { result } = renderHook(() => useAgentFiles(agentId));

    let files;
    await act(async () => {
      files = await result.current.listFiles();
    });

    expect(mockCall).toHaveBeenCalledWith("agents.files.list", { agentId });
    expect(files).toEqual(mockFiles);
  });

  it("should get file content", async () => {
    const fileName = "soul.md";
    const mockFile = {
      name: fileName,
      path: "/path/soul.md",
      missing: false,
      size: 100,
      updatedAtMs: 123,
      content: "Hello Soul",
    };
    mockCall.mockResolvedValueOnce({ agentId, workspace: "/path", file: mockFile });

    const { result } = renderHook(() => useAgentFiles(agentId));

    let file;
    await act(async () => {
      file = await result.current.getFile(fileName);
    });

    expect(mockCall).toHaveBeenCalledWith("agents.files.get", { agentId, name: fileName });
    expect(file).toEqual(mockFile);
  });

  it("should set file content", async () => {
    const fileName = "soul.md";
    const content = "New Soul Content";
    const mockFile = {
      name: fileName,
      path: "/path/soul.md",
      missing: false,
      size: 150,
      updatedAtMs: 456,
      content,
    };
    mockCall.mockResolvedValueOnce({ ok: true, agentId, workspace: "/path", file: mockFile });

    const { result } = renderHook(() => useAgentFiles(agentId));

    let res;
    await act(async () => {
      res = await result.current.setFile(fileName, content);
    });

    expect(mockCall).toHaveBeenCalledWith("agents.files.set", { agentId, name: fileName, content });
    expect(res).toEqual(mockFile);
  });

  it("should handle list errors", async () => {
    mockCall.mockRejectedValue(new Error("RPC Error"));

    const { result } = renderHook(() => useAgentFiles(agentId));

    await expect(result.current.listFiles()).rejects.toThrow("RPC Error");
  });
});
