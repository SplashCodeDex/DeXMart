/**
 * InvoiceHistory Component Tests
 *
 * Test coverage for InvoiceHistory component following PROJECT_RULES.md
 * Target: 80%+ coverage
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "@/lib/api";
import type { ApiSuccessResponse, ApiErrorResponse } from "@/types";
import type { Invoice } from "../schemas";
import { InvoiceHistory } from "./InvoiceHistory";

// Mock dependencies
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
  API_ENDPOINTS: {
    BILLING: {
      INVOICES: "/api/billing/invoices",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("InvoiceHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render loading state initially", () => {
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));

    render(<InvoiceHistory />);

    expect(screen.getByText("Invoice History")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invoice History" })).toBeInTheDocument();
  });

  it("should render empty state when no invoices exist", async () => {
    const emptyResponse: ApiSuccessResponse<Invoice[]> = {
      success: true,
      data: [],
    };

    vi.mocked(api.get).mockResolvedValue(emptyResponse);

    render(<InvoiceHistory />);

    await waitFor(() => {
      expect(screen.getByText("No invoices yet")).toBeInTheDocument();
    });

    expect(screen.getByText(/Your invoice history will appear here/)).toBeInTheDocument();
  });

  it("should render invoice list when data is loaded", async () => {
    const mockInvoices: Invoice[] = [
      {
        id: "inv_123",
        date: "2024-01-15T10:00:00.000Z",
        amount: 1999,
        status: "paid",
        invoiceUrl: "https://stripe.com/invoice/123",
        description: "Pro Plan - Monthly",
      },
      {
        id: "inv_124",
        date: "2024-02-15T10:00:00.000Z",
        amount: 1999,
        status: "pending",
        invoiceUrl: "https://stripe.com/invoice/124",
        description: "Pro Plan - Monthly",
      },
    ];

    const successResponse: ApiSuccessResponse<Invoice[]> = {
      success: true,
      data: mockInvoices,
    };

    vi.mocked(api.get).mockResolvedValue(successResponse);

    render(<InvoiceHistory />);

    await waitFor(() => {
      expect(screen.getAllByText("Pro Plan - Monthly")).toHaveLength(2);
    });

    expect(screen.getAllByText("$19.99")).toHaveLength(2);
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("should display correct status badges", async () => {
    const mockInvoices: Invoice[] = [
      {
        id: "inv_1",
        date: "2024-01-15T10:00:00.000Z",
        amount: 1999,
        status: "paid",
        invoiceUrl: "https://stripe.com/invoice/1",
        description: "Paid Invoice",
      },
      {
        id: "inv_2",
        date: "2024-01-16T10:00:00.000Z",
        amount: 1999,
        status: "pending",
        invoiceUrl: "https://stripe.com/invoice/2",
        description: "Pending Invoice",
      },
      {
        id: "inv_3",
        date: "2024-01-17T10:00:00.000Z",
        amount: 1999,
        status: "failed",
        invoiceUrl: "https://stripe.com/invoice/3",
        description: "Failed Invoice",
      },
    ];

    const successResponse: ApiSuccessResponse<Invoice[]> = {
      success: true,
      data: mockInvoices,
    };

    vi.mocked(api.get).mockResolvedValue(successResponse);

    render(<InvoiceHistory />);

    await waitFor(() => {
      expect(screen.getByText("Paid")).toBeInTheDocument();
      expect(screen.getByText("Pending")).toBeInTheDocument();
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });
  });

  it("should handle download button click", async () => {
    const mockInvoices: Invoice[] = [
      {
        id: "inv_123",
        date: "2024-01-15T10:00:00.000Z",
        amount: 1999,
        status: "paid",
        invoiceUrl: "https://stripe.com/invoice/123",
        description: "Test Invoice",
      },
    ];

    const successResponse: ApiSuccessResponse<Invoice[]> = {
      success: true,
      data: mockInvoices,
    };

    vi.mocked(api.get).mockResolvedValue(successResponse);

    // Mock window.open
    const mockOpen = vi.fn();
    vi.stubGlobal("open", mockOpen);

    render(<InvoiceHistory />);

    await waitFor(() => {
      expect(screen.getByText("Test Invoice")).toBeInTheDocument();
    });

    const downloadButton = screen.getByRole("button", { name: /download/i });
    await userEvent.click(downloadButton);

    expect(mockOpen).toHaveBeenCalledWith("https://stripe.com/invoice/123", "_blank");

    vi.unstubAllGlobals();
  });

  it("should handle API error with specific message", async () => {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Network connection failed",
      },
    };

    vi.mocked(api.get).mockResolvedValue(errorResponse);

    const { toast } = await import("sonner");

    render(<InvoiceHistory />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Network connection failed");
    });
  });

  it("should handle unknown error gracefully", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Unknown error"));

    const { toast } = await import("sonner");

    render(<InvoiceHistory />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("should validate invoice data with Zod schema", async () => {
    const invalidInvoices = [
      {
        id: "inv_123",
        date: "2024-01-15T10:00:00.000Z",
        amount: -100, // Invalid: negative amount
        status: "paid" as const,
        invoiceUrl: "https://stripe.com/invoice/123",
        description: "Test",
      },
    ];

    const invalidResponse: ApiSuccessResponse<Invoice[]> = {
      success: true,
      data: invalidInvoices,
    };

    vi.mocked(api.get).mockResolvedValue(invalidResponse);

    const { toast } = await import("sonner");

    render(<InvoiceHistory />);

    await waitFor(() => {
      // Should catch Zod validation error
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("should format amounts correctly", async () => {
    const mockInvoices: Invoice[] = [
      {
        id: "inv_1",
        date: "2024-01-15T10:00:00.000Z",
        amount: 1050, // $10.50
        status: "paid",
        invoiceUrl: "https://stripe.com/invoice/1",
        description: "Test",
      },
      {
        id: "inv_2",
        date: "2024-01-16T10:00:00.000Z",
        amount: 100000, // $1000.00
        status: "paid",
        invoiceUrl: "https://stripe.com/invoice/2",
        description: "Test",
      },
    ];

    const successResponse: ApiSuccessResponse<Invoice[]> = {
      success: true,
      data: mockInvoices,
    };

    vi.mocked(api.get).mockResolvedValue(successResponse);

    render(<InvoiceHistory />);

    await waitFor(() => {
      expect(screen.getByText("$10.50")).toBeInTheDocument();
      expect(screen.getByText("$1000.00")).toBeInTheDocument();
    });
  });

  it("should format dates correctly", async () => {
    const mockInvoices: Invoice[] = [
      {
        id: "inv_1",
        date: "2024-01-15T10:00:00.000Z",
        amount: 1999,
        status: "paid",
        invoiceUrl: "https://stripe.com/invoice/1",
        description: "Test",
      },
    ];

    const successResponse: ApiSuccessResponse<Invoice[]> = {
      success: true,
      data: mockInvoices,
    };

    vi.mocked(api.get).mockResolvedValue(successResponse);

    render(<InvoiceHistory />);

    await waitFor(() => {
      // Date should be formatted as "Jan 15, 2024"
      expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
    });
  });
});
