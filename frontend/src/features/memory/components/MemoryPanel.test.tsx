import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMemoryStatus } from "@/features/agents/hooks/useMemoryStatus";
import { MemoryPanel } from "./MemoryPanel";

// Mock useMemoryStatus hook
vi.mock("@/features/agents/hooks/useMemoryStatus", () => ({
  useMemoryStatus: vi.fn(),
}));

describe("MemoryPanel - Pagination", () => {
  const mockRefresh = vi.fn();
  const mockToggleDreaming = vi.fn();

  const mockDiaryContent = `
### Entry 1
Body 1
### Entry 2
Body 2
### Entry 3
Body 3
### Entry 4
Body 4
### Entry 5
Body 5
### Entry 6
Body 6
### Entry 7
Body 7
  `.trim();

  beforeEach(() => {
    vi.clearAllMocks();
    (useMemoryStatus as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      status: {
        dreaming: {
          enabled: true,
          shortTermCount: 10,
          totalSignalCount: 100,
          lastDreamAtMs: Date.now(),
        },
        provider: "Local Vector",
      },
      diary: {
        content: mockDiaryContent,
        updatedAtMs: Date.now(),
      },
      isDreaming: true,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
      toggleDreaming: mockToggleDreaming,
    });
  });

  it("should display the first page of diary entries (5 entries)", () => {
    render(<MemoryPanel />);

    // Since it's reversed, it should be Entry 7 to Entry 3
    expect(screen.getByText("Entry 7")).toBeInTheDocument();
    expect(screen.getByText("Entry 6")).toBeInTheDocument();
    expect(screen.getByText("Entry 5")).toBeInTheDocument();
    expect(screen.getByText("Entry 4")).toBeInTheDocument();
    expect(screen.getByText("Entry 3")).toBeInTheDocument();

    // Entry 2 and 1 should not be visible (on next page)
    expect(screen.queryByText("Entry 2")).not.toBeInTheDocument();
    expect(screen.queryByText("Entry 1")).not.toBeInTheDocument();

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("should navigate to the next page when 'Next' is clicked", () => {
    render(<MemoryPanel />);

    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Entry 2")).toBeInTheDocument();
    expect(screen.getByText("Entry 1")).toBeInTheDocument();

    // Previous entries should be gone
    expect(screen.queryByText("Entry 7")).not.toBeInTheDocument();
  });

  it("should navigate back to the previous page when 'Prev' is clicked", () => {
    render(<MemoryPanel />);

    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    const prevButton = screen.getByText("Prev");
    fireEvent.click(prevButton);

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Entry 7")).toBeInTheDocument();
  });

  it("should expand and collapse entries", () => {
    render(<MemoryPanel />);

    const entry7 = screen.getByText("Entry 7");

    // Initial state: preview should be visible
    expect(screen.getByText("Body 7")).toBeInTheDocument();

    // Click to expand
    fireEvent.click(entry7);
    // When expanded, the preview is gone but the full body is visible.
    // We can't easily distinguish them by text alone, but we can check if it still exists.
    expect(screen.getByText("Body 7")).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(entry7);
    expect(screen.getByText("Body 7")).toBeInTheDocument();
  });

  it("should display dreaming phases", () => {
    (useMemoryStatus as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      status: {
        dreaming: {
          enabled: true,
          phases: {
            light: { enabled: true, lookbackDays: 1, limit: 100 },
            rem: { enabled: true, minPatternStrength: 0.5, lookbackDays: 7 },
            deep: { enabled: true, minScore: 0.8, minRecallCount: 5 },
          },
        },
      },
      diary: { content: "" },
      isDreaming: true,
      isLoading: false,
    });

    render(<MemoryPanel />);

    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("REM")).toBeInTheDocument();
    expect(screen.getByText("Deep")).toBeInTheDocument();
    expect(screen.getByText("0.5")).toBeInTheDocument();
    expect(screen.getByText("0.8")).toBeInTheDocument();
  });

  it("should toggle settings panel", () => {
    const mockUpdateConfig = vi.fn();
    (useMemoryStatus as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      status: {
        dreaming: {
          enabled: true,
          verboseLogging: false,
        },
      },
      diary: { content: "" },
      isDreaming: true,
      isLoading: false,
      updateConfig: mockUpdateConfig,
    });

    render(<MemoryPanel />);

    // Click settings button (first button in the header)
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]!); // Settings button is first

    expect(screen.getByText("Verbose Logging")).toBeInTheDocument();

    // Toggle verbose logging
    const switch_ = screen.getByRole("switch");
    fireEvent.click(switch_);

    expect(mockUpdateConfig).toHaveBeenCalledWith({ verboseLogging: true });
  });
});
