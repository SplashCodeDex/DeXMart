import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DevicePairingList } from "@/types";
import { useDevicesStore } from "../store";
import { useDevices } from "./useDevices";

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

describe("useDevices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCall.mockResolvedValue({});
    mockUseGateway.mockReturnValue({
      rpc: mockRpc,
      status: "connected",
    } as any);
    useDevicesStore.getState().clearDevices();
  });

  it("should fetch devices on mount", async () => {
    const mockDevices: DevicePairingList = {
      pending: [
        {
          requestId: "req1",
          deviceId: "d1",
          name: "Device 1",
          role: "proxy",
          requestedAt: Date.now(),
        },
      ],
      paired: [{ deviceId: "d2", role: "master", scopes: ["*"], pairedAt: Date.now() }],
    };
    mockCall.mockResolvedValueOnce(mockDevices);

    renderHook(() => useDevices());

    expect(mockCall).toHaveBeenCalledWith("device.pair.list", {});

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const state = useDevicesStore.getState();
    expect(state.pending).toEqual(mockDevices.pending);
    expect(state.paired).toEqual(mockDevices.paired);
  });

  it("should provide approve functionality", async () => {
    const { result } = renderHook(() => useDevices());

    await act(async () => {
      await result.current.approve("req1");
    });

    expect(mockCall).toHaveBeenCalledWith("device.pair.approve", { requestId: "req1" });
  });

  it("should provide reject functionality", async () => {
    const { result } = renderHook(() => useDevices());

    await act(async () => {
      await result.current.reject("req1");
    });

    expect(mockCall).toHaveBeenCalledWith("device.pair.reject", { requestId: "req1" });
  });

  it("should provide remove functionality", async () => {
    const { result } = renderHook(() => useDevices());

    await act(async () => {
      await result.current.remove("d2");
    });

    expect(mockCall).toHaveBeenCalledWith("device.pair.remove", { deviceId: "d2" });
  });

  it("should provide rotate functionality", async () => {
    const { result } = renderHook(() => useDevices());
    const mockResponse = { ok: true, token: "new-token-123" };
    mockCall.mockResolvedValueOnce(mockResponse);

    let rotateResult;
    await act(async () => {
      rotateResult = await result.current.rotate("d2", "master");
    });

    expect(mockCall).toHaveBeenCalledWith("device.token.rotate", {
      deviceId: "d2",
      role: "master",
    });
    expect(rotateResult).toEqual(mockResponse);
  });

  it("should provide revoke functionality", async () => {
    const { result } = renderHook(() => useDevices());
    const mockResponse = { ok: true };
    mockCall.mockResolvedValueOnce(mockResponse);

    let revokeResult;
    await act(async () => {
      revokeResult = await result.current.revoke("d2", "master");
    });

    expect(mockCall).toHaveBeenCalledWith("device.token.revoke", {
      deviceId: "d2",
      role: "master",
    });
    expect(revokeResult).toEqual(mockResponse);
  });

  it("should handle errors when fetching devices", async () => {
    mockCall.mockRejectedValueOnce(new Error("Network Error"));

    renderHook(() => useDevices());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const state = useDevicesStore.getState();
    expect(state.error).toBe("Network Error");
  });

  it("should return false/null when rpc is missing", async () => {
    mockUseGateway.mockReturnValue({
      rpc: null,
      status: "error",
    } as any);

    const { result } = renderHook(() => useDevices());

    let approveResult;
    await act(async () => {
      approveResult = await result.current.approve("req1");
    });
    expect(approveResult).toBe(false);

    let rotateResult;
    await act(async () => {
      rotateResult = await result.current.rotate("d2", "role");
    });
    expect(rotateResult).toBe(null);
  });
});
