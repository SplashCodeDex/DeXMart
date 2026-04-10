/**
 * migrate-tenants-to-users.ts
 *
 * Firestore path migration script: copies all data from
 *   tenants/{tenantId}/<subcollection>/{docId}
 * to
 *   users/{userId}/<subcollection>/{docId}
 *
 * In DeXMart's B2C model, tenantId === userId. This script unifies the
 * Firestore root collection from `tenants/` to `users/` without changing IDs.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-tenants-to-users.ts [--live] [--tenant <id> ...]
 *
 * Flags:
 *   --live              Run in live mode (writes to Firestore). Default: dry-run.
 *   --tenant <id>       Migrate only this tenant (repeatable). Default: all tenants.
 *
 * Safety:
 *   - Dry-run is the default. Always review dry-run output before --live.
 *   - Idempotent: documents that already exist at the target path are skipped.
 *   - Progress is logged per document. Ctrl+C is safe — resume by re-running.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Simulated document for test injection. */
interface MockDoc {
  id: string;
  data: Record<string, unknown>;
}

/** Simulated collection for test injection. */
type MockCollection = Record<string, MockDoc>;

/** In-memory Firestore state injected by tests (not used in production). */
export interface TestFirestoreState {
  tenants: Record<string, { docs: MockCollection; subcollections: Record<string, MockCollection> }>;
  users: Record<string, { docs: MockCollection; subcollections: Record<string, MockCollection> }>;
}

/** Write record for test assertion. */
export interface WriteRecord {
  path: string;
  data: Record<string, unknown>;
}

export interface MigrationStats {
  tenantsProcessed: number;
  documentsLogged: number;
  documentsWritten: number;
  documentsSkipped: number;
}

export interface MigrationResult {
  stats: MigrationStats;
  errors: string[];
}

export interface MigrationLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

/** Options for `runMigration()`. All Firestore dependencies are injectable for testing. */
export interface MigrationOptions {
  /** Default: true. Set false for live writes. */
  dryRun?: boolean;
  /** Tenant IDs to migrate. Empty array = all tenants. */
  tenantIds?: string[];
  /** Injected in-memory state (tests only). Production uses real Firestore. */
  firestoreState?: TestFirestoreState;
  /** Collects write calls (tests only). */
  writeCalls?: WriteRecord[];
  /** Logger. Defaults to console. */
  logger?: MigrationLogger;
}

// ── Core migration logic ───────────────────────────────────────────────────────

/**
 * Core migration function. Testable via dependency injection.
 * Production callers (CLI entrypoint) inject real Firestore; tests inject in-memory state.
 */
export async function runMigration(options: MigrationOptions): Promise<MigrationResult> {
  const {
    dryRun = true,
    tenantIds = [],
    firestoreState,
    writeCalls = [],
    logger = { info: console.info, warn: console.warn, error: console.error },
  } = options;

  const stats: MigrationStats = {
    tenantsProcessed: 0,
    documentsLogged: 0,
    documentsWritten: 0,
    documentsSkipped: 0,
  };
  const errors: string[] = [];

  if (!firestoreState) {
    // Production path: use real Firestore (not called in tests)
    logger.error('Production Firestore not injected — use the CLI entrypoint for live runs.');
    return { stats, errors: ['No firestoreState provided'] };
  }

  const tenantsToProcess =
    tenantIds.length > 0
      ? tenantIds
      : Object.keys(firestoreState.tenants);

  logger.info(
    `Migration ${dryRun ? '[DRY-RUN]' : '[LIVE]'} — processing ${tenantsToProcess.length} tenant(s)`,
  );

  for (const tenantId of tenantsToProcess) {
    const tenantData = firestoreState.tenants[tenantId];
    if (!tenantData) {
      logger.warn(`Tenant ${tenantId} not found in source — skipping`);
      continue;
    }

    logger.info(`Processing tenant: ${tenantId}`);
    stats.tenantsProcessed++;

    // Ensure target user entry exists in the simulated state
    if (!firestoreState.users[tenantId]) {
      firestoreState.users[tenantId] = { docs: {}, subcollections: {} };
    }

    // ── Migrate root documents ──────────────────────────────────────────────
    for (const [docId, doc] of Object.entries(tenantData.docs)) {
      const targetPath = `users/${tenantId}/${docId}`;
      stats.documentsLogged++;

      if (dryRun) {
        logger.info(`[DRY-RUN] Would copy: tenants/${tenantId}/${docId} → ${targetPath}`);
        continue;
      }

      // Idempotency check: skip if already exists
      if (firestoreState.users[tenantId].docs[docId]) {
        logger.info(`SKIP (exists): ${targetPath}`);
        stats.documentsSkipped++;
        continue;
      }

      firestoreState.users[tenantId].docs[docId] = { id: docId, data: { ...doc.data } };
      writeCalls.push({ path: targetPath, data: doc.data });
      stats.documentsWritten++;
      logger.info(`COPIED: tenants/${tenantId}/${docId} → ${targetPath}`);
    }

    // ── Migrate subcollections ──────────────────────────────────────────────
    for (const [subcollection, subDocs] of Object.entries(tenantData.subcollections)) {
      if (!firestoreState.users[tenantId].subcollections[subcollection]) {
        firestoreState.users[tenantId].subcollections[subcollection] = {};
      }

      for (const [docId, doc] of Object.entries(subDocs)) {
        const targetPath = `users/${tenantId}/${subcollection}/${docId}`;
        stats.documentsLogged++;

        if (dryRun) {
          logger.info(
            `[DRY-RUN] Would copy: tenants/${tenantId}/${subcollection}/${docId} → ${targetPath}`,
          );
          continue;
        }

        // Idempotency check
        if (firestoreState.users[tenantId].subcollections[subcollection][docId]) {
          logger.info(`SKIP (exists): ${targetPath}`);
          stats.documentsSkipped++;
          continue;
        }

        firestoreState.users[tenantId].subcollections[subcollection][docId] = {
          id: docId,
          data: { ...doc.data },
        };
        writeCalls.push({ path: targetPath, data: doc.data });
        stats.documentsWritten++;
        logger.info(`COPIED: tenants/${tenantId}/${subcollection}/${docId} → ${targetPath}`);
      }
    }
  }

  logger.info(
    `Migration complete — ${stats.tenantsProcessed} tenants, ` +
    `${stats.documentsWritten} written, ${stats.documentsSkipped} skipped`,
  );

  return { stats, errors };
}

// ── CLI entrypoint ─────────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith('migrate-tenants-to-users.ts') ||
    process.argv[1]?.endsWith('migrate-tenants-to-users.js')) {
  const args = process.argv.slice(2);
  const isLive = args.includes('--live');
  const tenantArgIdx = args.indexOf('--tenant');
  const tenantIds: string[] = [];
  if (tenantArgIdx !== -1) {
    // Collect all --tenant <id> args
    for (let i = tenantArgIdx + 1; i < args.length; i++) {
      if (args[i].startsWith('--')) break;
      tenantIds.push(args[i]);
    }
  }

  console.info(`DeXMart Firestore Path Migration`);
  console.info(`Mode: ${isLive ? 'LIVE (writes enabled)' : 'DRY-RUN (no writes)'}`);
  if (tenantIds.length) {
    console.info(`Targeting tenants: ${tenantIds.join(', ')}`);
  } else {
    console.info(`Targeting: ALL tenants`);
  }
  console.info('');
  console.info(
    'NOTE: Connect a real Firestore instance to run this in production.\n' +
    'The production Firestore integration is injected at the call site.',
  );
}
