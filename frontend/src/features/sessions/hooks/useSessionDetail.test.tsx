import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSessionsStore, type Session } from "../store";
import { useSessionDetail } from "./useSessionDetail";

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

describe("useSessionDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCall.mockResolvedValue({});
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

    expect(mockCall).toHaveBeenCalledWith("sessions.messages.subscribe", { key: "s1" });
    expect(mockRpc.subscribe).toHaveBeenCalledWith("session.message", expect.any(Function));
    expect(mockRpc.subscribe).toHaveBeenCalledWith("sessions.changed", expect.any(Function));
  });

  it("should unsubscribe on unmount", () => {
    const mockUnsubscribe = vi.fn();
    (mockRpc.subscribe as any).mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => useSessionDetail("s1"));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it("should update session when live update is received", async () => {
    const initialSession: Session = { sessionId: "s1", updatedAt: Date.now(), label: "Initial" };
    const updatedSession: Session = {
      sessionId: "s1",
      updatedAt: Date.now() + 1000,
      label: "Updated",
    };

    mockCall.mockResolvedValueOnce({ session: initialSession });
    renderHook(() => useSessionDetail("s1"));

    // Wait for initial fetch
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Get the handler passed to subscribe for sessions.changed
    const handler = (mockRpc.subscribe as any).mock.calls.find(
      (c: any) => c[0] === "sessions.changed",
    )?.[1];
    expect(handler).toBeDefined();

    await act(async () => {
      if (handler)
        handler({ sessionKey: "s1", session: updatedSession, reason: "patch", ts: Date.now() });
    });

    const selectedSession = useSessionsStore.getState().selectedSession;
    expect(selectedSession?.label).toBe("Updated");
  });

  it("should incrementally update session with partial payload when sessions.changed event is received", async () => {
    const initialSession: Session = { sessionId: "s1", updatedAt: Date.now(), label: "Initial" };
    mockCall.mockResolvedValueOnce({ session: initialSession });
    renderHook(() => useSessionDetail("s1"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const handler = (mockRpc.subscribe as any).mock.calls.find(
      (c: any) => c[0] === "sessions.changed",
    )?.[1];

    await act(async () => {
      if (handler)
        handler({
          sessionKey: "s1",
          sessionId: "s1",
          label: "Partially Updated",
          reason: "patch",
          ts: Date.now(),
        });
    });

    const selectedSession = useSessionsStore.getState().selectedSession;
    expect(selectedSession?.label).toBe("Partially Updated");
    expect(selectedSession?.sessionId).toBe("s1");
  });

  it("should incrementally append message when session.message event is received", async () => {
    const initialSession: Session = {
      sessionId: "s1",
      updatedAt: Date.now(),
      label: "Initial",
      messages: [],
    };
    mockCall.mockResolvedValueOnce({ session: initialSession });
    renderHook(() => useSessionDetail("s1"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const handler = (mockRpc.subscribe as any).mock.calls.find(
      (c: any) => c[0] === "session.message",
    )?.[1];

    const newMessage = { role: "assistant", content: "Hello" };
    await act(async () => {
      if (handler) handler({ sessionKey: "s1", message: newMessage });
    });

    const selectedSession = useSessionsStore.getState().selectedSession;
    expect(selectedSession?.messages).toHaveLength(1);
    expect(selectedSession?.messages?.[0]).toEqual(newMessage);
  });

  it("should refresh when session.message event with no message is received", async () => {
    const initialSession: Session = { sessionId: "s1", updatedAt: Date.now() };
    mockCall.mockResolvedValue({ session: initialSession });
    renderHook(() => useSessionDetail("s1"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const handler = (mockRpc.subscribe as any).mock.calls.find(
      (c: any) => c[0] === "session.message",
    )?.[1];

    await act(async () => {
      if (handler) handler({ sessionKey: "s1" });
    });

    // Mount (get) + Mount (subscribe) + Event refresh (get)
    expect(mockCall).toHaveBeenCalledTimes(3);
  });

  it("should refresh when sessions.changed event with no data is received", async () => {
    const initialSession: Session = { sessionId: "s1", updatedAt: Date.now() };
    mockCall.mockResolvedValue({ session: initialSession });
    renderHook(() => useSessionDetail("s1"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const handler = (mockRpc.subscribe as any).mock.calls.find(
      (c: any) => c[0] === "sessions.changed",
    )?.[1];

    await act(async () => {
      if (handler) handler({ sessionKey: "s1" });
    });

    // Mount (get) + Mount (subscribe) + Event refresh (get)
    expect(mockCall).toHaveBeenCalledTimes(3);
  });

  it("should handle steer error", async () => {
    mockCall.mockResolvedValue({ session: { sessionId: "s1" } });
    const { result } = renderHook(() => useSessionDetail("s1"));

    mockCall.mockRejectedValueOnce(new Error("Steer failed"));

    await act(async () => {
      await result.current.steer("fail");
    });

    expect(useSessionsStore.getState().error).toBe("Steer failed");
  });

  it("should provide a steer function that calls sessions.steer", async () => {
    const { result } = renderHook(() => useSessionDetail("s1"));

    await act(async () => {
      await result.current.steer("New direction");
    });

    expect(mockCall).toHaveBeenCalledWith("sessions.steer", {
      key: "s1",
      text: "New direction",
    });
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
