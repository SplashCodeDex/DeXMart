import "server-only";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "static-placeholder-do-not-use-in-prod-7f9d8a2b",
);

export async function getSession(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token");
  return token?.value;
}

export async function requireAuth(): Promise<string> {
  const token = await getSession();

  if (!token) {
    redirect("/login");
  }

  try {
    // Robust JWT Verification
    await jwtVerify(token, JWT_SECRET);
    return token;
  } catch (error: unknown) {
    const jwtError = error as { code?: string };
    if (jwtError?.code === "ERR_JWT_EXPIRED") {
      // Token expired - redirect to login silently
    } else {
      // Token verification failed for another reason - redirect to login
      void error; // error info discarded intentionally; session is invalid regardless
    }
    // Redirect to login with the current path to return to
    // We use /login instead of /api/auth/logout to avoid extra hops,
    // but we assume proxy.ts will catch this and clear the cookie if invalid.
    const searchParams = new URLSearchParams();
    searchParams.set("from", "/dashboard"); // or get current path if possible, but dashboard is safe default
    redirect(`/login?${searchParams.toString()}`);
  }
}
