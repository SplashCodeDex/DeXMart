import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBadge } from "./StatusBadge";
import type { StatusBadgeStatus } from "./StatusBadge";

const STATUSES: StatusBadgeStatus[] = ["online", "offline", "error", "connecting", "warning"];

describe("StatusBadge", () => {
  it.each(STATUSES)("renders without crashing for status=%s", (status) => {
    const { container } = render(<StatusBadge status={status} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("shows default label matching status when no label provided", () => {
    render(<StatusBadge status="online" />);
    expect(screen.getByText(/online/i)).toBeDefined();
  });

  it("shows custom label when provided", () => {
    render(<StatusBadge status="offline" label="Bot disconnected" />);
    expect(screen.getByText("Bot disconnected")).toBeDefined();
  });

  it("has aria-label for accessibility", () => {
    render(<StatusBadge status="error" />);
    const el = screen.getByRole("status");
    expect(el).toBeDefined();
  });

  it("applies a pulsing indicator for connecting status", () => {
    render(<StatusBadge status="connecting" />);
    const dot = document.querySelector("[data-status='connecting']");
    expect(dot).not.toBeNull();
  });

  it("applies online variant for online status", () => {
    render(<StatusBadge status="online" />);
    const dot = document.querySelector("[data-status='online']");
    expect(dot).not.toBeNull();
  });

  it("renders sm size without error", () => {
    const { container } = render(<StatusBadge status="online" size="sm" />);
    expect(container.firstChild).not.toBeNull();
  });
});
