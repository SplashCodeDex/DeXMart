import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionHeader } from "./SessionHeader";

// Mock the gateway hooks
const mockRpcCall = vi.fn();
vi.mock("@/lib/gateway/gateway-hooks", () => ({
  useRpcCall: () => mockRpcCall,
  useGateway: () => ({ rpc: { call: vi.fn(), subscribe: vi.fn() }, status: "connected" }),
}));

// Mock ModelSelector
vi.mock("@/components/shared/ModelSelector", () => ({
  ModelSelector: () => <div data-testid="model-selector" />,
}));

describe("SessionHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render session name", async () => {
    mockRpcCall.mockResolvedValue({ sessions: [{ key: "main", label: "General" }] });

    await act(async () => {
      render(<SessionHeader currentSessionKey="main" onSessionChange={vi.fn()} />);
    });

    // It should eventually show the label from history if it exists, or the key
    expect(screen.getByText(/General|main/i)).toBeDefined();
  });
});
