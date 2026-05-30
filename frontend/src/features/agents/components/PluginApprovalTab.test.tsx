import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PluginApprovalTab } from "./PluginApprovalTab";
import { useSkillsStatus } from "../hooks/useSkillsStatus";

vi.mock("../hooks/useSkillsStatus", () => ({
  useSkillsStatus: vi.fn(),
}));

describe("PluginApprovalTab", () => {
  const mockResolvePluginApproval = vi.fn();

  const mockApprovals = [
    {
      id: "app:123",
      request: {
        title: "Access Filesystem",
        description: "Agent wants to read /etc/passwd",
        severity: "high",
        pluginId: "fs-plugin",
      },
      createdAtMs: Date.now() - 60000,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useSkillsStatus as any).mockReturnValue({
      pluginApprovals: mockApprovals,
      resolvePluginApproval: mockResolvePluginApproval,
      isLoading: false,
    });
  });

  it("renders pending approvals", () => {
    render(<PluginApprovalTab />);

    expect(screen.getByText(/Access Filesystem/i)).toBeDefined();
    expect(screen.getByText(/Agent wants to read \/etc\/passwd/i)).toBeDefined();
    expect(screen.getByText(/High Risk/i)).toBeDefined();
    expect(screen.getByText(/Plugin: fs-plugin/i)).toBeDefined();
  });

  it("calls resolvePluginApproval when decision buttons are clicked", async () => {
    mockResolvePluginApproval.mockResolvedValue(true);

    render(<PluginApprovalTab />);

    const allowAlwaysButton = screen.getByText(/Always/i);
    fireEvent.click(allowAlwaysButton);

    expect(mockResolvePluginApproval).toHaveBeenCalledWith("app:123", "allow-always");
    
    // Wait for resolvingId to be cleared (after promise resolves)
    await waitFor(() => {
      expect(allowAlwaysButton.closest("button")).not.toHaveProperty("disabled", true);
    });

    // Test Deny
    const denyButton = screen.getByText(/Deny/i);
    fireEvent.click(denyButton);
    expect(mockResolvePluginApproval).toHaveBeenCalledWith("app:123", "deny");
  });

  it("shows empty state when no approvals", () => {
    (useSkillsStatus as any).mockReturnValue({
      pluginApprovals: [],
      resolvePluginApproval: mockResolvePluginApproval,
      isLoading: false,
    });

    render(<PluginApprovalTab />);

    expect(screen.getByText(/No Pending Approvals/i)).toBeDefined();
  });
});
