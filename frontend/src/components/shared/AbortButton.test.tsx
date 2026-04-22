import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AbortButton } from "./AbortButton";

describe("AbortButton", () => {
  const onAbort = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it("renders with default label", () => {
    render(<AbortButton onAbort={onAbort} />);
    expect(screen.getByRole("button")).toBeDefined();
    expect(screen.getByText(/abort/i)).toBeDefined();
  });

  it("calls onAbort when clicked", () => {
    render(<AbortButton onAbort={onAbort} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onAbort).toHaveBeenCalledOnce();
  });

  it("does not call onAbort when disabled", () => {
    render(<AbortButton onAbort={onAbort} disabled />);
    fireEvent.click(screen.getByRole("button"));
    expect(onAbort).not.toHaveBeenCalled();
  });

  it("shows aborting state when isAborting is true", () => {
    render(<AbortButton onAbort={onAbort} isAborting />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("disabled");
    expect(screen.getByText(/aborting/i)).toBeDefined();
  });

  it("accepts a custom label", () => {
    render(<AbortButton onAbort={onAbort} label="Stop generation" />);
    expect(screen.getByText("Stop generation")).toBeDefined();
  });

  it("renders an icon alongside label", () => {
    render(<AbortButton onAbort={onAbort} />);
    expect(screen.getByRole("button").querySelector("svg")).not.toBeNull();
  });
});
