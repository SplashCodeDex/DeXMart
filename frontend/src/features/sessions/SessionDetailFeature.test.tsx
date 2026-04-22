import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useGateway } from "@/lib/gateway/gateway-hooks";
import { SessionDetailFeature } from "./SessionDetailFeature";
import { useSessionDetail } from "./hooks/useSessionDetail";
import { useCompaction } from "./hooks/useCompaction";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

// Mock hooks
vi.mock("./hooks/useSessionDetail", () => ({
  useSessionDetail: vi.fn(),
}));

vi.mock("./hooks/useCompaction", () => ({
  useCompaction: vi.fn(),
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
  },
}));

// Mock DropdownMenu components
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: any) => (
    <div onClick={onClick} className={className} role="menuitem">{children}</div>
  ),
}));

// Mock shared components
vi.mock("@/components/shared/ModelSelector", () => ({
  ModelSelector: ({ onSelect }: any) => (
    <button onClick={() => onSelect("new-model")}>Select GPT-4</button>
  ),
}));

vi.mock("@/components/shared/VirtualLogList", () => ({
  VirtualLogList: ({ items, renderItem }: any) => (
    <div data-testid="virtual-log-list">
      {items.map((item: any, i: number) => (
        <div key={i}>{renderItem(item, i)}</div>
      ))}
    </div>
  ),
}));

const mockSession = {
  sessionId: "session-123",
  label: "Test Session",
  channel: "whatsapp",
  model: "gpt-4",
  status: "running",
  totalTokens: 1000,
  estimatedCostUsd: 0.05,
  messages: [
    { role: "user", content: "Hello", timestamp: 1713780000000 },
    { role: "assistant", content: "Hi there!", timestamp: 1713780001000 },
  ],
};

const mockCheckpoints = [
  { id: "cp-1", updatedAt: 1713780000000, reason: "manual", tokenCount: 500, messageCount: 10, label: "Initial" },
];

describe("SessionDetailFeature", () => {
  const pushMock = vi.fn();
  const mockRpcCall = vi.fn();
  const mockRefreshSession = vi.fn();
  const mockRefreshCompaction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: pushMock });
    (useGateway as any).mockReturnValue({ rpc: { call: mockRpcCall } });
    (useSessionDetail as any).mockReturnValue({
      session: mockSession,
      isLoading: false,
      error: null,
      refresh: mockRefreshSession,
    });
    (useCompaction as any).mockReturnValue({
      checkpoints: mockCheckpoints,
      isLoading: false,
      error: null,
      refresh: mockRefreshCompaction,
    });
    
    // Stub window.confirm
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it("renders session details and transcript", () => {
    render(<SessionDetailFeature sessionId="session-123" />);

    expect(screen.getByText("Test Session")).toBeInTheDocument();
    expect(screen.getByText("whatsapp")).toBeInTheDocument();
    expect(screen.getByText("gpt-4")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("$0.0500")).toBeInTheDocument();
    
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
    expect(screen.getByText("Initial")).toBeInTheDocument();
  });

  it("triggers model override", async () => {
    render(<SessionDetailFeature sessionId="session-123" />);

    fireEvent.click(screen.getByText("gpt-4")); // Open model selector via button in header
    fireEvent.click(screen.getByText("Select GPT-4")); // Select new model

    expect(mockRpcCall).toHaveBeenCalledWith("sessions.patch", { 
      key: "session-123", 
      model: "new-model" 
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Session updated"));
  });

  it("triggers session delete", async () => {
    mockRpcCall.mockResolvedValue({ ok: true });
    render(<SessionDetailFeature sessionId="session-123" />);

    fireEvent.click(screen.getByText("Delete Session"));

    expect(mockRpcCall).toHaveBeenCalledWith("sessions.delete", { key: "session-123" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Session deleted"));
    expect(pushMock).toHaveBeenCalledWith("/dashboard/sessions");
  });
});
