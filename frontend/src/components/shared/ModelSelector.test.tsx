import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GatewayContext } from "@/lib/gateway/gateway-hooks";
import type { GatewayContextState } from "@/lib/gateway/gateway-hooks";
import type { GatewayRpc } from "@/lib/gateway/gateway-rpc";
import type { ModelCatalogEntry } from "@/lib/gateway/models-types";
import { ModelSelector } from "./ModelSelector";

const MODELS: ModelCatalogEntry[] = [
  { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "anthropic" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "google" },
];

function makeWrapper(callImpl: (method: string, params: unknown) => Promise<unknown>) {
  const mockRpc = {
    call: vi.fn().mockImplementation(callImpl),
    subscribe: vi.fn().mockReturnValue(() => {}),
  } as unknown as GatewayRpc;

  const value: GatewayContextState = {
    rpc: mockRpc,
    status: "connected",
    error: null,
    isHalted: false,
  };

  return ({ children }: { children: React.ReactNode }) => (
    <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>
  );
}

const resolvedModels = () => Promise.resolve({ models: MODELS });
const emptyModels = () => Promise.resolve({ models: [] });
const failedCall = () => Promise.reject(new Error("RPC unavailable"));

describe("ModelSelector", () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading indicator while models are fetching", () => {
    let resolve!: (v: unknown) => void;
    const pending = new Promise((r) => {
      resolve = r;
    });
    const wrapper = makeWrapper(() => pending);
    render(<ModelSelector onSelect={onSelect} />, { wrapper });
    expect(screen.getByRole("status")).toBeDefined();
    resolve({ models: [] });
  });

  it("renders all models after successful load", async () => {
    const wrapper = makeWrapper(resolvedModels);
    render(<ModelSelector onSelect={onSelect} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText("GPT-4o")).toBeDefined();
      expect(screen.getByText("Claude 3.5 Sonnet")).toBeDefined();
      expect(screen.getByText("Gemini 1.5 Pro")).toBeDefined();
    });
  });

  it("shows empty state when no models are returned", async () => {
    const wrapper = makeWrapper(emptyModels);
    render(<ModelSelector onSelect={onSelect} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText(/no models/i)).toBeDefined();
    });
  });

  it("shows error state when RPC call fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const wrapper = makeWrapper(failedCall);
    render(<ModelSelector onSelect={onSelect} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
    });
    consoleSpy.mockRestore();
  });

  it("filters models by name when search text entered", async () => {
    const wrapper = makeWrapper(resolvedModels);
    render(<ModelSelector onSelect={onSelect} />, { wrapper });
    await waitFor(() => expect(screen.getByText("GPT-4o")).toBeDefined());

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "claude" } });

    expect(screen.queryByText("GPT-4o")).toBeNull();
    expect(screen.getByText("Claude 3.5 Sonnet")).toBeDefined();
    expect(screen.queryByText("Gemini 1.5 Pro")).toBeNull();
  });

  it("shows empty state when filter matches nothing", async () => {
    const wrapper = makeWrapper(resolvedModels);
    render(<ModelSelector onSelect={onSelect} />, { wrapper });
    await waitFor(() => expect(screen.getByText("GPT-4o")).toBeDefined());

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz-no-match" } });

    expect(screen.getByText(/no models/i)).toBeDefined();
  });

  it("calls onSelect with the model entry when clicked", async () => {
    const wrapper = makeWrapper(resolvedModels);
    render(<ModelSelector onSelect={onSelect} />, { wrapper });
    await waitFor(() => expect(screen.getByText("GPT-4o")).toBeDefined());

    fireEvent.click(screen.getByText("GPT-4o").closest("button")!);
    expect(onSelect).toHaveBeenCalledWith(MODELS[0]);
  });

  it("marks the pre-selected model as selected", async () => {
    const wrapper = makeWrapper(resolvedModels);
    render(<ModelSelector onSelect={onSelect} value="gpt-4o" />, { wrapper });
    await waitFor(() => expect(screen.getByText("GPT-4o")).toBeDefined());

    const btn = screen.getByText("GPT-4o").closest("button");
    expect(btn?.getAttribute("aria-pressed")).toBe("true");
  });
});
