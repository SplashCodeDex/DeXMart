import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StreamingText } from "./StreamingText";

describe("StreamingText", () => {
  it("should render the provided text", () => {
    render(<StreamingText content="Hello world" />);
    // When using char-by-char animation, getByText might not work if it's split into spans.
    // So we check if the content is present in the container.
    const element = screen.getByTestId("streaming-text");
    expect(element.textContent).toBe("Hello world");
  });

  it("should render each character in a separate span for animation", () => {
    const { container } = render(<StreamingText content="Hi" />);
    const spans = container.querySelectorAll("span");
    // 'Hi' should be at least 2 spans if animated char-by-char
    expect(spans.length).toBeGreaterThanOrEqual(2);
  });
});
