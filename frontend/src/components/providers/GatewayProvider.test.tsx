import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as GatewayClientModule from "../../lib/gateway/gateway-client";
import { useGateway } from "../../lib/gateway/gateway-hooks";
import { GatewayProvider } from "./GatewayProvider";

// Mock the client
vi.mock("../../lib/gateway/gateway-client", () => {
  return {
    createGatewayClient: vi.fn(),
  };
});

const DummyChild = () => {
  const { status, error, isHalted } = useGateway();
  return (
    <div data-testid="status">
      Status:{status} Error:{error?.message} Halted:{String(isHalted)}
    </div>
  );
};

describe("GatewayProvider", () => {
  let mockConnect: ReturnType<typeof vi.fn>;
  let mockDisconnect: ReturnType<typeof vi.fn>;
  let mockClientInstance: any;

  beforeEach(() => {
    mockConnect = vi.fn().mockReturnValue(new Promise(() => {})); // pending promise by default
    mockDisconnect = vi.fn();
    mockClientInstance = {
      connect: mockConnect,
      disconnect: mockDisconnect,
      isHalted: false,
    };

    vi.mocked(GatewayClientModule.createGatewayClient).mockReturnValue(mockClientInstance);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders children and starts in connecting state", () => {
    render(
      <GatewayProvider url="ws://test">
        <DummyChild />
      </GatewayProvider>,
    );
    expect(screen.getByTestId("status").textContent).toBe("Status:connecting Error: Halted:false");
    expect(GatewayClientModule.createGatewayClient).toHaveBeenCalledWith({
      url: "ws://test",
      getToken: expect.any(Function),
    });
    expect(mockConnect).toHaveBeenCalled();
  });

  it("updates state when connected", async () => {
    mockConnect.mockResolvedValueOnce(undefined);
    render(
      <GatewayProvider url="ws://test">
        <DummyChild />
      </GatewayProvider>,
    );

    // Initial state
    expect(screen.getByTestId("status").textContent).toBe("Status:connecting Error: Halted:false");

    // Wait for the promise to resolve
    await screen.findByText("Status:connected Error: Halted:false");
  });

  it("updates state when connection fails", async () => {
    mockConnect.mockRejectedValueOnce(new Error("Auth failed"));
    render(
      <GatewayProvider url="ws://test">
        <DummyChild />
      </GatewayProvider>,
    );

    await screen.findByText("Status:error Error:Auth failed Halted:false");
  });

  it("reflects non-recoverable isHalted state", async () => {
    mockClientInstance.isHalted = true;
    mockConnect.mockRejectedValueOnce(new Error("Token mismatch"));

    render(
      <GatewayProvider url="ws://test">
        <DummyChild />
      </GatewayProvider>,
    );

    await screen.findByText("Status:error Error:Token mismatch Halted:true");
  });

  it("disconnects client on unmount", () => {
    const { unmount } = render(
      <GatewayProvider url="ws://test">
        <DummyChild />
      </GatewayProvider>,
    );
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
