import { describe, expect, it, vi } from "vitest";
import { writeUrlToFile } from "./nodes-camera.js";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import crypto from "node:crypto";

describe("nodes-camera SSRF protection", () => {
  it("blocks downloads from private/local IPs", async () => {
    const tmpFile = path.join(os.tmpdir(), `ssrf-test-${crypto.randomUUID()}.tmp`);
    const localUrl = "https://127.0.0.1:12345";
    
    await expect(writeUrlToFile(tmpFile, localUrl)).rejects.toThrow(/Blocked/i);
    
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  it("blocks downloads from hostnames resolving to private IPs", async () => {
    const tmpFile = path.join(os.tmpdir(), `ssrf-test-${crypto.randomUUID()}.tmp`);
    const internalUrl = "https://localhost:12345";
    
    await expect(writeUrlToFile(tmpFile, internalUrl)).rejects.toThrow(/Blocked/i);
    
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  it("allows downloads from public hostnames (mocked fetch)", async () => {
    const tmpFile = path.join(os.tmpdir(), `ssrf-test-${crypto.randomUUID()}.tmp`);
    const publicUrl = "https://example.com/image.jpg";
    
    // We mock fetch so we don't actually hit the network in unit tests
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(() => 
      Promise.resolve({
        ok: true,
        headers: new Map([["content-length", "100"]]),
        body: {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: undefined })
          })
        }
      } as any)
    );

    await writeUrlToFile(tmpFile, publicUrl);
    expect(fetchSpy).toHaveBeenCalled();
    
    fetchSpy.mockRestore();
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });
});
