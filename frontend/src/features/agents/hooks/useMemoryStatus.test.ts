import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMemoryStatus } from "./useMemoryStatus";

// Mock the gateway hooks
const mockCall = vi.fn();
const stableRpcFns: Record<string, any> = {};

vi.mock("@/lib/gateway/gateway-hooks", () => ({
  useGateway: () => ({
    rpc: { call: mockCall },
    status: "connected",
  }),
  useRpcCall: (method: string) => {
    if (!stableRpcFns[method]) {
      stableRpcFns[method] = async (params: any) => mockCall(method, params);
    }
    return stableRpcFns[method];
  },
}));

describe("useMemoryStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch memory status on mount", async () => {
    const mockStatus = {
      agentId: "test-agent",
      dreaming: {
        enabled: true,
        shortTermCount: 10,
        totalSignalCount: 100,
        phases: {
          light: { managedCronPresent: true },
          deep: { managedCronPresent: true },
          rem: { managedCronPresent: true },
        },
      },
    };
    const mockDiary = {
      found: true,
      content: "Dream 1: I am a bot.\nDream 2: I am dreaming.",
    };

    // Initial fetch calls both
    mockCall.mockResolvedValueOnce(mockStatus);
    mockCall.mockResolvedValueOnce(mockDiary);

    const { result } = renderHook(() => useMemoryStatus());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockCall).toHaveBeenCalledWith("doctor.memory.status", {});
    expect(mockCall).toHaveBeenCalledWith("doctor.memory.dreamDiary", {});
    expect(result.current.status).toEqual(mockStatus);
    expect(result.current.diary).toEqual(mockDiary);
    expect(result.current.isDreaming).toBe(true);
  });

  it("should toggle dreaming status using config.patch", async () => {
    const mockStatus = {
      agentId: "test-agent",
      dreaming: {
        enabled: false,
      },
    };
    mockCall.mockResolvedValueOnce(mockStatus); // Initial fetch status
    mockCall.mockResolvedValueOnce({ found: false }); // Initial fetch diary

    const { result } = renderHook(() => useMemoryStatus());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isDreaming).toBe(false);

    // Toggle on
    mockCall.mockResolvedValueOnce({ ok: true }); // config.patch response
    mockCall.mockResolvedValueOnce({ ...mockStatus, dreaming: { enabled: true } }); // follow-up refresh status
    mockCall.mockResolvedValueOnce({ found: false }); // follow-up refresh diary

    await act(async () => {
      await result.current.toggleDreaming(true);
    });

    expect(mockCall).toHaveBeenCalledWith("config.patch", {
      raw: JSON.stringify({
        plugins: {
          entries: {
            "memory-core": {
              config: {
                dreaming: {
                  enabled: true,
                },
              },
            },
          },
        },
      }),
    });

    expect(result.current.isDreaming).toBe(true);
  });

  it("should handle errors during fetch", async () => {
    mockCall.mockRejectedValue(new Error("Gateway error"));

    const { result } = renderHook(() => useMemoryStatus());

    await waitFor(() => expect(result.current.error).toBe("Gateway error"));
    expect(result.current.isLoading).toBe(false);
  });
});
