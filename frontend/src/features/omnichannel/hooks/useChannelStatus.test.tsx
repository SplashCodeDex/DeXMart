import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
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
    vi.useFakeTimers();
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
    vi.useRealTimers();
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

    const { result } = renderHook(() => useChannelStatus({ enabled: false }));

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.channels.whatsapp).toBeDefined();
    });

    const whatsappAccount = result.current.channelAccounts.whatsapp?.[0];
    expect(whatsappAccount?.accountId).toBe("acc-1");
    // Verify QR decoding (implementation should prefix with data:image/png;base64,)
    expect((whatsappAccount?.probe as any)?.qrDataUrl).toBe("data:image/png;base64,abc123base64");
  });

  it("should handle error in polling gracefully", async () => {
    mockCall.mockRejectedValueOnce(new Error("RPC error"));

    const { result } = renderHook(() => useChannelStatus({ enabled: false }));

    await act(async () => {
      await result.current.refresh();
    });

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

    // Refresh again
    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(mockCall).toHaveBeenCalledTimes(2);
    });

    // Error should be cleared on success
    expect(result.current.error).toBeNull();
  });

  it("should call channels.logout RPC and refresh", async () => {
    mockCall.mockResolvedValue({
      ts: Date.now(),
      channels: {},
      channelAccounts: {
        whatsapp: [{ accountId: "acc-1", status: "connected" }],
      },
      channelOrder: ["whatsapp"],
      channelLabels: { whatsapp: "WhatsApp" },
      channelDefaultAccountId: { whatsapp: "acc-1" },
    });

    const { result } = renderHook(() => useChannelStatus({ enabled: false }));

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.channelAccounts.whatsapp).toBeDefined();
    });

    await act(async () => {
      await result.current.logout("whatsapp", "acc-1");
    });

    expect(mockCall).toHaveBeenCalledWith("channels.logout", {
      channel: "whatsapp",
      accountId: "acc-1",
    });
    // First call on mount, second call for logout, third call for refresh
    expect(mockCall).toHaveBeenCalledTimes(3);
  });
});
