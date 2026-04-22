import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GatewayContext } from "@/lib/gateway/gateway-hooks";
import type { GatewayContextState } from "@/lib/gateway/gateway-hooks";

const mockSubscribe = vi.fn().mockReturnValue(() => {});
const mockGetState = vi.fn().mockReturnValue("CLOSED");

vi.mock("@/lib/api/apiCircuitBreaker", () => ({
  circuitBreaker: {
    getState: mockGetState,
    subscribe: mockSubscribe,
  },
}));

function makeCtx(overrides: Partial<GatewayContextState> = {}): GatewayContextState {
  return {
    rpc: null,
    status: "connected",
    error: null,
    isHalted: false,
    ...overrides,
  };
}

function wrap(ctx: GatewayContextState) {
  return ({ children }: { children: React.ReactNode }) => (
    <GatewayContext.Provider value={ctx}>{children}</GatewayContext.Provider>
  );
}

// Re-import after mocks are set up
const { ConnectionStatus } = await import("@/components/shared");

describe("ConnectionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetState.mockReturnValue("CLOSED");
    mockSubscribe.mockReturnValue(() => {});
  });

  it("renders nothing when gateway connected and circuit breaker closed", () => {
    const { container } = render(<ConnectionStatus />, { wrapper: wrap(makeCtx()) });
    expect(container.firstChild).toBeNull();
  });

  it("shows 'Connection Lost' banner on gateway error", () => {
    render(<ConnectionStatus />, { wrapper: wrap(makeCtx({ status: "error" })) });
    expect(screen.getByText("Connection Lost")).toBeDefined();
  });

  it("shows 'Reconnecting...' banner when gateway is reconnecting", () => {
    render(<ConnectionStatus />, { wrapper: wrap(makeCtx({ status: "reconnecting" })) });
    expect(screen.getByText("Reconnecting...")).toBeDefined();
  });

  it("shows auth failure message when gateway is halted", () => {
    render(<ConnectionStatus />, {
      wrapper: wrap(makeCtx({ isHalted: true, status: "error" })),
    });
    expect(screen.getByText(/authentication failed/i)).toBeDefined();
  });

  it("shows banner when circuit breaker is OPEN", () => {
    mockGetState.mockReturnValue("OPEN");
    render(<ConnectionStatus />, { wrapper: wrap(makeCtx()) });
    expect(screen.getByText("Connection Lost")).toBeDefined();
  });

  it("subscribes to circuit breaker changes on mount and unsubscribes on unmount", () => {
    const unsubscribe = vi.fn();
    mockSubscribe.mockReturnValue(unsubscribe);
    const { unmount } = render(<ConnectionStatus />, { wrapper: wrap(makeCtx()) });
    expect(mockSubscribe).toHaveBeenCalledOnce();
    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("updates banner when circuit breaker state changes via subscription", () => {
    let listener: ((group: string, state: string) => void) | undefined;
    mockSubscribe.mockImplementation((cb: (group: string, state: string) => void) => {
      listener = cb;
      return () => {};
    });
    render(<ConnectionStatus />, { wrapper: wrap(makeCtx()) });
    expect(screen.queryByText("Connection Lost")).toBeNull();
    act(() => listener?.("omnichannel", "OPEN"));
    expect(screen.getByText("Connection Lost")).toBeDefined();
  });
});
