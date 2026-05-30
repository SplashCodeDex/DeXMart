import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SkillInstallDrawer } from "./SkillInstallDrawer";
import { useSkillsStatus } from "../hooks/useSkillsStatus";

// Mock the hook
vi.mock("../hooks/useSkillsStatus", () => ({
  useSkillsStatus: vi.fn(),
}));

describe("SkillInstallDrawer", () => {
  const mockInstallSkill = vi.fn();
  const mockOnOpenChange = vi.fn();

  const mockSkill = {
    name: "Test Skill",
    skillKey: "test-skill",
    description: "A test skill description",
    missing: { bins: ["git"] },
    requirements: {
      bins: ["git", "node"],
      env: ["API_KEY"],
      config: [],
      os: [],
    },
    install: [
      { id: "pnpm", label: "pnpm", method: "shell" },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useSkillsStatus as any).mockReturnValue({
      installSkill: mockInstallSkill,
    });
  });

  it("renders skill details correctly", () => {
    render(
      <SkillInstallDrawer
        skill={mockSkill}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    expect(screen.getByText(/Skill Details: Test Skill/i)).toBeDefined();
    expect(screen.getByText(/A test skill description/i)).toBeDefined();
    expect(screen.getByText(/git/i)).toBeDefined();
    expect(screen.getByText(/node/i)).toBeDefined();
    expect(screen.getByText(/API_KEY/i)).toBeDefined();
  });

  it("calls installSkill when install button is clicked", async () => {
    mockInstallSkill.mockResolvedValue(true);

    render(
      <SkillInstallDrawer
        skill={mockSkill}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    const installButton = screen.getByText(/Install via pnpm/i);
    fireEvent.click(installButton);

    expect(mockInstallSkill).toHaveBeenCalledWith("test-skill", "pnpm");
    
    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows progress indicator during installation", async () => {
    // We want to test that it shows a loading state
    let resolveInstall: (value: boolean) => void = () => {};
    const installPromise = new Promise<boolean>((resolve) => {
      resolveInstall = resolve;
    });
    mockInstallSkill.mockReturnValue(installPromise);

    render(
      <SkillInstallDrawer
        skill={mockSkill}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    const installButton = screen.getByText(/Install via pnpm/i);
    fireEvent.click(installButton);

    // Should show loader/spinner
    expect(document.querySelector(".animate-spin")).toBeDefined();
    
    // Should show progress bar (radix progress usually has role="progressbar")
    expect(screen.getByRole("progressbar")).toBeDefined();
    
    // Also check if button is disabled
    expect(installButton.closest("button")).toHaveProperty("disabled", true);

    resolveInstall(true);
    
    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
