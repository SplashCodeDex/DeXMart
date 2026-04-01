import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { getLogger, setLoggerOverride, resetLogger } from "./logger.js";

describe("logger rotation", () => {
  afterEach(() => {
    resetLogger();
    setLoggerOverride(null);
  });

  it("rotates log file when maxFileBytes is reached", () => {
    const logPath = pathForTest();
    const backupPath = `${logPath}.1`;
    cleanup(logPath);
    cleanup(backupPath);

    const MAX_BYTES = 500;
    setLoggerOverride({ 
      level: "info", 
      file: logPath,
      maxFileBytes: MAX_BYTES
    });

    const logger = getLogger();
    
    // Write logs to nearly fill the file
    let count = 0;
    for (let i = 0; i < 100; i++) {
      logger.info("Filling log file...", { count: count++ });
      if (fs.existsSync(logPath) && fs.statSync(logPath).size >= MAX_BYTES - 50) {
        break;
      }
    }

    // This log should trigger rotation
    logger.info("This log triggers rotation! It is a long enough message to ensure we hit the limit.");
    
    // Verification
    expect(fs.existsSync(logPath), "Primary log file should still exist").toBe(true);
    expect(fs.existsSync(backupPath), "Backup log file (.1) should be created").toBe(true);
    
    const sizeAfterRotation = fs.statSync(logPath).size;
    const sizeBackup = fs.statSync(backupPath).size;
    
    expect(sizeAfterRotation).toBeLessThan(1000);
    expect(sizeBackup).toBeGreaterThanOrEqual(MAX_BYTES);

    cleanup(logPath);
    cleanup(backupPath);
  });

  it("overwrites the backup file on second rotation by default", () => {
     const logPath = pathForTest();
    const backupPath = `${logPath}.1`;
    cleanup(logPath);
    cleanup(backupPath);

    const MAX_BYTES = 200;
    setLoggerOverride({ 
      level: "info", 
      file: logPath,
      maxFileBytes: MAX_BYTES
    });

    const logger = getLogger();
    
    // First rotation
    logger.info("First rotation log data 111111111111111111111111111111111111111111111111111111111111111111111111111111111");
    logger.info("First rotation log data 222222222222222222222222222222222222222222222222222222222222222222222222222222222");
    logger.info("Trigger 1"); // should trigger first rotation
    
    expect(fs.existsSync(backupPath)).toBe(true);
    const content1 = fs.readFileSync(backupPath, "utf-8");

    // Second rotation
    logger.info("Second rotation log data 333333333333333333333333333333333333333333333333333333333333333333333333333333333");
    logger.info("Second rotation log data 444444444444444444444444444444444444444444444444444444444444444444444444444444444");
    logger.info("Trigger 2"); // should trigger second rotation
    
    expect(fs.existsSync(backupPath)).toBe(true);
    const content2 = fs.readFileSync(backupPath, "utf-8");
    
    expect(content2).not.toBe(content1);
    expect(content2).toContain("Second rotation log data");

    cleanup(logPath);
    cleanup(backupPath);
  });
});

function pathForTest() {
  const file = path.join(os.tmpdir(), `openclaw-rotation-test-${crypto.randomUUID()}.log`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
}

function cleanup(file: string) {
  try {
    fs.rmSync(file, { force: true });
  } catch {
    // ignore
  }
}
