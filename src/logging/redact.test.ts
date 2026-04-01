import { describe, expect, it } from "vitest";
import { redactToolDetail } from "./redact.js";

describe("redaction helpers", () => {
  it("redacts secrets from tool details", () => {
    const input = 'API_KEY="sk-1234567890abcdef12345678" and PASSWORD=secret';
    const output = redactToolDetail(input);
    // Long tokens get masked with start/end preview
    expect(output).toContain('API_KEY="sk-123…5678"');
    // Short tokens get full redaction
    expect(output).toContain("PASSWORD=***");
  });

  it("redacts common token patterns", () => {
    const input = "Check ghp_ABCDEFGHIJKLMNOPQRSTUVXYZ0123456789 for details";
    const output = redactToolDetail(input);
    // ghp_AB (6) ... 6789 (4)
    expect(output).toContain("ghp_AB…6789");
  });
});
