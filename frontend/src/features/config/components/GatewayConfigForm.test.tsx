import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GatewayContext } from "@/lib/gateway/gateway-hooks";
import { GatewayConfigForm } from "./GatewayConfigForm";

// Mocking SchemaFormRenderer since we already tested it
vi.mock("@/components/schema-form/SchemaFormRenderer", () => ({
  SchemaFormRenderer: ({ schema, defaultValues, onSubmit }: any) => (
    <div data-testid="schema-form">
      <p>Schema loaded</p>
      <button onClick={() => onSubmit({ updated: true })}>Submit</button>
    </div>
  ),
}));

describe("GatewayConfigForm", () => {
  const mockRpc = {
    call: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  };

  const contextValue = {
    rpc: mockRpc as any,
    status: "connected" as const,
    error: null,
    isHalted: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads schema and config on mount", async () => {
    mockRpc.call.mockImplementation((method: string) => {
      if (method === "config.schema") {
        return Promise.resolve({ schema: { type: "object" }, uiHints: {} });
      }
      if (method === "config.get") {
        return Promise.resolve({ config: { existing: true }, baseHash: "hash1" });
      }
      return Promise.resolve({});
    });

    render(
      <GatewayContext.Provider value={contextValue}>
        <GatewayConfigForm />
      </GatewayContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("schema-form")).toBeDefined();
    });

    expect(mockRpc.call).toHaveBeenCalledWith("config.schema", {});
    expect(mockRpc.call).toHaveBeenCalledWith("config.get", {});
  });

  it("submits changes using config.set", async () => {
    mockRpc.call.mockImplementation((method: string) => {
      if (method === "config.schema") {
        return Promise.resolve({ schema: { type: "object" }, uiHints: {} });
      }
      if (method === "config.get") {
        return Promise.resolve({ config: { existing: true }, baseHash: "hash1" });
      }
      if (method === "config.set") {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({});
    });

    render(
      <GatewayContext.Provider value={contextValue}>
        <GatewayConfigForm />
      </GatewayContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("schema-form")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Submit"));

    await waitFor(() => {
      expect(mockRpc.call).toHaveBeenCalledWith("config.set", {
        raw: JSON.stringify({ updated: true }, null, 2),
        baseHash: "hash1",
      });
    });
  });

  it("submits changes using config.apply when 'Apply & Restart' is clicked", async () => {
    mockRpc.call.mockImplementation((method: string) => {
      if (method === "config.schema") {
        return Promise.resolve({ schema: { type: "object" }, uiHints: {} });
      }
      if (method === "config.get") {
        return Promise.resolve({ config: { existing: true }, baseHash: "hash1" });
      }
      if (method === "config.apply") {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({});
    });

    render(
      <GatewayContext.Provider value={contextValue}>
        <GatewayConfigForm />
      </GatewayContext.Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Apply & Restart")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Apply & Restart"));

    await waitFor(() => {
      expect(mockRpc.call).toHaveBeenCalledWith("config.apply", {
        raw: JSON.stringify({ updated: true }, null, 2),
        baseHash: "hash1",
        note: "Applied from DeXMart Dashboard",
      });
    });
  });
});
