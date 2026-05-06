import { Request, Response } from "express";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../lib/firebase.js";
import { MessageController } from "./messageController.js";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockJobQueue } = vi.hoisted(() => ({
  mockJobQueue: {
    addJob: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../services/jobQueue.js", () => ({
  default: mockJobQueue,
}));

vi.mock("../lib/firebase.js", () => ({
  db: {
    collection: vi.fn().mockReturnThis(),
    doc: vi.fn().mockReturnThis(),
    get: vi.fn(),
  },
}));

vi.mock("../utils/logger.js", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("MessageController", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockJobQueue.addJob.mockResolvedValue(undefined);
    mockReq = {
      user: { tenantId: "tenant-123" } as any,
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  describe("reply", () => {
    it("should enqueue a reply via the job queue", async () => {
      mockReq.body = {
        messageId: "msg-original",
        text: "This is a reply",
      };

      // Mock fetching the original message
      (db.collection("").doc("").get as any).mockResolvedValue({
        exists: true,
        data: () => ({
          channelId: "chan-456",
          remoteJid: "user-789@s.whatsapp.net",
        }),
      });

      await (MessageController as any).reply(mockReq as Request, mockRes as Response);

      expect(mockJobQueue.addJob).toHaveBeenCalledWith(
        "whatsapp-outbound",
        "reply",
        expect.objectContaining({
          channelId: "chan-456",
          jid: "user-789@s.whatsapp.net",
          message: "This is a reply",
        }),
      );
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it("should return 404 if original message not found", async () => {
      mockReq.body = { messageId: "missing", text: "hi" };
      (db.collection("").doc("").get as any).mockResolvedValue({ exists: false });

      await (MessageController as any).reply(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});
