import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CompactionPanel } from "./CompactionPanel";
import { useCompaction } from "../hooks/useCompaction";

// Mock the hook
vi.mock("../hooks/useCompaction", () => ({
  useCompaction: vi.fn(),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockCheckpoints = [
  { id: "cp-1", updatedAt: 1713780000000, reason: "manual", tokenCount: 500, messageCount: 10, label: "Initial" },
];

describe("CompactionPanel", () => {
  const mockRestore = vi.fn();
  const mockBranch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useCompaction as any).mockReturnValue({
      checkpoints: mockCheckpoints,
      isLoading: false,
      error: null,
      restore: mockRestore,
      branch: mockBranch,
    });
  });

  it("renders checkpoints timeline", () => {
    render(<CompactionPanel sessionId="session-123" />);

    expect(screen.getByText("Initial")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("manual")).toBeInTheDocument();
  });

  it("triggers restore dialog and action", async () => {
    render(<CompactionPanel sessionId="session-123" />);

    fireEvent.click(screen.getByText("Restore"));
    
    expect(screen.getByText(/overwrite the current session state/i)).toBeInTheDocument();
    
    fireEvent.click(screen.getByText("Confirm Restore"));
    
    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith("cp-1"));
    expect(toast.success).toHaveBeenCalledWith("Session restored to checkpoint");
  });

  it("triggers branch dialog and action", async () => {
    mockBranch.mockResolvedValue("new-session-id");
    render(<CompactionPanel sessionId="session-123" />);

    fireEvent.click(screen.getByText("Branch"));
    
    expect(screen.getByText(/Create a new session starting from this checkpoint/i)).toBeInTheDocument();
    
    const input = screen.getByPlaceholderPath ? screen.getByPlaceholderText("e.target.value") : screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "New Branch" } });
    
    fireEvent.click(screen.getByText("Create Branch"));
    
    await waitFor(() => expect(mockBranch).toHaveBeenCalledWith("cp-1", "New Branch"));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Branched to new session"));
  });
});
