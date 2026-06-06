/**
 * API Client
 *
 * Type-safe fetch wrapper implementation.
 * Designed to work seamlessly with HttpOnly cookies across Server and Client components.
 */

import { ROUTES } from "@/lib/constants/routes";
import { logger } from "@/lib/logger";
import type { ApiResponse, ApiSuccessResponse, ApiErrorResponse } from "@/types";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestConfig<TBody = unknown> {
  method?: HttpMethod;
  body?: TBody | undefined;
  headers?: Record<string, string>;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
  signal?: AbortSignal;
}

interface NextFetchRequestConfig {
  revalidate?: number | false;
  tags?: string[];
}

class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(message: string, code: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static fromResponse(response: ApiErrorResponse, status: number): ApiError {
    return new ApiError(
      response.error.message,
      response.error.code,
      status,
      response.error.details,
    );
  }
}

function createUrl(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const baseUrl =
    typeof window === "undefined"
      ? process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:3001"
      : "";

  const path = endpoint;
  const url = new URL(path, baseUrl || "http://dummy.com");

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return typeof window === "undefined" ? url.toString() : url.pathname + url.search;
}

async function getAuthHeader(): Promise<string | null> {
  if (typeof window !== "undefined") {
    return null;
  }

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get("token");
  return token?.value ?? null;
}

// --- Global Refresh State (Across all calls in one tab and across tabs) ---
let isRefreshing = false;
let isExternalRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

// Initialize cross-tab sync for the API client
if (typeof window !== "undefined") {
  const syncChannel = new BroadcastChannel("auth_sync");
  syncChannel.onmessage = (event) => {
    const { type, payload } = event.data;
    if (type === "REFRESHING") {
      isExternalRefreshing = true;
    } else if (type === "SESSION_REFRESHED" || type === "LOGOUT") {
      isExternalRefreshing = false;
      isRefreshing = false;
      processQueue(type === "SESSION_REFRESHED" ? payload?.token || "synced" : null);
    }
  };
}

function processQueue(token: string | null): void {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

const ERROR_SUGGESTIONS: Record<
  string,
  { message: string; linkLabel?: string; linkHref?: string }
> = {
  insufficient_permissions: {
    message: "This feature is not available on your current plan.",
    linkLabel: "Upgrade Plan",
    linkHref: "/dashboard/settings/billing",
  },
  http_403: {
    message: "Access Denied. You might need a higher permission level or a different subscription.",
    linkLabel: "View Plans",
    linkHref: "/dashboard/settings/billing",
  },
  rate_limit_exceeded: {
    message: "You have reached your request limit for this period.",
    linkLabel: "Upgrade for higher limits",
    linkHref: "/dashboard/settings/billing",
  },
  tenant_inactive: {
    message: "Your organization account is currently inactive.",
    linkLabel: "Manage Subscription",
    linkHref: "/dashboard/settings/billing",
  },
  auth_required: {
    message: "Your session has expired or is invalid.",
    linkLabel: "Login Again",
    linkHref: "/auth/login",
  },
};

async function apiClient<TData, TBody = unknown>(
  endpoint: string,
  config: RequestConfig<TBody> & { _retryDepth?: number } = {},
): Promise<ApiResponse<TData>> {
  const { method = "GET", body, headers = {}, cache, next, signal, _retryDepth = 0 } = config;

  const MAX_RETRY_DEPTH = 1;

  const url = createUrl(endpoint);
  const authToken = await getAuthHeader();

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (authToken) {
    requestHeaders["Authorization"] = `Bearer ${authToken}`;
  }

  const fetchOptions: RequestInit & { next?: NextFetchRequestConfig } = {
    method,
    headers: requestHeaders,
    credentials: "include",
  };

  if (body !== undefined) fetchOptions.body = JSON.stringify(body);
  if (cache !== undefined) fetchOptions.cache = cache;
  if (next !== undefined) fetchOptions.next = next;
  if (signal !== undefined) fetchOptions.signal = signal;

  try {
    const response = await fetch(url, fetchOptions);

    // --- 401 Interceptor Logic (Client Side Only) ---
    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      !endpoint.includes("/auth/refresh") &&
      !endpoint.includes("/auth/login")
    ) {
      if (_retryDepth >= MAX_RETRY_DEPTH) {
        logger.warn("Max retry depth reached for 401 retry loop");
        return {
          success: false,
          error: { code: "auth_required", message: "Session expired after retries" },
        } as ApiErrorResponse;
      }

      if (isRefreshing || isExternalRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((newToken) => {
            if (newToken) {
              resolve(
                apiClient<TData, TBody>(endpoint, { ...config, _retryDepth: _retryDepth + 1 }),
              );
            } else {
              resolve({
                success: false,
                error: { code: "auth_required", message: "Session expired" },
              } as ApiErrorResponse);
            }
          });
        });
      }

      isRefreshing = true;

      // Broadcast that this tab is starting the refresh
      const authChannel = new BroadcastChannel("auth_sync");
      authChannel.postMessage({ type: "REFRESHING" });
      authChannel.close();

      try {
        logger.debug("401 detected, attempting silent refresh...");
        const refreshResponse = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });

        if (refreshResponse.ok) {
          const result = await refreshResponse.json();
          const userData = result.data?.user;

          isRefreshing = false;
          processQueue("synced");

          if (typeof window !== "undefined") {
            const authChannel = new BroadcastChannel("auth_sync");
            authChannel.postMessage({
              type: "SESSION_REFRESHED",
              payload: { user: userData },
            });
            authChannel.close();
          }

          logger.info("Silent refresh successful, retrying original request");
          return apiClient<TData, TBody>(endpoint, { ...config, _retryDepth: _retryDepth + 1 });
        } else {
          isRefreshing = false;
          processQueue(null);

          if (typeof window !== "undefined") {
            const isAuthPage =
              window.location.pathname === ROUTES.LOGIN ||
              window.location.pathname === ROUTES.REGISTER;
            if (!isAuthPage) {
              const authChannel = new BroadcastChannel("auth_sync");
              authChannel.postMessage({ type: "LOGOUT" });
              authChannel.close();
            }
          }
        }
      } catch (refreshErr) {
        logger.error("Error during silent refresh:", refreshErr);
        isRefreshing = false;
        processQueue(null);

        if (typeof window !== "undefined") {
          const isAuthPage =
            window.location.pathname === ROUTES.LOGIN ||
            window.location.pathname === ROUTES.REGISTER;
          if (!isAuthPage) {
            const authChannel = new BroadcastChannel("auth_sync");
            authChannel.postMessage({ type: "LOGOUT" });
            authChannel.close();
          }
        }
      }
    }

    type ResponseBody = {
      data?: unknown;
      meta?: unknown;
      message?: string;
      error?: { code?: string; message?: string; details?: Record<string, unknown> } | string;
      details?: Record<string, unknown>;
    };

    let data: ResponseBody;
    const contentType = response.headers.get("content-type");

    if (contentType && contentType.includes("application/json")) {
      data = (await response.json()) as ResponseBody;
    } else {
      const text = await response.text();
      if (!response.ok) {
        return {
          success: false,
          error: {
            code: "server_error",
            message: text || `Server returned ${response.status}: ${response.statusText}`,
          },
        } as ApiErrorResponse;
      }
      data = { data: text };
    }

    if (!response.ok) {
      const errorObj = typeof data?.error === "object" ? data?.error : undefined;
      const code =
        errorObj?.code ??
        (typeof data?.error === "string" ? "legacy_error" : `http_${response.status}`);
      let message =
        errorObj?.message ?? (typeof data?.error === "string" ? data.error : (data?.message ?? ""));
      const details = errorObj?.details ?? data?.details;

      if (!message) {
        if (response.status === 401) message = "Authentication required. Please log in.";
        else if (response.status === 403)
          message = "Access Denied. You do not have the required permissions.";
        else if (response.status === 404) message = "The requested resource was not found.";
        else if (response.status >= 500)
          message = "A server error occurred. Please try again later.";
        else message = "An unexpected error occurred";
      }

      const suggestion = ERROR_SUGGESTIONS[code] || ERROR_SUGGESTIONS[`http_${response.status}`];

      return {
        success: false,
        error: { code, message, details, suggestion },
      } as ApiErrorResponse;
    }

    return {
      success: true,
      data: data.data ?? data,
      meta: data.meta,
    } as ApiSuccessResponse<TData>;
  } catch (err) {
    return handleApiError(err, endpoint, url);
  }
}

async function handleApiError(
  err: unknown,
  endpoint: string,
  url: string,
): Promise<ApiErrorResponse> {
  logger.error("[API Client Error]", { endpoint, url, error: err });

  if (err instanceof Error) {
    if (err.name === "AbortError") {
      return {
        success: false,
        error: { code: "request_aborted", message: "Request was cancelled" },
      };
    }
    return {
      success: false,
      error: {
        code: "network_error",
        message: err.message || "Unable to connect to server",
        details: { originalError: err.toString() },
      },
    };
  }
  return {
    success: false,
    error: {
      code: "unknown_error",
      message: "An unexpected error occurred during the request",
      details: { error: String(err) },
    },
  };
}

export const api = {
  get<TData>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    config?: RequestConfig,
  ) {
    const url = params
      ? createUrl(endpoint, params).replace(new URL(createUrl(endpoint)).origin, "")
      : endpoint;
    return apiClient<TData>(url, { ...config, method: "GET" });
  },
  post<TData, TBody = unknown>(endpoint: string, body?: TBody, config?: RequestConfig<TBody>) {
    return apiClient<TData, TBody>(endpoint, { ...config, method: "POST", body });
  },
  put<TData, TBody = unknown>(endpoint: string, body?: TBody, config?: RequestConfig<TBody>) {
    return apiClient<TData, TBody>(endpoint, { ...config, method: "PUT", body });
  },
  patch<TData, TBody = unknown>(endpoint: string, body?: TBody, config?: RequestConfig<TBody>) {
    return apiClient<TData, TBody>(endpoint, { ...config, method: "PATCH", body });
  },
  delete<TData>(endpoint: string, config?: RequestConfig) {
    return apiClient<TData>(endpoint, { ...config, method: "DELETE" });
  },
};
