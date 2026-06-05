import { renderHook, act } from "@testing-library/react";
import { useRouter, usePathname } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useAuthStore } from "../store";
import { useAuth } from "./useAuth";

// Mock stores
vi.mock("../store", () => {
  const mockStore = vi.fn();
  (mockStore as any).getState = vi.fn();
  return {
    useAuthStore: mockStore,
  };
});

// Mock navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

// Mock API
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  API_ENDPOINTS: {
    AUTH: {
      VERIFY: "/api/auth/verify",
      REFRESH: "/api/auth/refresh",
    },
  },
}));

vi.mock("@/lib/firebase/client", () => ({
  getClientAuth: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("useAuth hook", () => {
  const mockRouter = { push: vi.fn(), refresh: vi.fn() };
  const mockSetUser = vi.fn();
  const mockSetLoading = vi.fn();
  const mockSetLastFetchAttempt = vi.fn();
  const mockIncrementRetryCount = vi.fn();
  const mockResetRetryCount = vi.fn();
  const mockUser = { id: "user_1", email: "test@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue(mockRouter as unknown as ReturnType<typeof useRouter>);
    vi.mocked(usePathname).mockReturnValue("/dashboard");

    const storeState = {
      user: null,
      isLoading: false,
      isAuthenticated: false,
      retryCount: 0,
      lastFetchAttempt: 0,
      setUser: mockSetUser,
      setLoading: mockSetLoading,
      setLastFetchAttempt: mockSetLastFetchAttempt,
      incrementRetryCount: mockIncrementRetryCount,
      resetRetryCount: mockResetRetryCount,
    };

    vi.mocked(useAuthStore).mockReturnValue(storeState);
    vi.mocked((useAuthStore as any).getState).mockReturnValue(storeState);
  });

  it("should trigger verifySession on mount if no user", async () => {
    vi.mocked(api.get).mockResolvedValue({ success: true, data: mockUser });

    renderHook(() => useAuth());

    expect(mockSetLoading).toHaveBeenCalledWith(true);
    await act(async () => {
      // Wait for verifySession promise
    });
    expect(mockSetUser).toHaveBeenCalledWith(mockUser);
  });

  it("should redirect to login if session is invalid and not on auth page", async () => {
    // Mock state: finished loading, no user
    vi.mocked(useAuthStore).mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      retryCount: 0,
      lastFetchAttempt: 0,
      setUser: mockSetUser,
      setLoading: mockSetLoading,
      setLastFetchAttempt: mockSetLastFetchAttempt,
      incrementRetryCount: mockIncrementRetryCount,
      resetRetryCount: mockResetRetryCount,
    });
    vi.mocked(usePathname).mockReturnValue("/dashboard");

    renderHook(() => useAuth());

    // Redirection happens in useEffect
    expect(mockRouter.push).toHaveBeenCalledWith(ROUTES.LOGIN);
  });

  it("should NOT redirect if on login page", async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      retryCount: 0,
      lastFetchAttempt: 0,
      setUser: mockSetUser,
      setLoading: mockSetLoading,
      setLastFetchAttempt: mockSetLastFetchAttempt,
      incrementRetryCount: mockIncrementRetryCount,
      resetRetryCount: mockResetRetryCount,
    });
    vi.mocked(usePathname).mockReturnValue(ROUTES.LOGIN);

    renderHook(() => useAuth());

    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("should NOT trigger verifySession if on login page", async () => {
    vi.mocked(usePathname).mockReturnValue(ROUTES.LOGIN);
    vi.mocked(api.get).mockResolvedValue({ success: true, data: mockUser });

    renderHook(() => useAuth());

    // verifySession should not be called, so setLoading(true) should not happen
    expect(mockSetLoading).not.toHaveBeenCalledWith(true);
  });
});
