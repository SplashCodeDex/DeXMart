import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { UsageFooter } from "./UsageFooter";

// Mock the gateway hooks
const mockRpcCall = vi.fn();
vi.mock("@/lib/gateway/gateway-hooks", () => ({
  useRpcCall: () => mockRpcCall,
}));

describe("UsageFooter", () => {
  it("should render usage information", async () => {
    mockRpcCall.mockResolvedValue({
      sessions: [
        {
          usage: { totalCost: 0.05, totalTokens: 1200, input: 800, output: 400 },
        },
      ],
    });

    render(<UsageFooter sessionKey="main" />);

    // Should show Cost after async fetch
    await waitFor(() => {
      expect(screen.getByText(/Cost:/i)).toBeDefined();
      expect(screen.getByText(/Tokens:/i)).toBeDefined();
    });
  });
});
