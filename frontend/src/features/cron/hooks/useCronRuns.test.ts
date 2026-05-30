import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useOmnichannelStore } from "@/stores/useOmnichannelStore";
import { useCronRuns } from "./useCronRuns";

// Mock the store
vi.mock("@/stores/useOmnichannelStore", () => ({
  useOmnichannelStore: vi.fn(),
}));

describe("useCronRuns", () => {
  const mockFetchCronRuns = vi.fn();
  const mockCronRuns = {
    "job-1": [
      { ts: Date.now(), status: "ok", durationMs: 100 },
      { ts: Date.now() - 1000, status: "error", error: "Failed" },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (useOmnichannelStore as any).mockReturnValue({
      cronRuns: mockCronRuns,
      fetchCronRuns: mockFetchCronRuns,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should fetch runs on mount", async () => {
    renderHook(() => useCronRuns("job-1"));
    expect(mockFetchCronRuns).toHaveBeenCalledWith("job-1");
  });

  it("should return runs for the specific jobId", () => {
    const { result } = renderHook(() => useCronRuns("job-1"));
    expect(result.current.runs).toEqual(mockCronRuns["job-1"]);
  });

  it("should poll for updates", async () => {
    renderHook(() => useCronRuns("job-1", { interval: 1000 }));

    expect(mockFetchCronRuns).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockFetchCronRuns).toHaveBeenCalledTimes(2);
  });

  it("should not fetch if disabled", () => {
    renderHook(() => useCronRuns("job-1", { enabled: false }));
    expect(mockFetchCronRuns).not.toHaveBeenCalled();
  });
});
