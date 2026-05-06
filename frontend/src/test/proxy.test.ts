import { NextRequest, NextResponse } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { proxy } from "../proxy";

// Mock NextResponse
vi.mock("next/server", async () => {
  const actual = await vi.importActual("next/server");
  return {
    ...(actual as object),
    NextResponse: {
      redirect: vi.fn((url) => ({
        status: 307,
        headers: { get: () => url.toString() },
        url: url.toString(),
        type: "redirect",
      })),
      next: vi.fn(() => ({ status: 200, type: "next" })),
    },
  };
});

describe("Proxy Authentication Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (pathname: string, token?: string): NextRequest => {
    const url = new URL(`http://localhost:3000${pathname}`);
    return {
      nextUrl: { pathname, url: url.toString() },
      url: url.toString(),
      cookies: {
        get: vi.fn((name: string) => (name === "token" && token ? { value: token } : undefined)),
      },
    } as unknown as NextRequest;
  };

  it("should redirect unauthenticated users from /dashboard to /login", () => {
    const req = createRequest("/dashboard");
    void proxy(req);

    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0]![0] as URL;
    expect(redirectUrl.pathname).toBe("/login");
    expect(redirectUrl.searchParams.get("from")).toBe("/dashboard");
  });

  it("should redirect authenticated users from /login to /dashboard", () => {
    const req = createRequest("/login", "valid-token");
    void proxy(req);

    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectUrl = vi.mocked(NextResponse.redirect).mock.calls[0]![0] as URL;
    expect(redirectUrl.pathname).toBe("/dashboard");
  });

  it("should allow access to public routes without a token", () => {
    const req = createRequest("/");
    void proxy(req);

    expect(NextResponse.next).toHaveBeenCalled();
  });

  it("should allow access to /dashboard with a valid token", () => {
    const req = createRequest("/dashboard", "valid-token");
    void proxy(req);

    // In the current proxy implementation, if it's a protected route AND has a token,
    // it doesn't match the redirect condition and falls through to next()
    expect(NextResponse.next).toHaveBeenCalled();
  });
});
