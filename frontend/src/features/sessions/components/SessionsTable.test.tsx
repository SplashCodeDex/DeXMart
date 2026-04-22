import { render, screen, fireEvent } from "@testing-library/react";
import { useRouter } from "next/navigation";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSessionsList } from "../hooks/useSessionsList";
import { SessionsTable } from "./SessionsTable";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

// Mock the hook
vi.mock("../hooks/useSessionsList", () => ({
  useSessionsList: vi.fn(),
}));

const mockSessions = [
  {
    sessionId: "session-1234567890123",
    label: "Alpha Session",
    channel: "whatsapp",
    model: "gpt-4",
    updatedAt: 1713780000000, // Earlier
    status: "running",
  },
  {
    sessionId: "session-0987654321098",
    label: "Zeta Session",
    channel: "telegram",
    model: "claude-3",
    updatedAt: 1713783600000, // Later
    status: "done",
  },
];

describe("SessionsTable", () => {
  const pushMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: pushMock });
  });

  it("renders loading state", () => {
    (useSessionsList as any).mockReturnValue({
      filteredSessions: [],
      isLoading: true,
      error: null,
    });

    const { container } = render(<SessionsTable />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(5);
  });

  it("renders error state", () => {
    (useSessionsList as any).mockReturnValue({
      filteredSessions: [],
      isLoading: false,
      error: "Failed to load sessions",
    });

    render(<SessionsTable />);
    expect(screen.getByText("Failed to load sessions")).toBeInTheDocument();
  });

  it("renders sessions list", () => {
    (useSessionsList as any).mockReturnValue({
      filteredSessions: mockSessions,
      isLoading: false,
      error: null,
    });

    render(<SessionsTable />);

    expect(screen.getByText("Alpha Session")).toBeInTheDocument();
    expect(screen.getByText("Zeta Session")).toBeInTheDocument();
    expect(screen.getByText("whatsapp")).toBeInTheDocument();
    expect(screen.getByText("telegram")).toBeInTheDocument();
    expect(screen.getByText("gpt-4")).toBeInTheDocument();
    expect(screen.getByText("claude-3")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
  });

  it("navigates to session detail on row click", () => {
    (useSessionsList as any).mockReturnValue({
      filteredSessions: mockSessions,
      isLoading: false,
      error: null,
    });

    render(<SessionsTable />);

    const firstRow = screen.getByText("Alpha Session").closest("tr");
    fireEvent.click(firstRow!);

    expect(pushMock).toHaveBeenCalledWith("/dashboard/sessions/session-1234567890123");
  });

  it("sorts sessions by label", () => {
    (useSessionsList as any).mockReturnValue({
      filteredSessions: mockSessions,
      isLoading: false,
      error: null,
    });

    render(<SessionsTable />);

    const agentHeader = screen.getByText(/Agent/i);

    // Default sort is updatedAt desc
    let rows = screen.getAllByRole("row").slice(1); // skip header
    expect(rows[0]).toHaveTextContent("Zeta Session");
    expect(rows[1]).toHaveTextContent("Alpha Session");

    // Sort by Agent (label) asc
    fireEvent.click(agentHeader);
    rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Alpha Session");
    expect(rows[1]).toHaveTextContent("Zeta Session");
  });

  it("sorts sessions by startedAt (Created)", () => {
    (useSessionsList as any).mockReturnValue({
      filteredSessions: [
        { ...mockSessions[0], startedAt: 1000 },
        { ...mockSessions[1], startedAt: 2000 },
      ],
      isLoading: false,
      error: null,
    });

    render(<SessionsTable />);

    const createdHeader = screen.getByText("Created");

    // Default sort is updatedAt desc
    let rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Zeta Session"); // updatedAt 1713783600000
    expect(rows[1]).toHaveTextContent("Alpha Session"); // updatedAt 1713780000000

    // Sort by Created (startedAt) asc
    fireEvent.click(createdHeader);
    rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Alpha Session"); // startedAt 1000
    expect(rows[1]).toHaveTextContent("Zeta Session"); // startedAt 2000
  });

  it("displays empty state", () => {
    (useSessionsList as any).mockReturnValue({
      filteredSessions: [],
      isLoading: false,
      error: null,
    });

    render(<SessionsTable />);
    expect(screen.getByText("No sessions found.")).toBeInTheDocument();
  });
});
