/**
 * migrate-tenants-to-users.test.ts
 *
 * TDD tests for the Firestore path migration script.
 * Migrates data from tenants/{tenantId}/ to users/{userId}/ (same IDs, new root).
 *
 * All Firestore interactions are mocked — no real Firebase connections.
 */

import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';

// ── Firestore mock infrastructure ─────────────────────────────────────────────

/** Simulated Firestore document */
interface MockDoc {
  id: string;
  data: Record<string, unknown>;
  subcollections?: string[];
}

/** Simulated Firestore collection */
type MockCollection = Record<string, MockDoc>;

/** In-memory Firestore state for tests */
let firestoreState: {
  tenants: Record<string, { docs: MockCollection; subcollections: Record<string, MockCollection> }>;
  users: Record<string, { docs: MockCollection; subcollections: Record<string, MockCollection> }>;
};

function resetState() {
  firestoreState = {
    tenants: {},
    users: {},
  };
}

// Counts of Firestore write calls
let writeCalls: Array<{ path: string; data: Record<string, unknown> }>;
let logOutput: string[];

// ── Mock logger ───────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn((msg: string) => { logOutput.push(`INFO: ${msg}`); }),
  warn: vi.fn((msg: string) => { logOutput.push(`WARN: ${msg}`); }),
  error: vi.fn((msg: string) => { logOutput.push(`ERROR: ${msg}`); }),
};

// ── Migration module under test ───────────────────────────────────────────────

// We test the migration functions directly (pure logic layer), not the CLI entry point.
// The module exports its core functions for testability.
import type {
  MigrationOptions,
  MigrationResult,
  MigrationStats,
} from '../migrate-tenants-to-users.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

function seedTenant(
  tenantId: string,
  docs: MockCollection,
  subcollections: Record<string, MockCollection> = {},
) {
  firestoreState.tenants[tenantId] = { docs, subcollections };
}

function getUserDocs(userId: string): MockCollection {
  return firestoreState.users[userId]?.docs ?? {};
}

function getUserSubcollection(userId: string, subcollection: string): MockCollection {
  return firestoreState.users[userId]?.subcollections[subcollection] ?? {};
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('migrate-tenants-to-users — dry-run mode', () => {
  beforeEach(() => {
    resetState();
    writeCalls = [];
    logOutput = [];
    vi.clearAllMocks();
  });

  it('dry-run logs operations without writing to Firestore', async () => {
    seedTenant('tenant-abc', {
      'bot-1': { id: 'bot-1', data: { name: 'BotAlpha', status: 'active' } },
    });

    const { runMigration } = await import('../migrate-tenants-to-users.js');
    const result = await runMigration(
      { dryRun: true, tenantIds: ['tenant-abc'], firestoreState, writeCalls, logger: mockLogger },
    );

    // No actual writes
    expect(writeCalls).toHaveLength(0);
    expect(getUserDocs('tenant-abc')).toEqual({});

    // But operations were logged
    expect(result.stats.documentsLogged).toBeGreaterThan(0);
    expect(result.stats.documentsWritten).toBe(0);
    expect(logOutput.some((l) => l.includes('tenant-abc'))).toBe(true);
  });

  it('dry-run is the default when dryRun option is omitted', async () => {
    seedTenant('tenant-xyz', {
      'msg-1': { id: 'msg-1', data: { text: 'hello' } },
    });

    const { runMigration } = await import('../migrate-tenants-to-users.js');
    const result = await runMigration(
      { tenantIds: ['tenant-xyz'], firestoreState, writeCalls, logger: mockLogger },
    );

    expect(writeCalls).toHaveLength(0);
    expect(result.stats.documentsWritten).toBe(0);
  });
});

describe('migrate-tenants-to-users — live migration', () => {
  beforeEach(() => {
    resetState();
    writeCalls = [];
    logOutput = [];
    vi.clearAllMocks();
  });

  it('copies all root documents from tenants/{id}/ to users/{id}/', async () => {
    seedTenant('tenant-alpha', {
      'bot-1': { id: 'bot-1', data: { name: 'BotAlpha', plan: 'pro' } },
      'bot-2': { id: 'bot-2', data: { name: 'BotBeta', plan: 'free' } },
    });

    const { runMigration } = await import('../migrate-tenants-to-users.js');
    await runMigration({
      dryRun: false,
      tenantIds: ['tenant-alpha'],
      firestoreState,
      writeCalls,
      logger: mockLogger,
    });

    // Documents copied to users/
    const userDocs = getUserDocs('tenant-alpha');
    expect(userDocs['bot-1']).toBeDefined();
    expect(userDocs['bot-1'].data.name).toBe('BotAlpha');
    expect(userDocs['bot-2']).toBeDefined();
  });

  it('copies all subcollections from tenants/{id}/{sub}/ to users/{id}/{sub}/', async () => {
    seedTenant(
      'tenant-beta',
      { 'root-doc': { id: 'root-doc', data: { type: 'profile' } } },
      {
        messages: {
          'msg-1': { id: 'msg-1', data: { text: 'Hello world', ts: 1234567890 } },
          'msg-2': { id: 'msg-2', data: { text: 'Reply', ts: 1234567891 } },
        },
        agents: {
          'agent-1': { id: 'agent-1', data: { model: 'gemini-2.0-flash', active: true } },
        },
      },
    );

    const { runMigration } = await import('../migrate-tenants-to-users.js');
    await runMigration({
      dryRun: false,
      tenantIds: ['tenant-beta'],
      firestoreState,
      writeCalls,
      logger: mockLogger,
    });

    const messages = getUserSubcollection('tenant-beta', 'messages');
    expect(messages['msg-1']).toBeDefined();
    expect(messages['msg-1'].data.text).toBe('Hello world');
    expect(messages['msg-2']).toBeDefined();

    const agents = getUserSubcollection('tenant-beta', 'agents');
    expect(agents['agent-1']).toBeDefined();
    expect(agents['agent-1'].data.model).toBe('gemini-2.0-flash');
  });

  it('preserves all field values during migration (no data loss)', async () => {
    const originalData = {
      name: 'TestBot',
      config: { antiBan: true, maxRetries: 3 },
      createdAt: new Date('2026-01-01').toISOString(),
      tags: ['production', 'whatsapp'],
    };
    seedTenant('tenant-gamma', {
      'bot-1': { id: 'bot-1', data: originalData },
    });

    const { runMigration } = await import('../migrate-tenants-to-users.js');
    await runMigration({
      dryRun: false,
      tenantIds: ['tenant-gamma'],
      firestoreState,
      writeCalls,
      logger: mockLogger,
    });

    const copied = getUserDocs('tenant-gamma')['bot-1'].data;
    expect(copied).toEqual(originalData);
  });

  it('document counts match after migration (integrity check)', async () => {
    seedTenant(
      'tenant-delta',
      {
        'doc-1': { id: 'doc-1', data: { x: 1 } },
        'doc-2': { id: 'doc-2', data: { x: 2 } },
        'doc-3': { id: 'doc-3', data: { x: 3 } },
      },
      {
        channels: {
          'ch-1': { id: 'ch-1', data: { type: 'whatsapp' } },
          'ch-2': { id: 'ch-2', data: { type: 'discord' } },
        },
      },
    );

    const { runMigration } = await import('../migrate-tenants-to-users.js');
    const result = await runMigration({
      dryRun: false,
      tenantIds: ['tenant-delta'],
      firestoreState,
      writeCalls,
      logger: mockLogger,
    });

    expect(result.stats.documentsWritten).toBe(5); // 3 root + 2 subcollection
    expect(result.stats.documentsLogged).toBe(5);

    // Verify counts match
    const userDocs = getUserDocs('tenant-delta');
    expect(Object.keys(userDocs)).toHaveLength(3);
    const channels = getUserSubcollection('tenant-delta', 'channels');
    expect(Object.keys(channels)).toHaveLength(2);
  });
});

describe('migrate-tenants-to-users — idempotency', () => {
  beforeEach(() => {
    resetState();
    writeCalls = [];
    logOutput = [];
    vi.clearAllMocks();
  });

  it('second run produces zero new writes (idempotent)', async () => {
    seedTenant('tenant-idem', {
      'doc-1': { id: 'doc-1', data: { val: 42 } },
    });

    const { runMigration } = await import('../migrate-tenants-to-users.js');
    const opts = {
      dryRun: false,
      tenantIds: ['tenant-idem'],
      firestoreState,
      writeCalls,
      logger: mockLogger,
    };

    const firstRun = await runMigration(opts);
    const firstWriteCount = writeCalls.length;

    const secondRun = await runMigration(opts);
    const secondWriteCount = writeCalls.length - firstWriteCount;

    expect(firstRun.stats.documentsWritten).toBe(1);
    expect(secondRun.stats.documentsWritten).toBe(0); // No new writes — already exists
    expect(secondWriteCount).toBe(0);
  });
});

describe('migrate-tenants-to-users — multi-tenant batch', () => {
  beforeEach(() => {
    resetState();
    writeCalls = [];
    logOutput = [];
    vi.clearAllMocks();
  });

  it('migrates multiple tenants in a single run', async () => {
    seedTenant('tenant-a', { 'doc-a': { id: 'doc-a', data: { src: 'a' } } });
    seedTenant('tenant-b', { 'doc-b': { id: 'doc-b', data: { src: 'b' } } });
    seedTenant('tenant-c', { 'doc-c': { id: 'doc-c', data: { src: 'c' } } });

    const { runMigration } = await import('../migrate-tenants-to-users.js');
    const result = await runMigration({
      dryRun: false,
      tenantIds: ['tenant-a', 'tenant-b', 'tenant-c'],
      firestoreState,
      writeCalls,
      logger: mockLogger,
    });

    expect(result.stats.tenantsProcessed).toBe(3);
    expect(result.stats.documentsWritten).toBe(3);
    expect(getUserDocs('tenant-a')['doc-a']).toBeDefined();
    expect(getUserDocs('tenant-b')['doc-b']).toBeDefined();
    expect(getUserDocs('tenant-c')['doc-c']).toBeDefined();
  });
});
