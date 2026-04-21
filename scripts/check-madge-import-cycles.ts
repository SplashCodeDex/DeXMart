#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import madge from "madge";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scanRoots = ["extensions", "ui"] as const;
// src/ has 40 pre-existing cycles; exclude it from traversal until legacy backend is cleaned up
const excludeRegExp = [/^src\//];

function normalizeRepoPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

async function main(): Promise<number> {
  const result = await madge([...scanRoots], {
    baseDir: repoRoot,
    fileExtensions: ["ts"],
    tsConfig: path.join(repoRoot, "tsconfig.json"),
    excludeRegExp,
  });
  const cycles = result.circular().map((cycle) => cycle.map((file) => normalizeRepoPath(file)));

  console.log(`Madge import cycle check: ${cycles.length} cycle(s).`);
  if (cycles.length === 0) {
    return 0;
  }

  console.error("\nMadge circular dependencies:");
  for (const [index, cycle] of cycles.entries()) {
    console.error(`\n# cycle ${index + 1}`);
    console.error(`  ${cycle.join("\n  -> ")}`);
  }
  console.error(
    "\nBreak the cycle or extract a leaf contract instead of routing through a barrel.",
  );
  return 1;
}

process.exitCode = await main();
