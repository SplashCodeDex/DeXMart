import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSessionsStore, type Checkpoint } from "../store";
import { useCompaction } from "./useCompaction";

// Mock the gateway rpc
const mockCall = vi.fn();
const mockRpc = {
  call: mockCall,
  subscribe: vi.fn(() => vi.fn()),
};

const mockUseGateway = vi.fn(() => ({
  rpc: mockRpc,
  status: "connected",
}));

vi.mock("@/lib/gateway/gateway-hooks", () => ({
  useGateway: () => mockUseGateway(),
}));

describe("useCompaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGateway.mockReturnValue({
      rpc: mockRpc,
      status: "connected",
    } as unknown as { rpc: typeof mockRpc; status: "connected" | "connecting" | "disconnected" });
    useSessionsStore.getState().clearSessions();
  });

  it("should fetch checkpoints on mount", async () => {
    const mockCheckpoints: Checkpoint[] = [
      { id: "c1", updatedAt: Date.now(), reason: "manual", tokenCount: 100, messageCount: 5 },
    ];
    mockCall.mockResolvedValueOnce({ checkpoints: mockCheckpoints });

    renderHook(() => useCompaction("s1"));

    expect(mockCall).toHaveBeenCalledWith("sessions.compaction.list", { key: "s1" });

    // Wait for async effect
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const checkpoints = useSessionsStore.getState().checkpoints;
    expect(checkpoints).toEqual(mockCheckpoints);
  });

  it("should handle restore action", async () => {
    mockCall.mockResolvedValueOnce({ checkpoints: [] }); // Initial fetch
    mockCall.mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useCompaction("s1"));

    await act(async () => {
      await result.current.restore("c1");
    });

    expect(mockCall).toHaveBeenCalledWith("sessions.compaction.restore", {
      key: "s1",
      checkpointId: "c1",
    });
  });

  it("should handle branch action", async () => {
    mockCall.mockResolvedValueOnce({ checkpoints: [] }); // Initial fetch
    mockCall.mockResolvedValueOnce({ ok: true, sessionId: "s2" });
    const { result } = renderHook(() => useCompaction("s1"));

    let newSessionId;
    await act(async () => {
      newSessionId = await result.current.branch("c1", "New Branch");
    });

    expect(mockCall).toHaveBeenCalledWith("sessions.compaction.branch", {
      key: "s1",
      checkpointId: "c1",
      label: "New Branch",
    });
    expect(newSessionId).toBe("s2");
  });

  it("should not fetch if status is not connected", async () => {
    mockUseGateway.mockReturnValue({
      rpc: mockRpc,
      status: "connecting",
    } as unknown as { rpc: typeof mockRpc; status: "connected" | "connecting" | "disconnected" });

    renderHook(() => useCompaction("s1"));

    expect(mockCall).not.toHaveBeenCalled();
  });

  it("should handle fetch error", async () => {
    mockCall.mockRejectedValue(new Error("Fetch failed"));

    renderHook(() => useCompaction("s1"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(useSessionsStore.getState().error).toBe("Fetch failed");
  });

  it("should handle restore error", async () => {
    mockCall.mockResolvedValueOnce({ checkpoints: [] }); // Initial fetch
    mockCall.mockRejectedValue(new Error("Restore failed"));
    const { result } = renderHook(() => useCompaction("s1"));

    await act(async () => {
      await result.current.restore("c1");
    });

    expect(useSessionsStore.getState().error).toBe("Restore failed");
  });

  it("should handle branch error", async () => {
    mockCall.mockResolvedValueOnce({ checkpoints: [] }); // Initial fetch
    mockCall.mockRejectedValue(new Error("Branch failed"));
    const { result } = renderHook(() => useCompaction("s1"));

    await act(async () => {
      await result.current.branch("c1");
    });

    expect(useSessionsStore.getState().error).toBe("Branch failed");
  });
});
