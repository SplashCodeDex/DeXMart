import { compileGlobPatterns, matchesAnyGlobPattern } from "./glob-pattern.js";
import type { SandboxToolPolicy } from "./sandbox/types.js";
import { expandToolGroups, normalizeToolName } from "./tool-policy.js";

function makeToolPolicyMatcher(policy: SandboxToolPolicy) {
  const deny = compileGlobPatterns({
    raw: expandToolGroups(policy.deny ?? []),
    normalize: normalizeToolName,
  });
  const allow = compileGlobPatterns({
    raw: expandToolGroups(policy.allow ?? []),
    normalize: normalizeToolName,
  });
  return (name: string) => {
    const normalized = normalizeToolName(name);
    if (matchesAnyGlobPattern(normalized, deny)) {
      return false;
    }
    if (normalized === "apply_patch" && matchesAnyGlobPattern("write", deny)) {
      return false;
    }
    if (allow.length === 0) {
      return true;
    }
    if (matchesAnyGlobPattern(normalized, allow)) {
      return true;
    }
    if (normalized === "apply_patch" && matchesAnyGlobPattern("write", allow)) {
      return true;
    }
    return false;
  };
}

export function isToolAllowedByPolicyName(name: string, policy?: SandboxToolPolicy): boolean {
  if (!policy) {
    return true;
  }
  return makeToolPolicyMatcher(policy)(name);
}

export function isToolAllowedByPolicies(
  name: string,
  policies: Array<SandboxToolPolicy | undefined>,
  options: { attestation?: string } = {},
) {
  const allowed = policies.every((policy) => isToolAllowedByPolicyName(name, policy));
  if (!allowed) {
    return false;
  }

  // OC-26192: Fail-closed governance for unsafe tool calls in Swift-governed environments.
  const unsafeTools = ["exec", "process", "read", "write", "edit", "apply_patch"];
  if (unsafeTools.includes(normalizeToolName(name))) {
    const requiresAttestation = policies.some((p) => (p as any)?.requiresAttestation === true);
    if (requiresAttestation && !options.attestation) {
      return false;
    }
  }

  return true;
}
