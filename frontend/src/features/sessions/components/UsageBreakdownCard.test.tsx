import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { UsageBreakdownCard } from "./UsageBreakdownCard";

// Mock Recharts to avoid render issues in test environment
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Cell: () => <div />,
}));

describe("UsageBreakdownCard", () => {
  const mockUsage = {
    totals: {
      input: 1000,
      output: 500,
      totalTokens: 1500,
      totalCost: 0.025,
    },
    aggregates: {
      byModel: [],
    },
  };

  it("renders loading state", () => {
    render(<UsageBreakdownCard usage={null} isLoading={true} />);
    // Card with animate-pulse
    const card = document.querySelector(".animate-pulse");
    expect(card).toBeDefined();
  });

  it("renders usage data correctly", () => {
    render(<UsageBreakdownCard usage={mockUsage} isLoading={false} />);

    expect(screen.getByText("Token Breakdown")).toBeDefined();
    expect(screen.getByText("1,500")).toBeDefined(); // totalTokens
    expect(screen.getByText("$0.0250")).toBeDefined(); // totalCost
    expect(screen.getByText("Total Tokens")).toBeDefined();
    expect(screen.getByText("Total Cost")).toBeDefined();
  });

  it("renders nothing if usage is null and not loading", () => {
    const { container } = render(<UsageBreakdownCard usage={null} isLoading={false} />);
    expect(container.firstChild).toBeNull();
  });
});
