import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ThinkingCard } from "./ThinkingCard";

describe("ThinkingCard", () => {
  it("renders 'Thinking' header", () => {
    render(<ThinkingCard content="Let me reason through this..." />);
    expect(screen.getByText(/thinking/i)).toBeDefined();
  });

  it("is collapsed by default", () => {
    render(<ThinkingCard content="hidden reasoning" />);
    expect(screen.queryByText("hidden reasoning")).toBeNull();
  });

  it("expands on header click to reveal content", () => {
    render(<ThinkingCard content="visible reasoning" />);
    fireEvent.click(screen.getByRole("button", { name: /thinking/i }));
    expect(screen.getByText("visible reasoning")).toBeDefined();
  });

  it("collapses again on second header click", () => {
    render(<ThinkingCard content="visible reasoning" defaultOpen />);
    expect(screen.getByText("visible reasoning")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /thinking/i }));
    expect(screen.queryByText("visible reasoning")).toBeNull();
  });

  it("can be opened by default via defaultOpen prop", () => {
    render(<ThinkingCard content="pre-expanded content" defaultOpen />);
    expect(screen.getByText("pre-expanded content")).toBeDefined();
  });

  it("shows streaming indicator when isStreaming is true", () => {
    render(<ThinkingCard content="..." isStreaming />);
    expect(document.querySelector("[data-streaming='true']")).not.toBeNull();
  });

  it("does not show streaming indicator when not streaming", () => {
    render(<ThinkingCard content="done" isStreaming={false} />);
    expect(document.querySelector("[data-streaming='true']")).toBeNull();
  });

  it("calls onToggle when expand state changes", () => {
    const onToggle = vi.fn();
    render(<ThinkingCard content="test" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: /thinking/i }));
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
