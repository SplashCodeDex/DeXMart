import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useSessionsStore, type Session } from "../store";
import { useSessionDetail } from "./useSessionDetail";

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

describe("useSessionDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGateway.mockReturnValue({
      rpc: mockRpc,
      status: "connected",
    } as unknown as { rpc: typeof mockRpc; status: "connected" | "connecting" | "disconnected" });
    useSessionsStore.getState().clearSessions();
  });

  it("should fetch session detail on mount", async () => {
    const mockSession: Session = { sessionId: "s1", updatedAt: Date.now(), label: "Session 1" };
    mockCall.mockResolvedValueOnce({ session: mockSession });

    renderHook(() => useSessionDetail("s1"));

    expect(mockCall).toHaveBeenCalledWith("sessions.get", { key: "s1" });

    // Wait for async effect
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const selectedSession = useSessionsStore.getState().selectedSession;
    expect(selectedSession).toEqual(mockSession);
  });

  it("should subscribe to session updates on mount", () => {
    renderHook(() => useSessionDetail("s1"));

    expect(mockRpc.subscribe).toHaveBeenCalledWith("session:s1", expect.any(Function));
  });

  it("should unsubscribe on unmount", () => {
    const mockUnsubscribe = vi.fn();
    mockRpc.subscribe.mockReturnValueOnce(mockUnsubscribe as unknown as () => void);

    const { unmount } = renderHook(() => useSessionDetail("s1"));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it("should update session when live update is received", async () => {
    const initialSession: Session = { sessionId: "s1", updatedAt: Date.now(), label: "Initial" };
    const updatedSession: Session = { sessionId: "s1", updatedAt: Date.now() + 1000, label: "Updated" };

    mockCall.mockResolvedValueOnce({ session: initialSession });
    renderHook(() => useSessionDetail("s1"));

    // Wait for initial fetch
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Get the handler passed to subscribe
    const handler = mockRpc.subscribe.mock.calls.find((c: [string, () => void]) => c[0] === "session:s1")?.[1];
    expect(handler).toBeDefined();

    await act(async () => {
      if (handler) handler(updatedSession);
    });

    const selectedSession = useSessionsStore.getState().selectedSession;
    expect(selectedSession?.label).toBe("Updated");
  });

  it("should not fetch if status is not connected", async () => {
    mockUseGateway.mockReturnValue({
      rpc: mockRpc,
      status: "connecting",
    } as unknown as { rpc: typeof mockRpc; status: "connected" | "connecting" | "disconnected" });

    renderHook(() => useSessionDetail("s1"));

    expect(mockCall).not.toHaveBeenCalled();
  });

  it("should not fetch if sessionId is null", async () => {
    renderHook(() => useSessionDetail(null));

    expect(mockCall).not.toHaveBeenCalled();
  });

  it("should handle fetch error with non-Error object", async () => {
    mockCall.mockRejectedValue("String error");

    renderHook(() => useSessionDetail("s1"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(useSessionsStore.getState().error).toBe("Failed to fetch session detail");
  });
});
