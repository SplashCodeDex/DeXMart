import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLogger,
  getResolvedLoggerSettings,
  resetLogger,
  setLoggerOverride,
} from "../logging.js";

const DEFAULT_MAX_FILE_BYTES = 500 * 1024 * 1024;

describe("log file size cap", () => {
  let logPath = "";

  beforeEach(() => {
    logPath = path.join(os.tmpdir(), `openclaw-log-cap-${crypto.randomUUID()}.log`);
    resetLogger();
    setLoggerOverride(null);
  });

  afterEach(() => {
    resetLogger();
    setLoggerOverride(null);
    vi.restoreAllMocks();
    try {
      fs.rmSync(logPath, { force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("defaults maxFileBytes to 500 MB when unset", () => {
    setLoggerOverride({ level: "info", file: logPath });
    expect(getResolvedLoggerSettings().maxFileBytes).toBe(DEFAULT_MAX_FILE_BYTES);
  });

  it("uses configured maxFileBytes", () => {
    setLoggerOverride({ level: "info", file: logPath, maxFileBytes: 2048 });
    expect(getResolvedLoggerSettings().maxFileBytes).toBe(2048);
  });

  it("rotates file after cap is reached", () => {
    const MAX_BYTES = 1024;
    setLoggerOverride({ level: "info", file: logPath, maxFileBytes: MAX_BYTES });
    const logger = getLogger();

    // Fill the file until it's just about to rotate
    let lastSize = 0;
    for (let i = 0; i < 500; i++) {
      logger.error(`log-${i}`);
      const currentSize = fs.statSync(logPath).size;
      if (currentSize >= MAX_BYTES) {
        lastSize = currentSize;
        break;
      }
    }
    
    // One more log should trigger rotation
    logger.error("trigger-rotation");
    
    // Verification: backup file should exist and primary file should be fresh
    expect(fs.existsSync(`${logPath}.1`), "Backup file should be created").toBe(true);
    const sizeAfterRotation = fs.statSync(logPath).size;
    expect(sizeAfterRotation).toBeLessThan(1000);
    expect(fs.statSync(`${logPath}.1`).size).toBe(lastSize);
    
    try {
      fs.rmSync(`${logPath}.1`, { force: true });
    } catch {
      // ignore
    }
  });
});
