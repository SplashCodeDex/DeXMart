import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const SCRIPT = path.join(REPO_ROOT, "scripts/controlui-parity-discover.ts");
const MATRIX_PATH = path.join(
  REPO_ROOT,
  "conductor/tracks/dashboard_controlui_parity_20260421/artifacts/parity-matrix.json",
);
const REPORT_PATH = path.join(
  REPO_ROOT,
  "conductor/tracks/dashboard_controlui_parity_20260421/artifacts/parity-report.md",
);

const runScript = (args: string[] = []): { stdout: string; stderr: string; status: number } => {
  const result = spawnSync("node", ["--import", "tsx", SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 30_000,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
  };
};

describe("scripts/controlui-parity-discover --check mode", () => {
  it("exits 0 when artifact is current", () => {
    const { status, stdout } = runScript(["--check"]);
    expect(status).toBe(0);
    expect(stdout).toContain("OK: parity matrix current");
  });

  it("reports 119 RPC methods mapped", () => {
    const { stdout } = runScript(["--check"]);
    expect(stdout).toMatch(/119 methods mapped/);
  });

  it("reports non-zero coverage percentage", () => {
    const { stdout } = runScript(["--check"]);
    expect(stdout).toMatch(/\d+% coverage/);
  });

  it("exits 1 when artifact is stale", () => {
    const original = fs.readFileSync(MATRIX_PATH, "utf8");
    const parsed = JSON.parse(original) as Record<string, unknown>;
    parsed.summary = { rpc_method_count: 0 };
    fs.writeFileSync(MATRIX_PATH, JSON.stringify(parsed, null, 2) + "\n");
    try {
      const { status, stderr } = runScript(["--check"]);
      expect(status).toBe(1);
      expect(stderr).toContain("ERROR: parity-matrix.json is stale");
    } finally {
      fs.writeFileSync(MATRIX_PATH, original);
    }
  });
});

describe("scripts/controlui-parity-discover parity-matrix.json artifact shape", () => {
  let matrix: Record<string, unknown>;

  beforeAll(() => {
    matrix = JSON.parse(fs.readFileSync(MATRIX_PATH, "utf8")) as Record<string, unknown>;
  });

  it("has required top-level keys", () => {
    expect(matrix).toHaveProperty("summary");
    expect(matrix).toHaveProperty("matrix");
    expect(matrix).toHaveProperty("gaps");
    expect(matrix).toHaveProperty("rpc_methods");
  });

  it("tracks exactly 22 parity features", () => {
    const entries = matrix.matrix as unknown[];
    expect(entries).toHaveLength(22);
  });

  it("has 119 RPC methods in summary", () => {
    const summary = matrix.summary as Record<string, number>;
    expect(summary.rpc_method_count).toBe(119);
  });

  it("has 0 unmapped RPC methods", () => {
    const gaps = matrix.gaps as Record<string, unknown[]>;
    expect(gaps.unmappedRpcMethods).toHaveLength(0);
  });

  it("every feature entry has required fields", () => {
    const entries = matrix.matrix as Array<Record<string, unknown>>;
    for (const entry of entries) {
      expect(entry).toHaveProperty("featureId");
      expect(entry).toHaveProperty("strategy");
      expect(entry).toHaveProperty("status");
      expect(entry).toHaveProperty("rpcMethods");
    }
  });

  it("connect-gate is subtract strategy with complete status", () => {
    const entries = matrix.matrix as Array<Record<string, unknown>>;
    const connectGate = entries.find((e) => e.featureId === "connect-gate");
    expect(connectGate?.strategy).toBe("subtract");
    expect(connectGate?.status).toBe("complete");
  });
});

describe("scripts/controlui-parity-discover parity-report.md artifact", () => {
  it("exists and contains report header", () => {
    expect(fs.existsSync(REPORT_PATH)).toBe(true);
    const content = fs.readFileSync(REPORT_PATH, "utf8");
    expect(content).toContain("ControlUI → DeXMart Parity Matrix Report");
  });

  it("contains summary section with RPC count", () => {
    const content = fs.readFileSync(REPORT_PATH, "utf8");
    expect(content).toContain("rpc_method_count");
  });
});
