import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAgentsCrud } from "@/features/agents/hooks/useAgentsCrud";
import { useAuthorityStore } from "@/stores/useAuthorityStore";
import { useOmnichannelStore } from "@/stores/useOmnichannelStore";
import { AgentsDashboard } from "./AgentsDashboard";

// Mock stores and hooks
vi.mock("@/stores/useOmnichannelStore", () => ({
  useOmnichannelStore: vi.fn(),
}));

vi.mock("@/stores/useAuthorityStore", () => ({
  useAuthorityStore: vi.fn(),
}));

vi.mock("@/features/agents/hooks/useAgentsCrud", () => ({
  useAgentsCrud: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    promise: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock components that might be problematic or not needed for this test
vi.mock("./AgentFilesFeature", () => ({ AgentFilesFeature: () => <div>AgentFilesFeature</div> }));
vi.mock("./AgentIdentityFeature", () => ({
  AgentIdentityFeature: () => <div>AgentIdentityFeature</div>,
}));
vi.mock("./ChannelLinker", () => ({ ChannelLinker: () => <div>ChannelLinker</div> }));
vi.mock("./LiveStatusBadge", () => ({ LiveStatusBadge: () => <div>LiveStatusBadge</div> }));
vi.mock("./RecursiveTraceView", () => ({
  RecursiveTraceView: () => <div>RecursiveTraceView</div>,
}));
vi.mock("./SkillToggle", () => ({ SkillToggle: () => <div>SkillToggle</div> }));
vi.mock("./TemplateSelector", () => ({
  TemplateSelector: ({ onSelect }: any) => (
    <button
      onClick={() => onSelect({ title: "Test Template", iconName: "bot", suggestedModel: "gpt-4" })}
    >
      Select Template
    </button>
  ),
}));
vi.mock("@/features/memory", () => ({ MemoryPanel: () => <div>MemoryPanel</div> }));

describe("AgentsDashboard - agent.wait wiring", () => {
  const mockFetchAgents = vi.fn();
  const mockFetchUsageTotals = vi.fn();
  const mockCreateAgent = vi.fn();
  const mockWaitAndRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useOmnichannelStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      agentsResult: { agents: [] },
      agentIdentities: {},
      usageTotals: {},
      fetchAgents: mockFetchAgents,
      fetchAgentIdentity: vi.fn(),
      fetchUsageTotals: mockFetchUsageTotals,
    });

    (useAuthorityStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      tier: "pro",
      getLimit: vi.fn().mockReturnValue(5),
    });

    (useAgentsCrud as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      createAgent: mockCreateAgent,
      waitAndRefresh: mockWaitAndRefresh,
      isLoading: false,
    });
  });

  it("should call waitAndRefresh if runId is returned from createAgent", async () => {
    mockCreateAgent.mockResolvedValue({
      success: true,
      data: { id: "agent-123", runId: "run-456" },
    });
    mockWaitAndRefresh.mockResolvedValue(true);

    render(<AgentsDashboard />);

    // Open create dialog
    fireEvent.click(screen.getByText("Create Agent"));

    // Select template (triggers handleCreateAgent)
    fireEvent.click(screen.getByText("Select Template"));

    await waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockWaitAndRefresh).toHaveBeenCalledWith("run-456");
    });

    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining("Waiting for startup"),
      expect.any(Object),
    );
  });

  it("should not call waitAndRefresh if runId is missing", async () => {
    mockCreateAgent.mockResolvedValue({
      success: true,
      data: { id: "agent-123" },
    });

    render(<AgentsDashboard />);

    fireEvent.click(screen.getByText("Create Agent"));
    fireEvent.click(screen.getByText("Select Template"));

    await waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalled();
    });

    expect(mockWaitAndRefresh).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalledWith(
      expect.stringContaining("Waiting for startup"),
      expect.any(Object),
    );
  });
});
