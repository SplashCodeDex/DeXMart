#!/usr/bin/env node
// Filters a list of files (passed after --) by type: 'lint' or 'format'.
// Outputs NUL-delimited matching file paths so the caller can safely handle
// filenames with spaces or special characters.
// Usage: node filter-staged-files.mjs <lint|format> -- file1 file2 ...

const LINT_EXTS = new Set([".ts", ".mts", ".cts", ".tsx", ".js", ".mjs", ".cjs"]);
const FORMAT_EXTS = new Set([".ts", ".mts", ".cts", ".tsx", ".js", ".mjs", ".cjs", ".json"]);

const type = process.argv[2];
if (type !== "lint" && type !== "format") {
  process.stderr.write(`filter-staged-files: unknown type '${type}' (expected lint|format)\n`);
  process.exit(1);
}

const dashDash = process.argv.indexOf("--");
const files = dashDash >= 0 ? process.argv.slice(dashDash + 1) : [];
const exts = type === "lint" ? LINT_EXTS : FORMAT_EXTS;

const matched = files.filter((f) => {
  const dot = f.lastIndexOf(".");
  return dot >= 0 && exts.has(f.slice(dot));
});

if (matched.length > 0) {
  process.stdout.write(matched.join("\0") + "\0");
}
