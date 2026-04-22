import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ToolCallCard } from "./ToolCallCard";

describe("ToolCallCard", () => {
  it("renders tool name in header", () => {
    render(<ToolCallCard toolName="search_web" />);
    expect(screen.getByText("search_web")).toBeDefined();
  });

  it("is collapsed by default", () => {
    render(<ToolCallCard toolName="read_file" params={{ path: "/foo.ts" }} />);
    expect(screen.queryByText("/foo.ts")).toBeNull();
  });

  it("expands on header click to reveal params", () => {
    render(<ToolCallCard toolName="read_file" params={{ path: "/foo.ts" }} />);
    fireEvent.click(screen.getByRole("button", { name: /read_file/i }));
    expect(screen.getByText(/foo\.ts/)).toBeDefined();
  });

  it("shows result when provided and expanded", () => {
    render(
      <ToolCallCard
        toolName="read_file"
        params={{ path: "/foo.ts" }}
        result="file contents here"
        defaultOpen
      />,
    );
    expect(screen.getByText(/file contents here/)).toBeDefined();
  });

  it("can be opened by default via defaultOpen prop", () => {
    render(<ToolCallCard toolName="list_files" params={{ dir: "/src" }} defaultOpen />);
    expect(screen.getByText(/\/src/)).toBeDefined();
  });

  it("shows pending status indicator", () => {
    render(<ToolCallCard toolName="run_query" status="pending" />);
    expect(document.querySelector("[data-status='pending']")).not.toBeNull();
  });

  it("shows running status with animation indicator", () => {
    render(<ToolCallCard toolName="run_query" status="running" />);
    expect(document.querySelector("[data-status='running']")).not.toBeNull();
  });

  it("shows success status indicator", () => {
    render(<ToolCallCard toolName="run_query" status="success" />);
    expect(document.querySelector("[data-status='success']")).not.toBeNull();
  });

  it("shows error status indicator", () => {
    render(<ToolCallCard toolName="run_query" status="error" />);
    expect(document.querySelector("[data-status='error']")).not.toBeNull();
  });

  it("collapses when header clicked again after open", () => {
    render(<ToolCallCard toolName="read_file" params={{ path: "/foo.ts" }} defaultOpen />);
    expect(screen.getByText(/foo\.ts/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /read_file/i }));
    expect(screen.queryByText(/foo\.ts/)).toBeNull();
  });

  it("calls onToggle callback when expand state changes", () => {
    const onToggle = vi.fn();
    render(<ToolCallCard toolName="tool" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: /tool/i }));
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
