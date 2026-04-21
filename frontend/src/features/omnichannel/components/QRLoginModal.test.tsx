import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GatewayContext } from "@/lib/gateway/gateway-hooks";
import type { GatewayContextState } from "@/lib/gateway/gateway-hooks";
import type { GatewayRpc } from "@/lib/gateway/gateway-rpc";
import { QRLoginModal } from "./QRLoginModal";

const QR_DATA_URL = "data:image/png;base64,abc123";

function makeWrapper(callImpl: (method: string, params: unknown) => Promise<unknown>) {
  const mockCall = vi.fn().mockImplementation(callImpl);
  const mockRpc = {
    call: mockCall,
    subscribe: vi.fn().mockReturnValue(() => {}),
  } as unknown as GatewayRpc;

  const value: GatewayContextState = {
    rpc: mockRpc,
    status: "connected",
    error: null,
    isHalted: false,
  };

  return {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>
    ),
    mockCall,
  };
}

describe("QRLoginModal", () => {
  const onClose = vi.fn();
  const onConnected = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render content when open is false", () => {
    const { wrapper } = makeWrapper(async () => ({}));
    render(<QRLoginModal open={false} onClose={onClose} onConnected={onConnected} />, { wrapper });
    expect(screen.queryByRole("img", { name: /qr/i })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows loading state while web.login.start is pending", () => {
    const { wrapper } = makeWrapper(() => new Promise(() => {}));
    render(<QRLoginModal open onClose={onClose} onConnected={onConnected} />, { wrapper });
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders QR image after web.login.start resolves", async () => {
    const { wrapper } = makeWrapper(async (method) => {
      if (method === "web.login.start") return { qrDataUrl: QR_DATA_URL, message: "Scan QR" };
      return new Promise(() => {});
    });
    render(<QRLoginModal open onClose={onClose} onConnected={onConnected} />, { wrapper });
    await waitFor(() => {
      const img = screen.getByRole("img", { name: /qr/i });
      expect(img.getAttribute("src")).toBe(QR_DATA_URL);
    });
  });

  it("shows countdown element after QR loads", async () => {
    const { wrapper } = makeWrapper(async (method) => {
      if (method === "web.login.start") return { qrDataUrl: QR_DATA_URL, message: "Scan QR" };
      return new Promise(() => {});
    });
    render(<QRLoginModal open onClose={onClose} onConnected={onConnected} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByTestId("qr-countdown")).toBeDefined();
    });
  });

  it("calls onConnected when web.login.wait resolves with connected: true", async () => {
    const { wrapper } = makeWrapper(async (method) => {
      if (method === "web.login.start") return { qrDataUrl: QR_DATA_URL, message: "Scan QR" };
      if (method === "web.login.wait") return { connected: true, message: "Connected!" };
      return {};
    });
    render(<QRLoginModal open onClose={onClose} onConnected={onConnected} />, { wrapper });
    await waitFor(() => {
      expect(onConnected).toHaveBeenCalled();
    });
  });

  it("auto-refreshes QR when web.login.wait resolves with connected: false", async () => {
    let waitCallCount = 0;
    const { wrapper, mockCall } = makeWrapper(async (method) => {
      if (method === "web.login.start") return { qrDataUrl: QR_DATA_URL, message: "Scan QR" };
      if (method === "web.login.wait") {
        waitCallCount++;
        if (waitCallCount === 1) return { connected: false, message: "Timed out" };
        return new Promise(() => {});
      }
      return {};
    });
    render(<QRLoginModal open onClose={onClose} onConnected={onConnected} />, { wrapper });
    await waitFor(() => {
      const startCalls = mockCall.mock.calls.filter(([m]: [string]) => m === "web.login.start");
      expect(startCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("stays in loading state when web.login.start throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { wrapper } = makeWrapper(async (method) => {
      if (method === "web.login.start") throw new Error("RPC error");
      return new Promise(() => {});
    });
    render(<QRLoginModal open onClose={onClose} onConnected={onConnected} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByRole("status")).toBeDefined();
    });
    expect(screen.queryByRole("img")).toBeNull();
    consoleSpy.mockRestore();
  });

  it("retains QR image when web.login.wait throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { wrapper } = makeWrapper(async (method) => {
      if (method === "web.login.start") return { qrDataUrl: QR_DATA_URL, message: "Scan QR" };
      if (method === "web.login.wait") throw new Error("Wait error");
      return {};
    });
    render(<QRLoginModal open onClose={onClose} onConnected={onConnected} />, { wrapper });
    await waitFor(() => screen.getByRole("img", { name: /qr/i }));
    expect(screen.getByRole("img", { name: /qr/i }).getAttribute("src")).toBe(QR_DATA_URL);
    consoleSpy.mockRestore();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const { wrapper } = makeWrapper(async (method) => {
      if (method === "web.login.start") return { qrDataUrl: QR_DATA_URL, message: "Scan QR" };
      return new Promise(() => {});
    });
    render(<QRLoginModal open onClose={onClose} onConnected={onConnected} />, { wrapper });
    await waitFor(() => screen.getByRole("img", { name: /qr/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("decrements countdown each second", async () => {
    vi.useFakeTimers();
    try {
      const { wrapper } = makeWrapper(async (method) => {
        if (method === "web.login.start") return { qrDataUrl: QR_DATA_URL, message: "Scan QR" };
        return new Promise(() => {});
      });
      render(<QRLoginModal open onClose={onClose} onConnected={onConnected} />, { wrapper });
      // flush microtasks so callStart resolves and QR renders
      await act(async () => {});
      const el = screen.getByTestId("qr-countdown");
      expect(el.textContent).toContain("60");
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(el.textContent).toContain("58");
    } finally {
      vi.useRealTimers();
    }
  });
});
