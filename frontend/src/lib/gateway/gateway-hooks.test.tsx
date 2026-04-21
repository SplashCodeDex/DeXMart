import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useGateway, useRpcCall, useGatewayStream, GatewayContext } from "./gateway-hooks";
import type { GatewayRpc } from "./gateway-rpc";

describe("Gateway Hooks", () => {
  let mockRpc: Partial<GatewayRpc>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc = {
      call: vi.fn(),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <GatewayContext.Provider
      value={{
        rpc: mockRpc as GatewayRpc,
        status: "connected",
        error: null,
        isHalted: false,
      }}
    >
      {children}
    </GatewayContext.Provider>
  );

  describe("useGateway", () => {
    it("returns the gateway context", () => {
      const { result } = renderHook(() => useGateway(), { wrapper });
      expect(result.current.rpc).toBe(mockRpc);
      expect(result.current.status).toBe("connected");
      expect(result.current.error).toBeNull();
    });

    it("throws if used outside of GatewayProvider", () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => renderHook(() => useGateway())).toThrow(
        "useGateway must be used within a GatewayProvider",
      );
      consoleSpy.mockRestore();
    });
  });

  describe("useRpcCall", () => {
    it("calls the rpc method", async () => {
      // @ts-expect-error Mock method for testing
      const { result } = renderHook(() => useRpcCall("someMethod"), { wrapper });

      const mockResult = { data: "ok" };
      (mockRpc.call as any).mockResolvedValueOnce(mockResult);

      const response = await result.current({ param: 1 });

      expect(mockRpc.call).toHaveBeenCalledWith("someMethod", { param: 1 });
      expect(response).toEqual(mockResult);
    });

    it("throws error if rpc is not available", async () => {
      // @ts-expect-error Mock method for testing
      const { result } = renderHook(() => useRpcCall("someMethod"), {
        wrapper: ({ children }) => (
          <GatewayContext.Provider
            value={{ rpc: null, status: "connecting", error: null, isHalted: false }}
          >
            {children}
          </GatewayContext.Provider>
        ),
      });

      await expect(result.current({})).rejects.toThrow("Gateway RPC is not available");
    });
  });

  describe("useGatewayStream", () => {
    it("subscribes to the event stream", () => {
      // @ts-expect-error Mock event for testing
      const { result } = renderHook(() => useGatewayStream("someEvent"), { wrapper });

      expect(mockRpc.subscribe).toHaveBeenCalledWith("someEvent", expect.any(Function));
      expect(result.current).toEqual([]);

      const callback = (mockRpc.subscribe as any).mock.calls[0][1];

      act(() => {
        callback({ data: 1 }, { seq: 1 });
      });

      expect(result.current).toHaveLength(1);
      expect(result.current[0].payload).toEqual({ data: 1 });

      act(() => {
        callback({ data: 2 }, { seq: 2 });
      });

      expect(result.current).toHaveLength(2);
      expect(result.current[1].payload).toEqual({ data: 2 });
    });

    it("cleans up subscription on unmount", () => {
      const unsubscribe = vi.fn();
      (mockRpc.subscribe as any).mockReturnValue(unsubscribe);

      // @ts-expect-error Mock event for testing
      const { unmount } = renderHook(() => useGatewayStream("someEvent"), { wrapper });

      unmount();
      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});
