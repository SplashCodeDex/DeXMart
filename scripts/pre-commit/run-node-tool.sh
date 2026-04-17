#!/usr/bin/env bash
# Runs a node_modules/.bin tool with the provided arguments.
# Usage: run-node-tool.sh <tool-name> [args...] -- [files...]
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
tool="${1:?run-node-tool: tool name required}"
shift

bin="$ROOT_DIR/node_modules/.bin/$tool"
if [[ ! -x "$bin" ]]; then
  echo "run-node-tool: $tool not found at $bin" >&2
  exit 1
fi

exec "$bin" "$@"
