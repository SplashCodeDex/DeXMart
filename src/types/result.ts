/**
 * Result Pattern
 * 
 * Prefer Results over Throws for better error handling
 */

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, 'BAD_REQUEST', 400, details);
  }

  static notFound(message: string): AppError {
    return new AppError(message, 'NOT_FOUND', 404);
  }

  static unauthorized(message: string): AppError {
    return new AppError(message, 'UNAUTHORIZED', 401);
  }

  static forbidden(message: string): AppError {
    return new AppError(message, 'FORBIDDEN', 403);
  }

  static internal(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, 'INTERNAL_ERROR', 500, details);
  }

  static serviceUnavailable(message: string): AppError {
    return new AppError(message, 'SERVICE_UNAVAILABLE', 503);
  }
}

/**
 * Helper to create success result
 */
export function success<T>(data: T): Result<T, AppError> {
  return { success: true, data };
}

/**
 * Helper to create error result
 */
export function failure<T>(error: AppError): Result<T, AppError> {
  return { success: false, error };
}
