import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommandPalette } from "./CommandPalette";
import { useOmnichannelStore } from "@/stores/useOmnichannelStore";

// Mock the store
vi.mock("@/stores/useOmnichannelStore", () => ({
  useOmnichannelStore: vi.fn(),
}));

describe("CommandPalette", () => {
  const mockFetchCommands = vi.fn();
  const mockCommands = [
    { name: "ping", description: "Ping the bot", category: "Utility" },
    { name: "help", description: "Show help", category: "General" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useOmnichannelStore as any).mockReturnValue({
      commands: mockCommands,
      fetchCommands: mockFetchCommands,
    });
  });

  it("opens when Cmd+K is pressed", async () => {
    render(<CommandPalette />);
    
    // Should be closed by default
    expect(screen.queryByRole("dialog")).toBeNull();

    // Trigger Cmd+K
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined();
    }, { timeout: 2000 });
  });

  it("renders command list and allows fuzzy matching", async () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });

    await waitFor(() => {
      expect(screen.getAllByText(/ping/i)[0]).toBeDefined();
    }, { timeout: 2000 });

    const input = screen.getByPlaceholderText(/Type a command/i);
    fireEvent.change(input, { target: { value: "pi" } });

    expect(screen.getAllByText(/ping/i)[0]).toBeDefined();
    expect(screen.queryByText(/help/i)).toBeNull();
  });
});
