import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebhookCircuitBreaker } from "./webhookService.js";

describe("WebhookCircuitBreaker", () => {
  const URL = "https://example.com/webhook";
  let cb: WebhookCircuitBreaker;

  beforeEach(() => {
    cb = new WebhookCircuitBreaker();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is CLOSED (open=false) with zero failures", () => {
    expect(cb.isOpen(URL)).toBe(false);
  });

  it("stays CLOSED below failure threshold", () => {
    for (let i = 0; i < 4; i++) cb.recordFailure(URL);
    expect(cb.isOpen(URL)).toBe(false);
  });

  it("trips OPEN after 5 failures", () => {
    for (let i = 0; i < 5; i++) cb.recordFailure(URL);
    expect(cb.isOpen(URL)).toBe(true);
  });

  it("resets to CLOSED after a success", () => {
    for (let i = 0; i < 5; i++) cb.recordFailure(URL);
    expect(cb.isOpen(URL)).toBe(true);

    cb.recordSuccess(URL);
    expect(cb.isOpen(URL)).toBe(false);
  });

  it("is independent per URL", () => {
    const OTHER = "https://other.com/hook";
    for (let i = 0; i < 5; i++) cb.recordFailure(URL);

    expect(cb.isOpen(URL)).toBe(true);
    expect(cb.isOpen(OTHER)).toBe(false);
  });

  it("enters HALF_OPEN after cooldown, allows one probe", () => {
    for (let i = 0; i < 5; i++) cb.recordFailure(URL);
    expect(cb.isOpen(URL)).toBe(true);

    // Advance past the 60s cooldown
    vi.advanceTimersByTime(61_000);

    // First call after cooldown — HALF_OPEN allows the probe through
    expect(cb.isOpen(URL)).toBe(false);

    // Second call still within the same HALF_OPEN window — blocked again
    expect(cb.isOpen(URL)).toBe(true);
  });

  it("closes fully after successful probe in HALF_OPEN", () => {
    for (let i = 0; i < 5; i++) cb.recordFailure(URL);
    vi.advanceTimersByTime(61_000);

    cb.isOpen(URL); // consume the probe slot
    cb.recordSuccess(URL);

    expect(cb.isOpen(URL)).toBe(false);
  });

  it("re-trips immediately on probe failure in HALF_OPEN", () => {
    for (let i = 0; i < 5; i++) cb.recordFailure(URL);
    vi.advanceTimersByTime(61_000);

    cb.isOpen(URL); // consume probe
    cb.recordFailure(URL); // probe failed

    expect(cb.isOpen(URL)).toBe(true);
  });
});
