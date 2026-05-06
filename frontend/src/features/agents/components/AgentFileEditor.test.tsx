import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect } from "vitest";
import { AgentFileEditor } from "./AgentFileEditor";

// Mock CodeMirror since it's hard to test in JSDOM
vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: any) => (
    <textarea
      data-testid="codemirror-mock"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

describe("AgentFileEditor", () => {
  const mockOnSave = vi.fn().mockResolvedValue(undefined);
  const mockOnClose = vi.fn();
  const mockOnDirtyChange = vi.fn();

  it("calls onDirtyChange(true) when content changes", () => {
    render(
      <AgentFileEditor
        filename="test.js"
        initialContent="initial"
        onSave={mockOnSave}
        onClose={mockOnClose}
        onDirtyChange={mockOnDirtyChange}
      />,
    );

    const textarea = screen.getByTestId("codemirror-mock");
    fireEvent.change(textarea, { target: { value: "changed" } });

    expect(mockOnDirtyChange).toHaveBeenCalledWith(true);
  });

  it("calls onDirtyChange(false) after save", async () => {
    render(
      <AgentFileEditor
        filename="test.js"
        initialContent="initial"
        onSave={mockOnSave}
        onClose={mockOnClose}
        onDirtyChange={mockOnDirtyChange}
      />,
    );

    const textarea = screen.getByTestId("codemirror-mock");
    fireEvent.change(textarea, { target: { value: "changed" } });

    const saveButton = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveButton);

    await vi.waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith("changed");
      expect(mockOnDirtyChange).toHaveBeenLastCalledWith(false);
    });
  });

  it("calls onDirtyChange(false) when content is reverted to initial", () => {
    render(
      <AgentFileEditor
        filename="test.js"
        initialContent="initial"
        onSave={mockOnSave}
        onClose={mockOnClose}
        onDirtyChange={mockOnDirtyChange}
      />,
    );

    const textarea = screen.getByTestId("codemirror-mock");
    fireEvent.change(textarea, { target: { value: "changed" } });
    expect(mockOnDirtyChange).toHaveBeenLastCalledWith(true);

    fireEvent.change(textarea, { target: { value: "initial" } });
    expect(mockOnDirtyChange).toHaveBeenLastCalledWith(false);
  });
});
