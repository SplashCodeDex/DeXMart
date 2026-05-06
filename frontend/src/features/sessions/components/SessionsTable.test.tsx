import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useGateway } from "@/lib/gateway/gateway-hooks";
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

// Mock useGateway
vi.mock("@/lib/gateway/gateway-hooks", () => ({
  useGateway: vi.fn(),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock DropdownMenu components to render directly for easier testing
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: any) => (
    <div onClick={onClick} className={className} role="menuitem">
      {children}
    </div>
  ),
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
  const mockRpcCall = vi.fn();
  const mockRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: pushMock });
    (useGateway as any).mockReturnValue({ rpc: { call: mockRpcCall } });
    (useSessionsList as any).mockReturnValue({
      filteredSessions: mockSessions,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
    });
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
    render(<SessionsTable />);

    const firstRow = screen.getByText("Alpha Session").closest("tr");
    fireEvent.click(firstRow!);

    expect(pushMock).toHaveBeenCalledWith("/dashboard/sessions/session-1234567890123");
  });

  it("sorts sessions by label", () => {
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
    expect(rows[0]).toHaveTextContent("Zeta Session");
    expect(rows[1]).toHaveTextContent("Alpha Session");

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

  it("triggers delete action from dropdown menu", async () => {
    mockRpcCall.mockResolvedValue({ ok: true });
    render(<SessionsTable />);

    const deleteItem = screen.getAllByText("Delete Session")[0];
    fireEvent.click(deleteItem);

    expect(mockRpcCall).toHaveBeenCalledWith("sessions.delete", { key: mockSessions[1].sessionId });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Session deleted"));
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("triggers reset action from dropdown menu", async () => {
    mockRpcCall.mockResolvedValue({ ok: true });
    render(<SessionsTable />);

    const resetItem = screen.getAllByText("Reset Session")[0];
    fireEvent.click(resetItem);

    expect(mockRpcCall).toHaveBeenCalledWith("sessions.reset", { key: mockSessions[1].sessionId });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Session reset"));
  });

  it("triggers compact action from dropdown menu", async () => {
    mockRpcCall.mockResolvedValue({ compacted: true, result: { tokensAfter: 500 } });
    render(<SessionsTable />);

    const compactItem = screen.getAllByText("Compact Session")[0];
    fireEvent.click(compactItem);

    expect(mockRpcCall).toHaveBeenCalledWith("sessions.compact", {
      key: mockSessions[1].sessionId,
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Session compacted (500 tokens remaining)"),
    );
  });
});
