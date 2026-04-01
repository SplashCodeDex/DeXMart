import { describe, it, expect } from "vitest";
import { normalizeFacebookEvents, validateFacebookSignature } from "./webhook.js";

describe("Facebook Webhook", () => {
  const appSecret = "test_secret";

  it("validates correct signature", () => {
    const payload = JSON.stringify({ object: "page" });
    const crypto = require("node:crypto");
    const hmac = crypto.createHmac("sha256", appSecret).update(payload).digest("hex");
    const signature = `sha256=${hmac}`;

    expect(validateFacebookSignature(payload, signature, appSecret)).toBe(true);
  });

  it("fails on incorrect signature", () => {
    expect(validateFacebookSignature("payload", "sha256=wrong", appSecret)).toBe(false);
  });

  it("normalizes a standard text message", () => {
    const body = {
      object: "page",
      entry: [
        {
          messaging: [
            {
              sender: { id: "user_123" },
              recipient: { id: "page_456" },
              timestamp: 123456789,
              message: {
                mid: "mid.1",
                text: "Hello DeXMart",
              },
            },
          ],
        },
      ],
    };

    const events = normalizeFacebookEvents(body);
    expect(events).toHaveLength(1);
    expect(events[0].content).toBe("Hello DeXMart");
    expect(events[0].sender).toBe("user_123");
  });

  it("ignores echo messages", () => {
    const body = {
      object: "page",
      entry: [
        {
          messaging: [
            {
              sender: { id: "page_456" },
              recipient: { id: "user_123" },
              message: { is_echo: true, text: "I said this" },
            },
          ],
        },
      ],
    };

    const events = normalizeFacebookEvents(body);
    expect(events).toHaveLength(0);
  });
});
