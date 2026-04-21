/**
 * gateway-types.ts
 *
 * Thin re-exports of Upstream OpenClaw Gateway Protocol types.
 * DO NOT redefine types here; import them from @openclaw/protocol/* to ensure parity.
 * (Enforces PROJECT_RULES §0.1)
 */

export type {
  // Common
  ErrorShape,
  StateVersion,
  Snapshot,
} from "@openclaw/protocol/index";
