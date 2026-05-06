/**
 * API Response Types
 *
 * Standard response shapes for API interactions.
 * All API responses follow The Result Pattern for type-safe error handling.
 */

/**
 * Successful API response
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
}

/**
 * Error API response
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    suggestion?: {
      message: string;
      linkLabel?: string;
      linkHref?: string;
    };
  };
}

/**
 * Union type for all API responses (The Result Pattern)
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Standard Result type for Server Actions (2026 Mastermind Edition)
 */
export type ActionResult<T = void> = ApiResponse<T>;

/**
 * Type guard for successful responses
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard for error responses
 */
export function isApiError<T>(response: ApiResponse<T>): response is ApiErrorResponse {
  return response.success === false;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Common filter parameters
 */
export interface FilterParams {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}
