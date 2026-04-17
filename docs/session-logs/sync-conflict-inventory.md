# Upstream Sync Conflict Inventory (v2026.4.15)

## Overview

- **Target Tag:** v2026.4.15
- **Strategy:** "Merge-to-Latest, Fix Once"
- **Total Conflicts:** 187
- **Injection Point Conflicts:** 0 (Clean merge)

## Breakdown by Area

- `docs/`: 63
- `src/` (core/tests): 54
- `scripts/`: 22
- `apps/`: 18
- `ui/`: 15
- `root configs`: 10
- `extensions/`: 5

## Resolution Details

All 187 conflicts fell into Category C (Standard Upstream Evolution) since our primary injection and integration points merged cleanly.

### Modify/Delete Conflicts (Upstream Deleted / We Modified)

Many files (especially in `src/` tests and `extensions/`) were marked `.skip` by us for test remediation but subsequently deleted upstream.

- **Resolution:** Deleted to maintain upstream parity.

### Standard Upstream Modifications

Includes `package.json`, `pnpm-lock.yaml`, and core tools.

- **Resolution:** Accepted upstream (`--theirs`)

### UI, Apps, and Docs

- **Resolution:** Accepted upstream (`--theirs`) to ensure our secondary and informational platforms align with the open-source OpenClaw codebase.
