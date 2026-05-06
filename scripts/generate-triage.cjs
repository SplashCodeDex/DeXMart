const fs = require("fs");
const path = require("path");

const logContent = fs.readFileSync("test-triage-raw.log", "utf8");

// Strip ANSI escape codes
const cleanLog = logContent.replace(
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
  "",
);

// Extract all FAIL lines
const failRegex = /FAIL\s+(src\/[^\s>]+)/g;
let match;
const failingFiles = new Set();
while ((match = failRegex.exec(cleanLog)) !== null) {
  failingFiles.add(match[1]);
}

const categories = {
  A: {
    name: "OpenClaw Engine Internal Tests",
    patterns: [
      "src/agents/",
      "src/cron/",
      "src/auto-reply/",
      "src/browser/",
      "src/infra/",
      "src/commands/",
      "src/config/",
      "src/gateway/",
    ],
    files: [],
    rootCause:
      "These are OpenClaw upstream tests that depend on internal mocking infrastructure and test utilities that weren't fully ported during the Phase 1 repository restructure.",
    remediation:
      "Audit which tests cover functionality DeXMart actually uses → fix those → mark remainder as .skip with // upstream: not yet ported annotation.",
  },
  B: {
    name: "Telegram Module",
    patterns: ["src/telegram/"],
    files: [],
    rootCause:
      "Mixed — webhook tests time out at 5000ms, createTelegramBot mock returns incompatible shape, resolveTelegramFetch tests expect specific undici dispatcher behavior.",
    remediation:
      "Fix webhook mock to resolve/reject properly; update createTelegramBot mock shape; increase timeout or fix async flow.",
  },
  C: {
    name: "Baileys/Session Mocks",
    patterns: ["src/web/session.test.ts", "src/web/test-helpers.ts"], // or anything with Invalid Baileys socket getter
    files: [],
    rootCause:
      "getLastSocket() throws Invalid Baileys socket getter because session.ts changed socket creation flow in Phase 5.",
    remediation:
      "Update test-helpers.ts getLastSocket() to handle the new SaaS-mode socket creation path.",
  },
  D: {
    name: "Stale DeXMart Service Tests",
    patterns: [
      "src/services/IngressService",
      "authMiddleware",
      "jobs/index",
      "flowEngine.skill",
      "src/controllers/",
      "src/routes/channelLifecycle",
    ],
    files: [],
    rootCause:
      "Tests assert pre-Phase 4/5 behavior (e.g., IngressService expects unifiedAI.processMessage()).",
    remediation: "Update test expectations to match current production code behavior.",
  },
  E: {
    name: "Security Module",
    patterns: ["src/security/"],
    files: [],
    rootCause:
      "DM policy tests and security audit tests expect configurations/interfaces that changed in OpenClaw upstream.",
    remediation: "Verify current DM policy behavior → update test expectations.",
  },
  F: {
    name: "Miscellaneous Channel Tests",
    patterns: [
      "src/signal/",
      "src/slack/",
      "src/line/",
      "src/discord/",
      "src/facebook/",
      "src/wizard/",
      "src/tools/cmd.test.ts",
      "src/analytics/",
      "src/hooks/",
    ],
    files: [],
    rootCause: "Various mock/import issues across miscellaneous channels.",
    remediation: "Fix on a per-file basis.",
  },
};

const uncategorized = [];

for (const file of failingFiles) {
  let categorized = false;

  if (!categorized && file.includes("test-helpers.ts")) {
    categories.C.files.push(file);
    categorized = true;
  }
  if (
    !categorized &&
    ["session.test.ts", "session"].some((p) => file.includes(p) && file.includes("src/web/"))
  ) {
    categories.C.files.push(file);
    categorized = true;
  }

  for (const [cat, data] of Object.entries(categories)) {
    if (categorized) break;
    if (data.patterns.some((p) => file.includes(p))) {
      data.files.push(file);
      categorized = true;
      break;
    }
  }
  if (!categorized) {
    if (file.includes("src/analytics/") || file.includes("src/hooks/")) {
      categories.F.files.push(file);
    } else {
      uncategorized.push(file);
    }
  }
}

let md = "# Test Suite Triage Report\n\n";
md += "## Overview\nTotal Failing Files: " + failingFiles.size + "\n\n";

for (const [cat, data] of Object.entries(categories)) {
  md += `### Category ${cat}: ${data.name} (${data.files.length} files)\n`;
  md += `**Root Cause**: ${data.rootCause}\n\n`;
  md += `**Remediation Action**: ${data.remediation}\n\n`;
  md += `**Failing Files**:\n`;
  data.files.forEach((f) => (md += `- \`${f}\`\n`));
  md += "\n";
}

if (uncategorized.length > 0) {
  md += `### Miscellaneous / Uncategorized (${uncategorized.length} files)\n`;
  uncategorized.forEach((f) => (md += `- \`${f}\`\n`));
}

fs.mkdirSync("docs/session-logs", { recursive: true });
fs.writeFileSync("docs/session-logs/test-triage-report.md", md);
console.log("Triage report generated.");
