import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSkillsStatus } from "./useSkillsStatus";
import { useOmnichannelStore } from "@/stores/useOmnichannelStore";

// Mock the store
vi.mock("@/stores/useOmnichannelStore", () => ({
  useOmnichannelStore: vi.fn(),
}));

describe("useSkillsStatus hook", () => {
  const mockFetchSkillReport = vi.fn();
  const mockFetchSkills = vi.fn();
  const mockFetchPluginApprovals = vi.fn();
  const mockToggleSkill = vi.fn();
  const mockSaveSkillKey = vi.fn();
  const mockInstallSkill = vi.fn();
  const mockResolvePluginApproval = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useOmnichannelStore as any).mockReturnValue({
      skillReport: { skills: [] },
      skills: [],
      pluginApprovals: [],
      fetchSkillReport: mockFetchSkillReport,
      fetchSkills: mockFetchSkills,
      fetchPluginApprovals: mockFetchPluginApprovals,
      toggleSkill: mockToggleSkill,
      saveSkillKey: mockSaveSkillKey,
      installSkill: mockInstallSkill,
      resolvePluginApproval: mockResolvePluginApproval,
    });
  });

  it("should refresh data on mount", async () => {
    renderHook(() => useSkillsStatus());
    expect(mockFetchSkillReport).toHaveBeenCalled();
    expect(mockFetchSkills).toHaveBeenCalled();
    expect(mockFetchPluginApprovals).toHaveBeenCalled();
  });

  it("should call toggleSkill store action", async () => {
    const { result } = renderHook(() => useSkillsStatus());
    await result.current.toggleSkill("test-skill", true);
    expect(mockToggleSkill).toHaveBeenCalledWith("test-skill", true);
  });

  it("should call saveSkillKey store action", async () => {
    const { result } = renderHook(() => useSkillsStatus());
    await result.current.saveSkillKey("test-skill", "key-123");
    expect(mockSaveSkillKey).toHaveBeenCalledWith("test-skill", "key-123");
  });

  it("should call installSkill store action", async () => {
    const { result } = renderHook(() => useSkillsStatus());
    await result.current.installSkill("test-skill", "pnpm");
    expect(mockInstallSkill).toHaveBeenCalledWith("test-skill", "pnpm");
  });
});
