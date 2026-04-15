import fs from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// DeXMart Upstream Watchtower — OpenClaw Release Intelligence
// ─────────────────────────────────────────────────────────────────────────────
//
// Modes:
//   npx tsx scripts/automation/upstream-watcher.ts
//       → Incremental check (original behavior — fetches latest 10 releases)
//
//   npx tsx scripts/automation/upstream-watcher.ts --gap-analysis
//       → Full gap analysis from last synced version to latest upstream
//
//   npx tsx scripts/automation/upstream-watcher.ts --gap-analysis --from v2026.3.2 --to v2026.4.14
//       → Gap analysis for a specific version range
//
//   Flags:
//     --no-betas     Exclude pre-release/beta tags from the report
//     --dry-run      Print the report to stdout instead of writing to file
// ─────────────────────────────────────────────────────────────────────────────

const UPSTREAM_REPO = 'openclaw/openclaw';
const REPORT_PATH = path.join(process.cwd(), 'docs/OPENCLAW_UPSTREAM_REPORT.md');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// DeXMart's known injection points — files we modified from OpenClaw's originals.
// Any upstream changelog entry mentioning these paths or related APIs is flagged.
const INJECTION_POINTS = [
    { file: 'src/web/session.ts', keywords: ['session.ts', 'createWaSocket', 'WaAuthStateFactory', 'authStateFactory', 'whatsapp.*session', 'baileys'] },
    { file: 'src/types/index.ts', keywords: ['types/index', 'GlobalContext'] },
    { file: 'src/ingress/ingress-service.ts', keywords: ['ingress-service', 'IngressService', 'runEmbeddedPiAgent', 'processMessage'] },
    { file: 'tsconfig.json', keywords: ['tsconfig', 'path alias'] },
    { file: 'src/config/io.ts', keywords: ['config/io', 'loadConfig', 'configManager'] },
    // Phase 5 engine injection points
    { file: 'src/plugins/registry.ts', keywords: ['PluginRegistry', 'PluginRuntime', 'registerPlugin'] },
    { file: 'gateway/server-channels.ts', keywords: ['server-channels', 'createChannelManager', 'channelManager'] },
    { file: 'src/plugins/tools.ts', keywords: ['plugins/tools', 'plugin.*tool'] },
];

// Broader keyword patterns that indicate potential impact on DeXMart's integration surfaces
const DEXMART_IMPACT_KEYWORDS = [
    'plugin.*sdk', 'registerHttp', 'channel.*runtime', 'session.*lifecycle',
    'hook.*event', 'agent.*config', 'model.*selection', 'model.*filter',
    'whatsapp', 'telegram', 'billing', 'tenant', 'multi.?tenant',
    'auth.*state', 'firestore', 'firebase',
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface GithubRelease {
    tag_name: string;
    name: string;
    body: string;
    published_at: string;
    html_url: string;
    prerelease: boolean;
    draft: boolean;
}

interface GithubPR {
    number: number;
    title: string;
    merged_at: string;
    html_url: string;
    user: { login: string };
}

interface ParsedVersion {
    major: number;
    minor: number;
    patch: number;
    beta: number | null; // null = stable, number = beta version
    raw: string;
}

interface ParsedChangelog {
    changes: string[];
    breaking: string[];
    fixes: string[];
    raw: string;
}

interface VersionReport {
    version: ParsedVersion;
    release: GithubRelease;
    changelog: ParsedChangelog;
    injectionPointHits: string[];
    impactHits: string[];
}

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

function parseArgs(): { gapAnalysis: boolean; from: string | null; to: string | null; noBetas: boolean; dryRun: boolean } {
    const args = process.argv.slice(2);
    return {
        gapAnalysis: args.includes('--gap-analysis'),
        from: getArgValue(args, '--from'),
        to: getArgValue(args, '--to'),
        noBetas: args.includes('--no-betas'),
        dryRun: args.includes('--dry-run'),
    };
}

function getArgValue(args: string[], flag: string): string | null {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) return null;
    return args[idx + 1];
}

// ─── Version Parsing & Comparison ────────────────────────────────────────────

function parseVersion(tag: string): ParsedVersion | null {
    // Handles: v2026.3.2, v2026.4.14-beta.1, 2026.3.2
    const match = tag.match(/^v?(\d{4})\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/);
    if (!match) return null;
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        beta: match[4] ? parseInt(match[4], 10) : null,
        raw: tag,
    };
}

/**
 * Compare two parsed versions. Returns:
 *  -1 if a < b
 *   0 if a == b
 *   1 if a > b
 *
 * Betas are considered LESS than the equivalent stable release:
 *   v2026.4.12-beta.1 < v2026.4.12
 */
function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
    if (a.major !== b.major) return a.major < b.major ? -1 : 1;
    if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
    if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
    // Both stable → equal at this level
    if (a.beta === null && b.beta === null) return 0;
    // Stable > beta of same version
    if (a.beta === null) return 1;
    if (b.beta === null) return -1;
    // Both betas
    if (a.beta !== b.beta) return a.beta < b.beta ? -1 : 1;
    return 0;
}

function versionInRange(v: ParsedVersion, from: ParsedVersion, to: ParsedVersion): boolean {
    return compareVersions(v, from) > 0 && compareVersions(v, to) <= 0;
}

// ─── GitHub API ──────────────────────────────────────────────────────────────

async function fetchGithub<T>(endpoint: string): Promise<T> {
    const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
    };
    if (GITHUB_TOKEN) {
        headers.Authorization = `token ${GITHUB_TOKEN}`;
    }

    const url = `https://api.github.com/repos/${UPSTREAM_REPO}${endpoint}`;
    const response = await fetch(url, { headers });

    if (response.status === 403) {
        const remaining = response.headers.get('x-ratelimit-remaining');
        const resetTime = response.headers.get('x-ratelimit-reset');
        if (remaining === '0') {
            const resetDate = resetTime ? new Date(parseInt(resetTime, 10) * 1000) : new Date();
            throw new Error(
                `⚠️  GitHub API rate limit exceeded. Resets at ${resetDate.toISOString()}.\n` +
                `   Set GITHUB_TOKEN env var for higher limits (5000 req/hr vs 60 req/hr).`
            );
        }
    }

    if (!response.ok) {
        throw new Error(`GitHub API Error ${response.status}: ${response.statusText} — ${url}`);
    }

    return response.json() as Promise<T>;
}

/**
 * Fetch ALL releases with pagination (GitHub returns max 100 per page).
 * Stops when we've gone past the `from` version to avoid unnecessary requests.
 */
async function fetchAllReleasesInRange(from: ParsedVersion, to: ParsedVersion): Promise<GithubRelease[]> {
    const allReleases: GithubRelease[] = [];
    let page = 1;
    const perPage = 100;
    let keepFetching = true;

    console.log(`📡 Fetching releases from GitHub (paginated, ${perPage}/page)...`);

    while (keepFetching) {
        const releases = await fetchGithub<GithubRelease[]>(
            `/releases?per_page=${perPage}&page=${page}`
        );

        if (releases.length === 0) break;

        for (const rel of releases) {
            if (rel.draft) continue; // skip drafts

            const v = parseVersion(rel.tag_name);
            if (!v) continue;

            // If we've gone past the `from` boundary (older), stop fetching
            if (compareVersions(v, from) <= 0) {
                // Include the exact `from` boundary entry for context, but mark we should stop
                keepFetching = false;
                break;
            }

            // Check if it falls within range
            if (versionInRange(v, from, to)) {
                allReleases.push(rel);
            }
        }

        page++;

        // Safety: don't fetch more than 10 pages (1000 releases)
        if (page > 10) {
            console.warn('⚠️  Reached 10-page safety limit. Some older releases may be missing.');
            break;
        }
    }

    // Sort oldest → newest for the report
    allReleases.sort((a, b) => {
        const va = parseVersion(a.tag_name);
        const vb = parseVersion(b.tag_name);
        if (!va || !vb) return 0;
        return compareVersions(va, vb);
    });

    return allReleases;
}

// ─── Changelog Parsing ───────────────────────────────────────────────────────

/**
 * Parse a GitHub release body into structured sections.
 * OpenClaw uses: ### Changes, ### Breaking, ### Fixes
 */
function parseChangelog(body: string): ParsedChangelog {
    const result: ParsedChangelog = {
        changes: [],
        breaking: [],
        fixes: [],
        raw: body || '',
    };

    if (!body) return result;

    // Split by ### headers
    const sections = body.split(/^###\s+/m);

    for (const section of sections) {
        const lines = section.trim().split('\n');
        const header = lines[0]?.toLowerCase() || '';
        const items = lines
            .slice(1)
            .filter(l => l.trim().startsWith('-'))
            .map(l => l.trim().replace(/^-\s*/, ''));

        if (header.includes('breaking')) {
            result.breaking.push(...items);
        } else if (header.includes('fix')) {
            result.fixes.push(...items);
        } else if (header.includes('change')) {
            result.changes.push(...items);
        }
    }

    // Also scan for **BREAKING:** markers inline (some releases embed them in Changes)
    if (result.breaking.length === 0) {
        const breakingInline = [...result.changes].filter(c =>
            c.toLowerCase().includes('**breaking**') || c.toLowerCase().includes('breaking:')
        );
        if (breakingInline.length > 0) {
            result.breaking.push(...breakingInline);
            result.changes = result.changes.filter(c =>
                !c.toLowerCase().includes('**breaking**') && !c.toLowerCase().includes('breaking:')
            );
        }
    }

    return result;
}

// ─── Impact Analysis ─────────────────────────────────────────────────────────

/**
 * Scan a changelog body for mentions of DeXMart's injection points.
 * Returns list of matched injection point descriptions.
 */
function detectInjectionPointHits(body: string): string[] {
    if (!body) return [];
    const hits: string[] = [];
    const bodyLower = body.toLowerCase();

    for (const point of INJECTION_POINTS) {
        for (const kw of point.keywords) {
            const regex = new RegExp(kw.replace(/\./g, '\\.').replace(/\*/g, '.*'), 'i');
            if (regex.test(bodyLower)) {
                hits.push(`**${point.file}** (matched: \`${kw}\`)`);
                break; // One hit per injection point is enough
            }
        }
    }

    return hits;
}

/**
 * Scan for broader DeXMart-relevant impact keywords.
 */
function detectImpactHits(body: string): string[] {
    if (!body) return [];
    const hits: string[] = [];
    const bodyLower = body.toLowerCase();

    for (const kw of DEXMART_IMPACT_KEYWORDS) {
        const regex = new RegExp(kw.replace(/\./g, '\\.').replace(/\*/g, '.*'), 'i');
        if (regex.test(bodyLower)) {
            hits.push(kw);
        }
    }

    return [...new Set(hits)]; // dedupe
}

// ─── Report Generation ──────────────────────────────────────────────────────

function generateGapAnalysisReport(reports: VersionReport[], from: string, to: string): string {
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];

    const stableVersions = reports.filter(r => r.version.beta === null);
    const betaVersions = reports.filter(r => r.version.beta !== null);

    const totalChanges = reports.reduce((n, r) => n + r.changelog.changes.length, 0);
    const totalBreaking = reports.reduce((n, r) => n + r.changelog.breaking.length, 0);
    const totalFixes = reports.reduce((n, r) => n + r.changelog.fixes.length, 0);

    const allInjectionHits = reports.filter(r => r.injectionPointHits.length > 0);

    let md = '';

    // ── Header ──
    md += `# OpenClaw Upstream Sync — Gap Analysis Report\n\n`;
    md += `**Generated:** ${timestamp}\n`;
    md += `**Range:** \`${from}\` → \`${to}\`\n`;
    md += `**Upstream Repository:** https://github.com/${UPSTREAM_REPO}\n\n`;

    // ── Summary Stats ──
    md += `---\n\n## 📊 Gap Summary\n\n`;
    md += `| Metric | Count |\n`;
    md += `|--------|-------|\n`;
    md += `| **Stable Releases** | ${stableVersions.length} |\n`;
    md += `| **Beta/Pre-releases** | ${betaVersions.length} |\n`;
    md += `| **Total Changes (Features)** | ${totalChanges} |\n`;
    md += `| **Total Breaking Changes** | ${totalBreaking} |\n`;
    md += `| **Total Fixes** | ${totalFixes} |\n`;
    md += `| **Versions Touching Injection Points** | ${allInjectionHits.length} |\n\n`;

    // ── Risk Assessment ──
    if (totalBreaking > 0 || allInjectionHits.length > 0) {
        md += `> [!WARNING]\n`;
        md += `> **Sync Risk Assessment:**\n`;
        if (totalBreaking > 0) {
            md += `> - ${totalBreaking} breaking change(s) detected across the version range.\n`;
        }
        if (allInjectionHits.length > 0) {
            md += `> - ${allInjectionHits.length} version(s) may affect DeXMart injection points.\n`;
        }
        md += `> \n`;
        md += `> Review the **Injection Point Alerts** section and each flagged version carefully before syncing.\n\n`;
    }

    // ── Injection Point Alerts (consolidated) ──
    if (allInjectionHits.length > 0) {
        md += `---\n\n## 🎯 Injection Point Alerts\n\n`;
        md += `These versions contain changes that **may conflict** with DeXMart's modified files:\n\n`;
        for (const r of allInjectionHits) {
            md += `### ${r.version.raw}\n`;
            for (const hit of r.injectionPointHits) {
                md += `- ${hit}\n`;
            }
            md += `\n`;
        }
    }

    // ── All Breaking Changes (consolidated) ──
    if (totalBreaking > 0) {
        md += `---\n\n## ⚠️ All Breaking Changes\n\n`;
        for (const r of reports) {
            if (r.changelog.breaking.length === 0) continue;
            md += `### ${r.version.raw}\n`;
            for (const item of r.changelog.breaking) {
                md += `- ${item}\n`;
            }
            md += `\n`;
        }
    }

    // ── Recommended Sync Order ──
    md += `---\n\n## 🔄 Recommended Sync Order\n\n`;
    md += `The following is the recommended version-by-version sync sequence.\n`;
    md += `Each version should be merged, conflicts resolved, and tests run before proceeding to the next.\n\n`;

    // Group by stable versions, listing their preceding betas as sub-items
    let syncStep = 1;
    for (const r of stableVersions) {
        const relatedBetas = betaVersions.filter(b =>
            b.version.major === r.version.major &&
            b.version.minor === r.version.minor &&
            b.version.patch === r.version.patch
        );

        const hasAlerts = r.injectionPointHits.length > 0;
        const hasBreaking = r.changelog.breaking.length > 0;
        const riskTag = hasBreaking ? ' ⚠️ BREAKING' : hasAlerts ? ' 🎯 INJECTION ALERT' : '';

        md += `${syncStep}. **${r.version.raw}**${riskTag} — ${r.changelog.changes.length} changes, ${r.changelog.fixes.length} fixes`;
        if (relatedBetas.length > 0) {
            md += ` (includes ${relatedBetas.map(b => b.version.raw).join(', ')})`;
        }
        md += `\n`;
        syncStep++;
    }

    md += `\n`;

    // ── Per-Version Detailed Changelogs ──
    md += `---\n\n## 📋 Detailed Changelogs (Per Version)\n\n`;

    for (const r of reports) {
        const tag = r.version.raw;
        const date = new Date(r.release.published_at).toISOString().split('T')[0];
        const isBeta = r.version.beta !== null;

        md += `---\n\n`;
        md += `### ${isBeta ? '🧪' : '📦'} ${tag} (${date})\n\n`;
        md += `[Release Notes](${r.release.html_url})\n\n`;

        // Injection point alerts for this version
        if (r.injectionPointHits.length > 0) {
            md += `> [!CAUTION]\n`;
            md += `> **Injection Point Impact Detected:**\n`;
            for (const hit of r.injectionPointHits) {
                md += `> - ${hit}\n`;
            }
            md += `\n`;
        }

        // Broader impact keywords
        if (r.impactHits.length > 0) {
            md += `> [!NOTE]\n`;
            md += `> **DeXMart-relevant keywords:** ${r.impactHits.map(k => `\`${k}\``).join(', ')}\n\n`;
        }

        // Breaking changes
        if (r.changelog.breaking.length > 0) {
            md += `#### ⚠️ Breaking Changes\n\n`;
            for (const item of r.changelog.breaking) {
                md += `- ${item}\n`;
            }
            md += `\n`;
        }

        // Changes (features)
        if (r.changelog.changes.length > 0) {
            md += `#### Changes (Features)\n\n`;
            for (const item of r.changelog.changes) {
                md += `- ${item}\n`;
            }
            md += `\n`;
        }

        // Fixes
        if (r.changelog.fixes.length > 0) {
            md += `#### Fixes\n\n`;
            for (const item of r.changelog.fixes) {
                md += `- ${item}\n`;
            }
            md += `\n`;
        }

        if (r.changelog.changes.length === 0 && r.changelog.fixes.length === 0 && r.changelog.breaking.length === 0) {
            md += `*No structured changelog available. See [release notes](${r.release.html_url}).*\n\n`;
        }
    }

    // ── Footer ──
    md += `---\n\n`;
    md += `## 🔍 Status Summary\n\n`;
    md += `1. **DeXMart Last Synced Version:** ${from}\n`;
    md += `2. **Upstream Target Version:** ${to}\n`;
    md += `3. **Versions in Gap:** ${reports.length} (${stableVersions.length} stable, ${betaVersions.length} beta)\n`;
    md += `4. **Breaking Changes:** ${totalBreaking}\n`;
    md += `5. **Injection Point Conflicts:** ${allInjectionHits.length} version(s)\n\n`;
    md += `---\n\n`;
    md += `**Report Generated:** ${timestamp}\n`;
    md += `**Generated By:** \`scripts/automation/upstream-watcher.ts --gap-analysis\`\n`;

    return md;
}

// ─── Main: Gap Analysis Mode ────────────────────────────────────────────────

async function runGapAnalysis(fromTag: string, toTag: string, noBetas: boolean, dryRun: boolean) {
    console.log('🔬 DeXMart Watchtower: Gap Analysis Mode');
    console.log(`   Range: ${fromTag} → ${toTag}`);
    console.log(`   Betas: ${noBetas ? 'excluded' : 'included'}`);

    if (!GITHUB_TOKEN) {
        console.warn('⚠️  No GITHUB_TOKEN set. Using unauthenticated API (60 req/hr limit).');
        console.warn('   Set GITHUB_TOKEN for 5000 req/hr: export GITHUB_TOKEN=ghp_...');
    }

    const from = parseVersion(fromTag);
    const to = parseVersion(toTag);

    if (!from || !to) {
        console.error(`❌ Invalid version format. Expected: v2026.3.2 or 2026.4.14`);
        console.error(`   Got: from=${fromTag}, to=${toTag}`);
        process.exit(1);
    }

    if (compareVersions(from, to) >= 0) {
        console.error(`❌ --from version must be older than --to version.`);
        process.exit(1);
    }

    // 1. Fetch all releases in range
    let releases = await fetchAllReleasesInRange(from, to);
    console.log(`📦 Found ${releases.length} releases in range.`);

    if (noBetas) {
        const beforeCount = releases.length;
        releases = releases.filter(r => !r.prerelease);
        console.log(`   Filtered betas: ${beforeCount} → ${releases.length} stable releases.`);
    }

    if (releases.length === 0) {
        console.log('⚠️  No releases found in the specified range.');
        console.log('   Double-check the --from and --to version tags.');
        return;
    }

    // 2. Parse and analyze each release
    console.log('🔍 Analyzing changelogs and scanning for injection point conflicts...');
    const reports: VersionReport[] = [];

    for (const rel of releases) {
        const version = parseVersion(rel.tag_name);
        if (!version) continue;

        const changelog = parseChangelog(rel.body);
        const injectionPointHits = detectInjectionPointHits(rel.body);
        const impactHits = detectImpactHits(rel.body);

        reports.push({ version, release: rel, changelog, injectionPointHits, impactHits });

        const alertIcon = injectionPointHits.length > 0 ? '🎯' :
            changelog.breaking.length > 0 ? '⚠️' : '✅';
        console.log(`   ${alertIcon} ${rel.tag_name}: ${changelog.changes.length}C / ${changelog.breaking.length}B / ${changelog.fixes.length}F`);
    }

    // 3. Generate report
    console.log('\n📝 Generating gap analysis report...');
    const report = generateGapAnalysisReport(reports, fromTag, toTag);

    if (dryRun) {
        console.log('\n--- DRY RUN: Report content follows ---\n');
        console.log(report);
        return;
    }

    // Write report (replaces the existing OPENCLAW_UPSTREAM_REPORT.md)
    fs.writeFileSync(REPORT_PATH, report, 'utf8');
    console.log(`\n✅ Gap analysis report written to: ${REPORT_PATH}`);
    console.log(`   ${reports.length} versions analyzed.`);

    // Print summary counts
    const totalBreaking = reports.reduce((n, r) => n + r.changelog.breaking.length, 0);
    const injectionConflicts = reports.filter(r => r.injectionPointHits.length > 0).length;
    if (totalBreaking > 0) {
        console.log(`   ⚠️  ${totalBreaking} BREAKING CHANGES detected — review before syncing!`);
    }
    if (injectionConflicts > 0) {
        console.log(`   🎯 ${injectionConflicts} versions touch DeXMart injection points — manual conflict resolution required.`);
    }
}

// ─── Main: Incremental Mode (Original Behavior) ─────────────────────────────

async function updateReport() {
    console.log('🚀 DeXMart Watchtower: Incremental Sync...');

    if (!fs.existsSync(REPORT_PATH)) {
        console.error(`❌ Error: Report file not found at ${REPORT_PATH}`);
        process.exit(1);
    }

    const existingContent = fs.readFileSync(REPORT_PATH, 'utf8');

    const releases: GithubRelease[] = await fetchGithub('/releases?per_page=10');
    const pulls: GithubPR[] = await fetchGithub('/pulls?state=closed&base=main&per_page=30');
    const mergedPulls = pulls.filter(pr => pr.merged_at);

    // 1. Identify New Releases (Using exact tag matching)
    const newReleases = releases.filter(rel => {
        const tagRegex = new RegExp(`\\b${rel.tag_name}\\b`);
        return !tagRegex.test(existingContent);
    });

    // 2. Identify New PRs (Using word boundaries for numbers)
    const newPRs = mergedPulls.filter(pr => {
        const prRegex = new RegExp(`#${pr.number}\\b`);
        return !prRegex.test(existingContent);
    });

    if (newReleases.length === 0 && newPRs.length === 0) {
        console.log('✅ No new upstream activity. Fusion ledger is current.');
        return;
    }

    console.log(`✨ Discovery: ${newReleases.length} releases, ${newPRs.length} merged PRs found.`);

    let updatedContent = existingContent;

    // Surgical Release Insertion (Matching existing row format)
    if (newReleases.length > 0) {
        const releaseHeader = '## 🚀 Latest Releases';
        let releaseEntries = '';
        newReleases.forEach(rel => {
            // Format: openclaw 2026.3.2\tLatest\tv2026.3.2\t2026-03-03T04:43:00Z
            const version = rel.tag_name.replace(/^v/, '');
            releaseEntries += `openclaw ${version}\tLatest\t${rel.tag_name}\t${rel.published_at}\n`;
        });

        if (updatedContent.includes(releaseHeader)) {
            updatedContent = updatedContent.replace(releaseHeader, `${releaseHeader}\n\n${releaseEntries.trim()}`);
        }
    }

    // Surgical Pending Fusion Insertion
    if (newPRs.length > 0) {
        const pendingHeader = '## 📥 Pending Fusion (New Upstream Activity)';
        let prEntries = '';
        newPRs.forEach(pr => {
            prEntries += `- [ ] #${pr.number} ${pr.title} (${new Date(pr.merged_at).toLocaleDateString()}) @${pr.user.login} [View](${pr.html_url})\n`;
        });

        if (updatedContent.includes(pendingHeader)) {
            updatedContent = updatedContent.replace(pendingHeader, `${pendingHeader}\n${prEntries.trim()}`);
        } else {
            const syncHeader = '## ✅ Recently Synchronized';
            if (updatedContent.includes(syncHeader)) {
                updatedContent = updatedContent.replace(syncHeader, `${pendingHeader}\n${prEntries}\n\n${syncHeader}`);
            } else {
                updatedContent += `\n\n${pendingHeader}\n${prEntries}`;
            }
        }
    }

    // Timestamp Update
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    updatedContent = updatedContent.replace(/Generated on:\*\* .*/, `Generated on:** ${timestamp}`);
    updatedContent = updatedContent.replace(/Report Updated:\*\* .*/, `Report Updated:** ${timestamp}`);

    fs.writeFileSync(REPORT_PATH, updatedContent);
    console.log(`✅ Success: Intelligence Ledger updated safely.`);
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

async function main() {
    const args = parseArgs();

    if (args.gapAnalysis) {
        // Determine range — use defaults if not provided
        const fromTag = args.from || 'v2026.3.1';  // Our last subtree merge
        const toTag = args.to || 'v2026.4.14';      // Current latest as of writing

        await runGapAnalysis(fromTag, toTag, args.noBetas, args.dryRun);
    } else {
        await updateReport();
    }
}

main().catch(err => {
    console.error('❌ Critical Error during Watchtower execution:', err);
    process.exit(1);
});
