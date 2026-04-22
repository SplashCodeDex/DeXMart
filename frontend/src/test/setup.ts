import * as matchers from "@testing-library/jest-dom/matchers";
import { expect } from "vitest";
import "@testing-library/jest-dom/vitest";

expect.extend(matchers);

// Polyfill ResizeObserver for Radix UI components
class ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

window.ResizeObserver = ResizeObserver;
