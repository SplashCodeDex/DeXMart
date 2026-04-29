import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useChannelStatus } from "./useChannelStatus";

// Mock the gateway rpc
const mockCall = vi.fn();
const mockRpc = {
  call: mockCall,
  subscribe: vi.fn(),
};

vi.mock("@/lib/gateway/gateway-hooks", () => ({
  useGateway: () => ({
    rpc: mockRpc,
    status: "connected",
  }),
}));

describe("useChannelStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should fetch status on mount", async () => {
    mockCall.mockResolvedValue({
      ts: Date.now(),
      channels: {},
      channelAccounts: {},
      channelOrder: [],
      channelLabels: {},
      channelDefaultAccountId: {},
    });

    renderHook(() => useChannelStatus());

    expect(mockCall).toHaveBeenCalledWith("channels.status", expect.anything());
  });

  it("should poll status at the specified interval", async () => {
    mockCall.mockResolvedValue({
      ts: Date.now(),
      channels: {},
      channelAccounts: {},
      channelOrder: [],
      channelLabels: {},
      channelDefaultAccountId: {},
    });

    renderHook(() => useChannelStatus({ interval: 1000 }));

    // First call on mount
    expect(mockCall).toHaveBeenCalledTimes(1);

    // Advance time
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockCall).toHaveBeenCalledTimes(2);
  });

  it("should expose formatted channel data and decode QR", async () => {
    mockCall.mockResolvedValue({
      ts: Date.now(),
      channels: {
        whatsapp: { configured: true },
      },
      channelAccounts: {
        whatsapp: [
          {
            accountId: "acc-1",
            status: "connected",
            probe: {
              rawQr: "abc123base64",
            },
          },
        ],
      },
      channelOrder: ["whatsapp"],
      channelLabels: { whatsapp: "WhatsApp" },
      channelDefaultAccountId: { whatsapp: "acc-1" },
    });

    const { result } = renderHook(() => useChannelStatus());

    await waitFor(() => {
      expect(result.current.channels.whatsapp).toBeDefined();
    });

    expect(result.current.channelAccounts.whatsapp[0].accountId).toBe("acc-1");
    // Verify QR decoding (implementation should prefix with data:image/png;base64,)
    expect(result.current.channelAccounts.whatsapp[0].probe?.qrDataUrl).toBe(
      "data:image/png;base64,abc123base64",
    );
  });

  it("should handle error in polling gracefully", async () => {
    mockCall.mockRejectedValueOnce(new Error("RPC error"));

    const { result } = renderHook(() => useChannelStatus({ interval: 1000 }));

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });

    // Setup success for next poll
    mockCall.mockResolvedValue({
      ts: Date.now(),
      channels: {},
      channelAccounts: {},
      channelOrder: [],
      channelLabels: {},
      channelDefaultAccountId: {},
    });

    // Advance time for next poll
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mockCall).toHaveBeenCalledTimes(2);
    });

    // Error should be cleared on success
    expect(result.current.error).toBeNull();
  });
});
