import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSessionsStore, type Session } from "../store";
import { useSessionsList } from "./useSessionsList";

// Mock the gateway rpc
const mockCall = vi.fn().mockResolvedValue({});
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

describe("useSessionsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCall.mockResolvedValue({});
    mockUseGateway.mockReturnValue({
      rpc: mockRpc,
      status: "connected",
    } as unknown as { rpc: typeof mockRpc; status: "connected" | "connecting" | "disconnected" });
    useSessionsStore.getState().clearSessions();
  });

  it("should fetch sessions on mount", async () => {
    const mockSessions: Session[] = [
      { sessionId: "s1", updatedAt: Date.now(), label: "Session 1" },
      { sessionId: "s2", updatedAt: Date.now() - 1000, label: "Session 2" },
    ];
    mockCall.mockResolvedValueOnce({ sessions: mockSessions });

    renderHook(() => useSessionsList());

    expect(mockCall).toHaveBeenCalledWith("sessions.list", expect.anything());

    // Wait for async effect
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const sessions = useSessionsStore.getState().sessions;
    expect(sessions).toEqual(mockSessions);
  });

  it("should handle fetch errors", async () => {
    mockCall.mockRejectedValue(new Error("Failed to fetch"));

    renderHook(() => useSessionsList());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(useSessionsStore.getState().error).toBe("Failed to fetch");
    expect(useSessionsStore.getState().isLoading).toBe(false);
  });

  it("should filter sessions by search query", async () => {
    const mockSessions: Session[] = [
      { sessionId: "s1", updatedAt: Date.now(), label: "Apple" },
      { sessionId: "s2", updatedAt: Date.now(), label: "Banana" },
    ];
    useSessionsStore.getState().setSessions(mockSessions);
    useSessionsStore.getState().setSearchQuery("App");

    const { result } = renderHook(() => useSessionsList());

    expect(result.current.filteredSessions).toHaveLength(1);
    expect(result.current.filteredSessions[0]?.label).toBe("Apple");
  });

  it("should provide refresh functionality", async () => {
    mockCall.mockResolvedValue({ sessions: [] });
    const { result } = renderHook(() => useSessionsList());

    await act(async () => {
      await result.current.refresh();
    });

    // Mount (list) + Mount (subscribe) + Manual refresh (list)
    expect(mockCall).toHaveBeenCalledTimes(3);
  });

  it("should unsubscribe on unmount", () => {
    const mockUnsubscribe = vi.fn();
    (mockRpc.subscribe as any).mockReturnValueOnce(mockUnsubscribe);

    const { unmount } = renderHook(() => useSessionsList());

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it("should refresh when sessions event is received", async () => {
    mockCall.mockResolvedValue({ sessions: [] });
    renderHook(() => useSessionsList());

    // Get the handler passed to subscribe
    const handler = (mockRpc.subscribe as any).mock.calls.find(
      (c: any) => c[0] === "sessions.changed",
    )?.[1];
    expect(handler).toBeDefined();

    await act(async () => {
      if (handler) handler();
    });

    // Mount (list) + Mount (subscribe) + Event (list)
    expect(mockCall).toHaveBeenCalledTimes(3);
  });

  it("should incrementally update session when sessions event with payload is received", async () => {
    const initialSessions: Session[] = [
      { sessionId: "s1", updatedAt: Date.now(), label: "Initial" },
    ];
    mockCall.mockResolvedValue({ sessions: initialSessions });

    renderHook(() => useSessionsList());

    // Wait for initial fetch
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Get the handler passed to subscribe
    const handler = (mockRpc.subscribe as any).mock.calls.find(
      (c: any) => c[0] === "sessions.changed",
    )?.[1];
    expect(handler).toBeDefined();

    await act(async () => {
      if (handler) {
        handler({ sessionId: "s1", label: "Updated", reason: "patch", ts: Date.now() });
      }
    });

    const sessions = useSessionsStore.getState().sessions;
    expect(sessions[0]?.label).toBe("Updated");
    // Should NOT have called refresh (sessions.list) again beyond mount
    // Mount calls: 1 (sessions.list) + 1 (sessions.subscribe)
    expect(mockCall).toHaveBeenCalledTimes(2);
  });

  it("should not fetch if status is not connected", async () => {
    mockUseGateway.mockReturnValue({
      rpc: mockRpc,
      status: "connecting",
    } as unknown as { rpc: typeof mockRpc; status: "connected" | "connecting" | "disconnected" });

    renderHook(() => useSessionsList());

    expect(mockCall).not.toHaveBeenCalled();
  });
});
