import { describe, it, expect } from "vitest";
import { isApiSuccess, isApiError, type ApiResponse } from "./api";

describe("API Type Guards", () => {
  it("should correctly identify success responses", () => {
    const successResponse: ApiResponse<{ id: number }> = {
      success: true,
      data: { id: 1 },
    };

    expect(isApiSuccess(successResponse)).toBe(true);
    expect(isApiError(successResponse)).toBe(false);
  });

  it("should correctly identify error responses", () => {
    const errorResponse: ApiResponse<null> = {
      success: false,
      error: {
        code: "ERROR_CODE",
        message: "Something went wrong",
      },
    };

    expect(isApiSuccess(errorResponse)).toBe(false);
    expect(isApiError(errorResponse)).toBe(true);
  });
});
