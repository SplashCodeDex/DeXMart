import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendMessageFacebook } from "./send.js";
import { fetch } from "undici";

vi.mock("undici", () => ({
  fetch: vi.fn(),
}));

describe("sendMessageFacebook", () => {
  const credentials = {
    pageAccessToken: "test_token",
    appSecret: "test_secret",
    verifyToken: "test_verify",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a simple text message", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message_id: "mid.123", recipient_id: "456" }),
    });

    const result = await sendMessageFacebook("456", "Hello FB", credentials);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("graph.facebook.com/v20.0/me/messages"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"text":"Hello FB"'),
      })
    );
    expect(result.message_id).toBe("mid.123");
  });

  it("chunks long messages", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message_id: "mid.chunk", recipient_id: "456" }),
    });

    const longText = "a".repeat(2500);
    await sendMessageFacebook("456", longText, credentials);

    // Should call fetch twice (2000 + 500)
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws on API error", async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      statusText: "Unauthorized",
      json: () => Promise.resolve({ error: { message: "Invalid token" } }),
    });

    await expect(sendMessageFacebook("456", "Hello", credentials)).rejects.toThrow("Facebook API error: Invalid token");
  });
});
