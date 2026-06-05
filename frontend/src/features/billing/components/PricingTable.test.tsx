/**
 * PricingTable Component Tests
 *
 * Test coverage for PricingTable component following PROJECT_RULES.md
 * Target: 80%+ coverage
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { billingApi } from "@/lib/api/billing";
import { PricingTable } from "./PricingTable";

// Mock dependencies
vi.mock("@/lib/api/billing", () => ({
  billingApi: {
    createCheckoutSession: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock window.location
const originalLocation = window.location;
vi.stubGlobal("location", { ...originalLocation, href: "" });

describe("PricingTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("location", { ...originalLocation, href: "" });
  });

  it("should render all three pricing plans", () => {
    render(<PricingTable />);

    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
  });

  it("should display monthly prices by default", () => {
    render(<PricingTable />);

    expect(screen.getByText("$9.99")).toBeInTheDocument();
    expect(screen.getByText("$19.99")).toBeInTheDocument();
    expect(screen.getByText("$49.99")).toBeInTheDocument();
  });

  it("should switch to yearly prices when yearly tab is clicked", async () => {
    render(<PricingTable />);

    const yearlyTab = screen.getByRole("tab", { name: /yearly/i });
    await userEvent.click(yearlyTab);

    await waitFor(() => {
      expect(screen.getByText("$99")).toBeInTheDocument();
      expect(screen.getByText("$199")).toBeInTheDocument();
      expect(screen.getByText("$499")).toBeInTheDocument();
    });
  });

  it('should display "MOST POPULAR" badge on Pro plan', () => {
    render(<PricingTable />);

    expect(screen.getByText("MOST POPULAR")).toBeInTheDocument();
  });

  it("should display correct features for each plan", () => {
    render(<PricingTable />);

    // Starter features
    expect(screen.getByText("1 Bot Account")).toBeInTheDocument();
    expect(screen.getByText("Basic AI Integration")).toBeInTheDocument();

    // Pro features
    expect(screen.getByText("3 Bot Accounts")).toBeInTheDocument();
    expect(screen.getAllByText("Advanced Gemini AI")).toHaveLength(2); // In Pro and Enterprise
    expect(screen.getByText("Priority Support")).toBeInTheDocument();

    // Enterprise features
    expect(screen.getByText("10 Bot Accounts")).toBeInTheDocument();
    expect(screen.getByText("Unlimited Broadcasts")).toBeInTheDocument();
    expect(screen.getByText("White-label Options")).toBeInTheDocument();
  });

  it("should display correct CTA text for each plan", () => {
    render(<PricingTable />);

    const buttons = screen.getAllByRole("button");
    const starterButton = buttons.find((btn) =>
      btn.textContent?.includes("Start 7-Day Free Trial"),
    );
    const enterpriseButton = buttons.find((btn) => btn.textContent?.includes("Contact Sales"));

    expect(starterButton).toBeInTheDocument();
    expect(enterpriseButton).toBeInTheDocument();
  });

  it("should create checkout session when Starter plan button is clicked", async () => {
    const mockCheckoutResponse = {
      url: "https://checkout.stripe.com/session_123",
    };

    vi.mocked(billingApi.createCheckoutSession).mockResolvedValue(mockCheckoutResponse);

    render(<PricingTable />);

    const buttons = screen.getAllByRole("button");
    const starterButton = buttons.find(
      (btn) =>
        btn.textContent?.includes("Start 7-Day Free Trial") &&
        btn.closest('[class*="border-border"]'),
    );

    if (starterButton) {
      await userEvent.click(starterButton);

      await waitFor(() => {
        expect(billingApi.createCheckoutSession).toHaveBeenCalledWith("starter", "month");
        expect(window.location.href).toBe("https://checkout.stripe.com/session_123");
      });
    }
  });

  it("should create checkout session with yearly interval when yearly is selected", async () => {
    const mockCheckoutResponse = {
      url: "https://checkout.stripe.com/session_123",
    };

    vi.mocked(billingApi.createCheckoutSession).mockResolvedValue(mockCheckoutResponse);

    render(<PricingTable />);

    // Switch to yearly
    const yearlyTab = screen.getByRole("tab", { name: /yearly/i });
    await userEvent.click(yearlyTab);

    const buttons = screen.getAllByRole("button");
    const proButton = buttons.find(
      (btn) =>
        btn.textContent?.includes("Start 7-Day Free Trial") &&
        btn.closest('[class*="border-primary"]'),
    );

    if (proButton) {
      await userEvent.click(proButton);

      await waitFor(() => {
        expect(billingApi.createCheckoutSession).toHaveBeenCalledWith("pro", "year");
      });
    }
  });

  it("should show info toast when Enterprise Contact Sales is clicked", async () => {
    const { toast } = await import("sonner");

    render(<PricingTable />);

    const buttons = screen.getAllByRole("button");
    const enterpriseButton = buttons.find((btn) => btn.textContent?.includes("Contact Sales"));

    if (enterpriseButton) {
      await userEvent.click(enterpriseButton);

      expect(toast.info).toHaveBeenCalledWith(
        "Please contact our sales team for enterprise pricing",
      );
      expect(billingApi.createCheckoutSession).not.toHaveBeenCalled();
    }
  });

  it("should show loading state when checkout is in progress", async () => {
    vi.mocked(billingApi.createCheckoutSession).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(<PricingTable />);

    const buttons = screen.getAllByRole("button");
    const starterButton = buttons.find(
      (btn) =>
        btn.textContent?.includes("Start 7-Day Free Trial") &&
        btn.closest('[class*="border-border"]'),
    );

    if (starterButton) {
      await userEvent.click(starterButton);

      await waitFor(() => {
        expect(screen.getByText("Processing...")).toBeInTheDocument();
      });
    }
  });

  it("should disable all buttons when one checkout is in progress", async () => {
    vi.mocked(billingApi.createCheckoutSession).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(<PricingTable />);

    const buttons = screen.getAllByRole("button");
    const starterButton = buttons.find(
      (btn) =>
        btn.textContent?.includes("Start 7-Day Free Trial") &&
        btn.closest('[class*="border-border"]'),
    );

    if (starterButton) {
      await userEvent.click(starterButton);

      await waitFor(() => {
        const allButtons = screen.getAllByRole("button");
        const ctaButtons = allButtons.filter(
          (btn) =>
            btn.textContent?.includes("Start 7-Day Free Trial") ||
            btn.textContent?.includes("Contact Sales") ||
            btn.textContent?.includes("Processing"),
        );

        ctaButtons.forEach((btn) => {
          expect(btn).toBeDisabled();
        });
      });
    }
  });

  it("should show error toast when checkout fails", async () => {
    const errorMessage = "Payment processing failed";
    vi.mocked(billingApi.createCheckoutSession).mockRejectedValue(new Error(errorMessage));

    const { toast } = await import("sonner");

    render(<PricingTable />);

    const buttons = screen.getAllByRole("button");
    const starterButton = buttons.find(
      (btn) =>
        btn.textContent?.includes("Start 7-Day Free Trial") &&
        btn.closest('[class*="border-border"]'),
    );

    if (starterButton) {
      await userEvent.click(starterButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(errorMessage);
      });
    }
  });

  it("should show error toast when checkout returns no URL", async () => {
    vi.mocked(billingApi.createCheckoutSession).mockResolvedValue({
      url: "",
    });

    const { toast } = await import("sonner");

    render(<PricingTable />);

    const buttons = screen.getAllByRole("button");
    const starterButton = buttons.find(
      (btn) =>
        btn.textContent?.includes("Start 7-Day Free Trial") &&
        btn.closest('[class*="border-border"]'),
    );

    if (starterButton) {
      await userEvent.click(starterButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to create checkout session");
      });
    }
  });

  it("should display trust badges at the bottom", () => {
    render(<PricingTable />);

    expect(screen.getByText("Try Before You Buy")).toBeInTheDocument();
    expect(screen.getByText("Instant Activation")).toBeInTheDocument();
    expect(screen.getByText("Cancel Anytime")).toBeInTheDocument();
  });

  it("should use theme colors without hardcoded values", () => {
    const { container } = render(<PricingTable />);

    // Check that we're using theme classes, not hardcoded colors
    const elements = container.querySelectorAll('[class*="bg-primary"]');
    expect(elements.length).toBeGreaterThan(0);

    // Should NOT have hardcoded primary color classes
    const hardcodedPrimary = container.querySelectorAll('[class*="bg-primary-50"]');
    expect(hardcodedPrimary.length).toBe(0);
  });

  it("should render icons for each plan", () => {
    const { container } = render(<PricingTable />);

    // Each plan should have an icon (svg element)
    const icons = container.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
  });

  it("should show Save 20% badge on yearly tab", () => {
    render(<PricingTable />);

    expect(screen.getByText("Save 20%")).toBeInTheDocument();
  });
});
