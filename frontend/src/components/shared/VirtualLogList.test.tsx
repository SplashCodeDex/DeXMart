import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { VirtualLogList } from "./VirtualLogList";

// Mock @tanstack/react-virtual since JSDOM doesn't support layout measurements
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: vi.fn((options) => {
    // Call these to get coverage in the component
    if (options.getScrollElement) options.getScrollElement();
    if (options.estimateSize) options.estimateSize();

    return {
      getTotalSize: () => options.count * 30,
      getVirtualItems: () =>
        Array.from({ length: options.count }, (_, i) => ({
          index: i,
          key: i,
          start: i * 30,
          measureElement: () => {},
        })),
      measureElement: () => {},
    };
  }),
}));

beforeAll(() => {
  global.ResizeObserver = class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };
});

const makeItems = (n: number) => Array.from({ length: n }, (_, i) => `Log entry ${i + 1}`);

describe("VirtualLogList", () => {
  it("renders visible items from the list", () => {
    const items = makeItems(5);
    render(<VirtualLogList items={items} renderItem={(item) => <div>{item}</div>} height={300} />);
    expect(screen.getByText("Log entry 1")).toBeDefined();
  });

  it("shows empty state when items array is empty", () => {
    render(
      <VirtualLogList items={[]} renderItem={(item: string) => <div>{item}</div>} height={300} />,
    );
    expect(screen.getByText(/no entries/i)).toBeDefined();
  });

  it("renders with custom estimateSize without error", () => {
    const items = makeItems(3);
    const { container } = render(
      <VirtualLogList
        items={items}
        renderItem={(item) => <div>{item}</div>}
        height={200}
        estimateSize={40}
      />,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it("accepts string height (e.g. 100%)", () => {
    const items = makeItems(3);
    const { container } = render(
      <VirtualLogList items={items} renderItem={(item) => <div>{item}</div>} height="100%" />,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it("forwards className to container", () => {
    const items = makeItems(2);
    render(
      <VirtualLogList
        items={items}
        renderItem={(item) => <div>{item}</div>}
        height={300}
        className="test-vll"
      />,
    );
    expect(document.querySelector(".test-vll")).not.toBeNull();
  });
});
