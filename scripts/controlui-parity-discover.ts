#!/usr/bin/env tsx
/**
 * Phase 0 discovery — scans ControlUI (ui/), Gateway RPC (src/gateway/server-methods/),
 * and DeXMart dashboard (frontend/src/app, frontend/src/features), emits parity-matrix.json.
 *
 * Output artifact is the source of truth for the Dashboard ControlUI Parity track.
 * Rerun any time upstream sync lands new ControlUI surfaces or RPC methods.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");

const GATEWAY_METHODS_DIR = path.join(REPO_ROOT, "src/gateway/server-methods");
const CONTROLUI_VIEWS_DIR = path.join(REPO_ROOT, "ui/src/ui/views");
const CONTROLUI_CONTROLLERS_DIR = path.join(REPO_ROOT, "ui/src/ui/controllers");
const DEXMART_DASHBOARD_DIR = path.join(REPO_ROOT, "frontend/src/app/(dashboard)");
const DEXMART_FEATURES_DIR = path.join(REPO_ROOT, "frontend/src/features");

const TRACK_DIR = path.join(REPO_ROOT, "conductor/tracks/dashboard_controlui_parity_20260421");
const ARTIFACTS_DIR = path.join(TRACK_DIR, "artifacts");
const OVERRIDES_PATH = path.join(ARTIFACTS_DIR, "overrides.json");
const MATRIX_PATH = path.join(ARTIFACTS_DIR, "parity-matrix.json");
const REPORT_PATH = path.join(ARTIFACTS_DIR, "parity-report.md");

// ---------- Types ----------

interface RpcMethod {
  method: string;
  domain: string;
  file: string;
  line: number;
}

interface ControlUiView {
  name: string;
  file: string;
  methodsUsed: string[];
  controllersReferenced: string[];
}

interface ControlUiController {
  name: string;
  file: string;
  methodsUsed: string[];
}

interface DexmartRoute {
  route: string;
  pageFile: string;
  featureDir: string | null;
}

interface DexmartFeature {
  name: string;
  file: string;
}

type Strategy = "add" | "enhance" | "weave" | "implement" | "subtract" | "unknown";
type Status = "missing" | "stub" | "partial" | "complete";

interface ParityEntry {
  featureId: string;
  label: string;
  controlUiViews: string[];
  controlUiControllers: string[];
  rpcMethods: string[];
  dexmartRoute: string | null;
  dexmartFeatureDir: string | null;
  strategy: Strategy;
  status: Status;
  notes: string[];
}

interface Overrides {
  subtract?: Array<{ featureId: string; reason: string }>;
  strategyOverrides?: Record<string, Strategy>;
  statusOverrides?: Record<string, Status>;
  featureMapping?: Record<string, { route?: string; featureDir?: string; label?: string }>;
  weaveTargets?: Record<string, string>;
}

// ---------- File helpers ----------

const listFiles = (dir: string, predicate: (f: string) => boolean): string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries: string[] = [];
  const walk = (cursor: string): void => {
    for (const name of fs.readdirSync(cursor)) {
      const full = path.join(cursor, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (predicate(full)) {
        entries.push(full);
      }
    }
  };
  walk(dir);
  return entries.toSorted();
};

const isTs = (f: string): boolean => f.endsWith(".ts") || f.endsWith(".tsx");
const isNonTest = (f: string): boolean =>
  !f.includes(".test.") && !f.includes(".browser.test.") && !f.includes(".node.test.");
const rel = (p: string): string => path.relative(REPO_ROOT, p);

// ---------- Extractors ----------

const RPC_METHOD_PATTERN = /^\s*"([a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+)"\s*:\s*(?:async\s*)?\(/gm;

const extractRpcMethods = (): RpcMethod[] => {
  const out: RpcMethod[] = [];
  const files = listFiles(GATEWAY_METHODS_DIR, (f) => isTs(f) && isNonTest(f));
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    RPC_METHOD_PATTERN.lastIndex = 0;
    while ((match = RPC_METHOD_PATTERN.exec(text)) !== null) {
      const method = match[1];
      const domain = method.split(".")[0];
      const line = text.slice(0, match.index).split("\n").length;
      out.push({ method, domain, file: rel(file), line });
    }
  }
  // dedupe by method (some methods may appear twice in tests)
  const seen = new Set<string>();
  return out
    .filter((m) => {
      if (seen.has(m.method)) {
        return false;
      }
      seen.add(m.method);
      return true;
    })
    .toSorted((a, b) => a.method.localeCompare(b.method));
};

const REQUEST_CALL_PATTERN = /\.request\s*\(\s*["']([a-z][a-z0-9.-]*\.[a-z][a-z0-9.-]*)["']/g;

const extractMethodsUsed = (text: string): string[] => {
  const used = new Set<string>();
  let match: RegExpExecArray | null;
  REQUEST_CALL_PATTERN.lastIndex = 0;
  while ((match = REQUEST_CALL_PATTERN.exec(text)) !== null) {
    used.add(match[1]);
  }
  return [...used].toSorted();
};

const CONTROLLER_IMPORT_PATTERN = /from\s+["']\.\.\/controllers\/([a-z0-9-]+)(?:\.\w+)?["']/g;

const extractControlUiControllers = (): ControlUiController[] => {
  const files = listFiles(CONTROLUI_CONTROLLERS_DIR, (f) => isTs(f) && isNonTest(f));
  return files
    .map((file): ControlUiController => {
      const text = fs.readFileSync(file, "utf8");
      return {
        name: path.basename(file).replace(/\.ts$/, ""),
        file: rel(file),
        methodsUsed: extractMethodsUsed(text),
      };
    })
    .toSorted((a, b) => a.name.localeCompare(b.name));
};

const extractControlUiViews = (): ControlUiView[] => {
  const files = listFiles(CONTROLUI_VIEWS_DIR, (f) => isTs(f) && isNonTest(f));
  return files
    .map((file): ControlUiView => {
      const text = fs.readFileSync(file, "utf8");
      const controllersRef = new Set<string>();
      let match: RegExpExecArray | null;
      CONTROLLER_IMPORT_PATTERN.lastIndex = 0;
      while ((match = CONTROLLER_IMPORT_PATTERN.exec(text)) !== null) {
        controllersRef.add(match[1]);
      }
      return {
        name: path.basename(file).replace(/\.ts$/, ""),
        file: rel(file),
        methodsUsed: extractMethodsUsed(text),
        controllersReferenced: [...controllersRef].toSorted(),
      };
    })
    .toSorted((a, b) => a.name.localeCompare(b.name));
};

const extractDexmartRoutes = (): DexmartRoute[] => {
  if (!fs.existsSync(DEXMART_DASHBOARD_DIR)) {
    return [];
  }
  const pages = listFiles(DEXMART_DASHBOARD_DIR, (f) => f.endsWith("/page.tsx"));
  return pages
    .map((file): DexmartRoute => {
      const relFile = rel(file);
      const afterGroup = relFile.split("(dashboard)/")[1] ?? "";
      const route = "/" + afterGroup.replace(/\/page\.tsx$/, "");
      const segs = afterGroup.replace(/\/page\.tsx$/, "").split("/");
      const featureName = segs[0] === "dashboard" ? segs[1] : segs[0] || "";
      const featureDirGuess = featureName ? path.join(DEXMART_FEATURES_DIR, featureName) : null;
      return {
        route: route.replace(/\/$/, "") || "/",
        pageFile: relFile,
        featureDir: featureDirGuess && fs.existsSync(featureDirGuess) ? rel(featureDirGuess) : null,
      };
    })
    .toSorted((a, b) => a.route.localeCompare(b.route));
};

const extractDexmartFeatures = (): DexmartFeature[] => {
  if (!fs.existsSync(DEXMART_FEATURES_DIR)) {
    return [];
  }
  return fs
    .readdirSync(DEXMART_FEATURES_DIR)
    .filter((name) => {
      const full = path.join(DEXMART_FEATURES_DIR, name);
      return fs.statSync(full).isDirectory();
    })
    .map((name): DexmartFeature => ({ name, file: rel(path.join(DEXMART_FEATURES_DIR, name)) }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
};

// ---------- Matrix synthesis ----------

interface FeatureSeed {
  id: string;
  label: string;
  viewHints?: string[];
  controllerHints?: string[];
  domains?: string[];
  strategy?: Strategy;
  dexmartFeatureHint?: string;
  dexmartRouteHint?: string;
  sidebarNavPriority?: number;
}

const FEATURE_SEEDS: FeatureSeed[] = [
  {
    id: "chat",
    label: "Mastermind Chat",
    viewHints: ["chat"],
    controllerHints: ["chat"],
    domains: ["chat"],
    strategy: "add",
    sidebarNavPriority: 1,
  },
  {
    id: "channels",
    label: "Channels + QR Login",
    viewHints: ["channels"],
    controllerHints: ["channels"],
    domains: ["channels", "web"],
    dexmartFeatureHint: "omnichannel",
    dexmartRouteHint: "omnichannel",
    strategy: "weave",
  },
  {
    id: "agents",
    label: "Agents CRUD + Files + Identity",
    viewHints: ["agents"],
    controllerHints: [
      "agents",
      "agent-files",
      "agent-identity",
      "agent-skills",
      "assistant-identity",
    ],
    domains: ["agents", "agent"],
    dexmartFeatureHint: "agents",
    strategy: "enhance",
  },
  {
    id: "sessions",
    label: "Sessions List + Detail + Compaction",
    viewHints: ["sessions"],
    controllerHints: ["sessions"],
    domains: ["sessions"],
    strategy: "implement",
  },
  {
    id: "config",
    label: "Configuration Panel",
    viewHints: ["config"],
    controllerHints: ["config"],
    domains: ["config", "secrets"],
    dexmartFeatureHint: "config",
    strategy: "enhance",
  },
  {
    id: "cron",
    label: "Cron Jobs",
    viewHints: ["cron"],
    controllerHints: ["cron"],
    domains: ["cron"],
    strategy: "enhance",
  },
  {
    id: "skills",
    label: "Skills + Plugins",
    viewHints: ["skills"],
    controllerHints: ["skills"],
    domains: ["skills", "plugin"],
    strategy: "enhance",
  },
  {
    id: "nodes",
    label: "Nodes + Canvas + Pending Queue",
    viewHints: ["nodes"],
    controllerHints: ["nodes"],
    domains: ["node"],
    strategy: "enhance",
  },
  {
    id: "devices",
    label: "Device Pairing + Tokens",
    viewHints: ["nodes"],
    controllerHints: ["devices"],
    domains: ["device"],
    strategy: "weave",
  },
  {
    id: "logs",
    label: "Live Logs Viewer",
    viewHints: ["logs"],
    controllerHints: ["logs"],
    domains: ["logs"],
    strategy: "implement",
  },
  {
    id: "debug",
    label: "Debug / Developer Panel",
    viewHints: ["debug"],
    controllerHints: ["debug", "models", "health"],
    domains: ["models", "gateway", "push", "tools"],
    strategy: "add",
  },
  {
    id: "dreaming",
    label: "Doctor / Memory (Dream)",
    viewHints: ["dreaming"],
    controllerHints: ["dreaming"],
    domains: ["doctor"],
    strategy: "weave",
  },
  {
    id: "tts",
    label: "TTS / Voice Settings",
    domains: ["tts", "talk", "voicewake"],
    strategy: "weave",
  },
  {
    id: "instances",
    label: "Instances + Presence",
    viewHints: ["instances"],
    controllerHints: ["presence"],
    strategy: "weave",
  },
  { id: "setup-wizard", label: "First-Run Setup Wizard", domains: ["wizard"], strategy: "add" },
  {
    id: "usage",
    label: "Usage Time-Series + Cost",
    viewHints: [
      "usage",
      "usage-metrics",
      "usage-query",
      "usage-render-details",
      "usage-render-overview",
    ],
    controllerHints: ["usage"],
    domains: ["usage"],
    strategy: "enhance",
  },
  {
    id: "exec-approvals",
    label: "Exec Approvals Allowlist",
    viewHints: ["exec-approval", "nodes-exec-approvals"],
    controllerHints: ["exec-approval", "exec-approvals"],
    domains: ["exec"],
    strategy: "weave",
  },
  { id: "update-runner", label: "Update Runner", domains: ["update"], strategy: "weave" },
  {
    id: "overview",
    label: "Home / Overview Cards",
    viewHints: [
      "overview",
      "overview-attention",
      "overview-cards",
      "overview-event-log",
      "overview-hints",
      "overview-log-tail",
    ],
    strategy: "enhance",
    dexmartRouteHint: "home",
  },
  {
    id: "command-palette",
    label: "Command Palette",
    viewHints: ["command-palette"],
    domains: ["commands"],
    strategy: "add",
  },
  {
    id: "message-actions",
    label: "Message Actions (react/edit/delete)",
    domains: ["message"],
    strategy: "weave",
  },
  {
    id: "connect-gate",
    label: "Connect / Gateway URL / Login Gate",
    viewHints: ["connect-command", "gateway-url-confirmation", "login-gate"],
    strategy: "subtract",
  },
];

const loadOverrides = (): Overrides => {
  if (!fs.existsSync(OVERRIDES_PATH)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8")) as Overrides;
  } catch {
    return {};
  }
};

const resolveStrategy = (seed: Strategy | undefined, override: Strategy | undefined): Strategy =>
  override ?? seed ?? "unknown";

const findViews = (views: ControlUiView[], hints?: string[]): ControlUiView[] => {
  if (!hints?.length) {
    return [];
  }
  return views.filter((v) =>
    hints.some((h) => v.name === h || v.name.startsWith(`${h}.`) || v.name.startsWith(`${h}-`)),
  );
};

const findControllers = (
  controllers: ControlUiController[],
  hints?: string[],
): ControlUiController[] => {
  if (!hints?.length) {
    return [];
  }
  return controllers.filter((c) => hints.includes(c.name));
};

const findRoute = (routes: DexmartRoute[], hint?: string): DexmartRoute | null => {
  if (!hint) {
    return null;
  }
  return routes.find((r) => r.route.endsWith(`/${hint}`)) ?? null;
};

const findFeature = (features: DexmartFeature[], hint?: string): DexmartFeature | null => {
  if (!hint) {
    return null;
  }
  return features.find((f) => f.name === hint) ?? null;
};

const collectRpcMethods = (
  views: ControlUiView[],
  controllers: ControlUiController[],
  rpcByDomain: Map<string, string[]>,
  domains: string[],
): string[] => {
  const merged = new Set<string>();
  views.forEach((v) => v.methodsUsed.forEach((m) => merged.add(m)));
  controllers.forEach((c) => c.methodsUsed.forEach((m) => merged.add(m)));
  for (const domain of domains) {
    rpcByDomain.get(domain)?.forEach((m) => merged.add(m));
  }
  return [...merged].toSorted();
};

const determineStatus = (
  strategy: Strategy,
  route: DexmartRoute | null,
  feature: DexmartFeature | null,
  override?: Status,
): Status => {
  if (override) {
    return override;
  }
  if (strategy === "subtract") {
    return "complete";
  }
  if (!route && !feature) {
    return "missing";
  }
  if (route && !feature) {
    return "stub";
  }
  if (!route && feature) {
    return "partial";
  }
  return "partial"; // real completeness comes from Playwright parity suite
};

const synthesizeMatrix = (
  rpcMethods: RpcMethod[],
  views: ControlUiView[],
  controllers: ControlUiController[],
  routes: DexmartRoute[],
  features: DexmartFeature[],
  overrides: Overrides,
): ParityEntry[] => {
  const rpcByDomain = new Map<string, string[]>();
  for (const m of rpcMethods) {
    const arr = rpcByDomain.get(m.domain) ?? [];
    arr.push(m.method);
    rpcByDomain.set(m.domain, arr);
  }

  const subtractIds = new Set((overrides.subtract ?? []).map((s) => s.featureId));

  return FEATURE_SEEDS.map((seed): ParityEntry => {
    const manualMap = overrides.featureMapping?.[seed.id] ?? {};
    const matchedViews = findViews(views, seed.viewHints);
    const matchedControllers = findControllers(controllers, seed.controllerHints);
    const dexmartRouteHint = manualMap.route ?? seed.dexmartRouteHint ?? seed.id;
    const dexmartFeatureHint = manualMap.featureDir ?? seed.dexmartFeatureHint ?? seed.id;
    const route = findRoute(routes, dexmartRouteHint.replace(/^\/dashboard\//, ""));
    const feature = findFeature(features, dexmartFeatureHint);
    const strategyOverride = overrides.strategyOverrides?.[seed.id];
    const strategy = subtractIds.has(seed.id)
      ? "subtract"
      : resolveStrategy(seed.strategy, strategyOverride);
    const statusOverride = overrides.statusOverrides?.[seed.id];
    const rpcList = collectRpcMethods(
      matchedViews,
      matchedControllers,
      rpcByDomain,
      seed.domains ?? [],
    );
    const notes: string[] = [];
    if (strategy === "subtract") {
      const reason = overrides.subtract?.find((s) => s.featureId === seed.id)?.reason;
      if (reason) {
        notes.push(`SUBTRACT: ${reason}`);
      }
    }
    if (overrides.weaveTargets?.[seed.id]) {
      notes.push(`Weave target: ${overrides.weaveTargets[seed.id]}`);
    }
    if (
      !matchedViews.length &&
      !matchedControllers.length &&
      strategy !== "add" &&
      strategy !== "subtract" &&
      !seed.domains?.length
    ) {
      notes.push(
        "WARN: no ControlUI source found — adjust viewHints/controllerHints/domains or overrides.",
      );
    }
    return {
      featureId: seed.id,
      label: manualMap.label ?? seed.label,
      controlUiViews: matchedViews.map((v) => v.file),
      controlUiControllers: matchedControllers.map((c) => c.file),
      rpcMethods: rpcList,
      dexmartRoute: route?.route ?? null,
      dexmartFeatureDir: feature?.file ?? null,
      strategy,
      status: determineStatus(strategy, route, feature, statusOverride),
      notes,
    };
  });
};

const computeGaps = (
  matrix: ParityEntry[],
  rpcMethods: RpcMethod[],
  views: ControlUiView[],
  routes: DexmartRoute[],
): {
  unmappedRpcMethods: string[];
  viewsWithoutFeature: string[];
  routesWithoutControlUiParent: string[];
} => {
  const mappedMethods = new Set(matrix.flatMap((e) => e.rpcMethods));
  const unmappedRpcMethods = rpcMethods
    .map((m) => m.method)
    .filter((m) => !mappedMethods.has(m))
    .toSorted();

  const mappedViews = new Set(matrix.flatMap((e) => e.controlUiViews));
  const viewsWithoutFeature = views
    .filter((v) => !mappedViews.has(v.file))
    .map((v) => v.file)
    .toSorted();

  const mappedRoutes = new Set(matrix.map((e) => e.dexmartRoute).filter(Boolean) as string[]);
  const routesWithoutControlUiParent = routes
    .filter((r) => !mappedRoutes.has(r.route))
    .map((r) => r.route)
    .toSorted();

  return { unmappedRpcMethods, viewsWithoutFeature, routesWithoutControlUiParent };
};

// ---------- Report ----------

const buildReport = (artifact: {
  summary: Record<string, number | string>;
  matrix: ParityEntry[];
  gaps: ReturnType<typeof computeGaps>;
}): string => {
  const rows = artifact.matrix
    .map((e) => {
      const views = e.controlUiViews.length ? `${e.controlUiViews.length} view(s)` : "—";
      return `| ${e.featureId} | ${e.label} | ${e.strategy} | ${e.status} | ${e.dexmartRoute ?? "—"} | ${views} | ${e.rpcMethods.length} methods |`;
    })
    .join("\n");

  return `# ControlUI → DeXMart Parity Matrix Report

Generated from parity-matrix.json. Do NOT hand-edit — rerun \`pnpm tsx scripts/controlui-parity-discover.ts\`.

## Summary

${Object.entries(artifact.summary)
  .map(([k, v]) => `- **${k}**: ${v}`)
  .join("\n")}

## Parity Matrix

| Feature ID | Label | Strategy | Status | DeXMart Route | ControlUI Views | RPC Methods |
|---|---|---|---|---|---|---|
${rows}

## Gaps

### Unmapped RPC Methods (${artifact.gaps.unmappedRpcMethods.length})

Present in Gateway, not linked to any parity feature. Either add to a feature seed or mark internal.

${artifact.gaps.unmappedRpcMethods.map((m) => `- \`${m}\``).join("\n") || "_(none)_"}

### Views Without Parity Target (${artifact.gaps.viewsWithoutFeature.length})

${artifact.gaps.viewsWithoutFeature.map((v) => `- ${v}`).join("\n") || "_(none)_"}

### DeXMart Routes Without ControlUI Parent (${artifact.gaps.routesWithoutControlUiParent.length})

DeXMart-exclusive surfaces. Confirm each matches PROJECT_RULES §0.2 embedding rules.

${artifact.gaps.routesWithoutControlUiParent.map((r) => `- ${r}`).join("\n") || "_(none)_"}
`;
};

// ---------- Main ----------

const gitSha = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: REPO_ROOT }).toString().trim();
  } catch {
    return "unknown";
  }
})();

const CHECK_MODE = process.argv.includes("--check");

const run = (): void => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const overrides = loadOverrides();
  const rpcMethods = extractRpcMethods();
  const views = extractControlUiViews();
  const controllers = extractControlUiControllers();
  const routes = extractDexmartRoutes();
  const features = extractDexmartFeatures();

  const matrix = synthesizeMatrix(rpcMethods, views, controllers, routes, features, overrides);
  const gaps = computeGaps(matrix, rpcMethods, views, routes);

  const rpcDomains = new Set(rpcMethods.map((m) => m.domain));
  const mapped = matrix.filter((e) => e.status !== "missing" || e.strategy === "subtract").length;
  const coveragePct = matrix.length === 0 ? 0 : Math.round((mapped / matrix.length) * 100);

  const artifact = {
    generated_at: new Date().toISOString(),
    source_commit: gitSha,
    summary: {
      rpc_method_count: rpcMethods.length,
      rpc_domain_count: rpcDomains.size,
      controlui_view_count: views.length,
      controlui_controller_count: controllers.length,
      dexmart_route_count: routes.length,
      dexmart_feature_count: features.length,
      parity_feature_count: matrix.length,
      coverage_pct: coveragePct,
    },
    rpc_methods: rpcMethods,
    controlui_views: views,
    controlui_controllers: controllers,
    dexmart_routes: routes,
    dexmart_features: features,
    matrix,
    gaps,
  };

  if (CHECK_MODE) {
    const stripVolatile = (value: string): string => {
      if (!value) {
        return value;
      }
      try {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        delete parsed.generated_at;
        delete parsed.source_commit;
        return JSON.stringify(parsed, null, 2) + "\n";
      } catch {
        return value;
      }
    };
    const existingRaw = stripVolatile(
      fs.existsSync(MATRIX_PATH) ? fs.readFileSync(MATRIX_PATH, "utf8") : "",
    );
    const nextRaw = stripVolatile(JSON.stringify(artifact, null, 2) + "\n");
    const drifted = existingRaw && existingRaw !== nextRaw;
    const hasUnmapped = gaps.unmappedRpcMethods.length > 0;
    if (drifted) {
      process.stderr.write(
        "ERROR: parity-matrix.json is stale. Run: pnpm tsx scripts/controlui-parity-discover.ts\n",
      );
    }
    if (hasUnmapped) {
      process.stderr.write(
        `ERROR: ${gaps.unmappedRpcMethods.length} RPC method(s) not mapped to any parity feature:\n`,
      );
      for (const m of gaps.unmappedRpcMethods) {
        process.stderr.write(`  - ${m}\n`);
      }
      process.stderr.write(
        "Fix: add each to a FEATURE_SEEDS entry in scripts/controlui-parity-discover.ts.\n",
      );
    }
    if (drifted || hasUnmapped) {
      process.exit(1);
    }
    process.stdout.write(
      `OK: parity matrix current, ${rpcMethods.length} methods mapped, ${coveragePct}% coverage.\n`,
    );
    return;
  }

  fs.writeFileSync(MATRIX_PATH, JSON.stringify(artifact, null, 2) + "\n");
  fs.writeFileSync(REPORT_PATH, buildReport({ summary: artifact.summary, matrix, gaps }));

  const lines = [
    `Wrote ${rel(MATRIX_PATH)}`,
    `Wrote ${rel(REPORT_PATH)}`,
    `RPC methods: ${rpcMethods.length} across ${rpcDomains.size} domains`,
    `ControlUI views: ${views.length}, controllers: ${controllers.length}`,
    `DeXMart routes: ${routes.length}, features: ${features.length}`,
    `Coverage: ${coveragePct}% (${mapped}/${matrix.length})`,
    `Unmapped RPC methods: ${gaps.unmappedRpcMethods.length}`,
  ];
  for (const line of lines) {
    process.stdout.write(`${line}\n`);
  }
};

run();
