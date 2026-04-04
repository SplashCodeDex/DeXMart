/**
 * Tests for src/memory/hybrid-adapter.ts
 *
 * Strategy:
 *   - Mock MemorySearchManager (inner), Firestore client, embedAndInsert, pruneToLimit
 *   - Test remember(): Firestore sync, local embed, prune
 *   - Test search(): lazy rehydration on cold start, delegates to inner
 *   - Test rehydration: fetches from Firestore, re-embeds, skips if already done
 *   - Test error resilience: Firestore failures are non-fatal
 *   - Test status(): passes through inner + adds hybrid metadata
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HybridMemoryAdapter } from './hybrid-adapter.js';
import type { MemorySearchManager, MemorySearchResult } from './types.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makeInner(): MemorySearchManager {
  return {
    search: vi.fn().mockResolvedValue([{ text: 'result', score: 0.9, path: '/mem', startLine: 0, endLine: 1, snippet: 'result', source: 'memory' }] as MemorySearchResult[]),
    readFile: vi.fn().mockResolvedValue({ text: 'file content', path: '/mem' }),
    status: vi.fn().mockReturnValue({ backend: 'builtin', provider: 'local', custom: {} }),
    probeEmbeddingAvailability: vi.fn().mockResolvedValue({ ok: true }),
    probeVectorAvailability: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(undefined),
    sync: vi.fn().mockResolvedValue(undefined),
  };
}

function makeFirestore(docs: Array<{ id: string; text: string }> = []) {
  const addMock = vi.fn().mockResolvedValue({ id: 'new-doc-id' });
  const getMock = vi.fn().mockResolvedValue({
    docs: docs.map(d => ({ id: d.id, data: () => ({ text: d.text, createdAt: new Date().toISOString() }) })),
  });
  return {
    client: {
      collection: vi.fn().mockReturnValue({
        add: addMock,
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({ get: getMock }),
        }),
        doc: vi.fn(),
      }),
    },
    addMock,
    getMock,
  };
}

function makeAdapter(opts: {
  firestoreDocs?: Array<{ id: string; text: string }>;
  maxLocalItems?: number;
} = {}) {
  const inner = makeInner();
  const { client, addMock, getMock } = makeFirestore(opts.firestoreDocs ?? []);
  const embedAndInsert = vi.fn().mockResolvedValue(undefined);
  const pruneToLimit = vi.fn().mockResolvedValue(undefined);

  const adapter = new HybridMemoryAdapter(
    'user-123',
    inner,
    client as any,
    embedAndInsert,
    pruneToLimit,
    { maxLocalItems: opts.maxLocalItems ?? 10 },
  );

  return { adapter, inner, client, addMock, getMock, embedAndInsert, pruneToLimit };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HybridMemoryAdapter.remember()', () => {
  it('embeds text locally', async () => {
    const { adapter, embedAndInsert } = makeAdapter();
    await adapter.remember('hello world');
    expect(embedAndInsert).toHaveBeenCalledWith('hello world', {});
  });

  it('applies 5-10 rule (pruneToLimit) after insert', async () => {
    const { adapter, pruneToLimit } = makeAdapter({ maxLocalItems: 10 });
    await adapter.remember('test memory');
    expect(pruneToLimit).toHaveBeenCalledWith(10);
  });

  it('syncs text to Firestore (non-blocking)', async () => {
    const { adapter, addMock } = makeAdapter();
    await adapter.remember('sync me');
    // Give the fire-and-forget a tick to settle
    await new Promise(r => setTimeout(r, 10));
    expect(addMock).toHaveBeenCalledWith(expect.objectContaining({ text: 'sync me', userId: 'user-123' }));
  });

  it('does not throw when Firestore sync fails', async () => {
    const { adapter, client } = makeAdapter();
    (client.collection as any).mockReturnValue({
      add: vi.fn().mockRejectedValue(new Error('Firestore down')),
      orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ docs: [] }) }) }),
    });
    await expect(adapter.remember('resilience test')).resolves.toBeUndefined();
  });

  it('passes metadata to embedAndInsert', async () => {
    const { adapter, embedAndInsert } = makeAdapter();
    await adapter.remember('with metadata', { sessionId: 'sess-1', source: 'chat' });
    expect(embedAndInsert).toHaveBeenCalledWith('with metadata', { sessionId: 'sess-1', source: 'chat' });
  });
});

describe('HybridMemoryAdapter.search()', () => {
  it('delegates to inner.search after rehydration', async () => {
    const { adapter, inner } = makeAdapter();
    const results = await adapter.search('find something');
    expect(inner.search).toHaveBeenCalledWith('find something', undefined);
    expect(results).toHaveLength(1);
    expect(results[0].text).toBe('result');
  });

  it('rehydrates from Firestore on cold start (first search)', async () => {
    const { adapter, embedAndInsert, getMock } = makeAdapter({
      firestoreDocs: [
        { id: 'doc1', text: 'memory one' },
        { id: 'doc2', text: 'memory two' },
      ],
    });
    await adapter.search('query');
    expect(getMock).toHaveBeenCalledOnce();
    // Should have re-embedded both docs
    expect(embedAndInsert).toHaveBeenCalledTimes(2);
    expect(embedAndInsert).toHaveBeenCalledWith('memory one', expect.any(Object));
    expect(embedAndInsert).toHaveBeenCalledWith('memory two', expect.any(Object));
  });

  it('does not rehydrate on second search', async () => {
    const { adapter, getMock } = makeAdapter({
      firestoreDocs: [{ id: 'doc1', text: 'memory' }],
    });
    await adapter.search('first');
    await adapter.search('second');
    // Firestore should only be called once (first search triggers rehydration)
    expect(getMock).toHaveBeenCalledOnce();
  });

  it('continues if rehydration fails (non-fatal)', async () => {
    const inner = makeInner();
    const embedAndInsert = vi.fn().mockResolvedValue(undefined);
    const pruneToLimit = vi.fn().mockResolvedValue(undefined);
    const brokenFirestore = {
      collection: vi.fn().mockReturnValue({
        add: vi.fn(),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockRejectedValue(new Error('Firestore unavailable')),
          }),
        }),
      }),
    };

    const adapter = new HybridMemoryAdapter(
      'user-123', inner, brokenFirestore as any, embedAndInsert, pruneToLimit,
    );

    await expect(adapter.search('query')).resolves.toBeDefined();
    expect(inner.search).toHaveBeenCalledOnce();
  });
});

describe('HybridMemoryAdapter.status()', () => {
  it('returns inner status with hybrid metadata added', () => {
    const { adapter } = makeAdapter();
    const status = adapter.status();
    expect(status.backend).toBe('builtin');
    expect(status.custom?.hybrid).toMatchObject({
      userId: 'user-123',
      maxLocalItems: 10,
      rehydrated: false,
      firestorePath: 'users/user-123/memory',
    });
  });

  it('marks rehydrated=true after first search', async () => {
    const { adapter } = makeAdapter();
    await adapter.search('anything');
    expect(adapter.status().custom?.['hybrid']).toMatchObject({ rehydrated: true });
  });
});

describe('HybridMemoryAdapter.close()', () => {
  it('delegates to inner.close', async () => {
    const { adapter, inner } = makeAdapter();
    await adapter.close();
    expect(inner.close).toHaveBeenCalledOnce();
  });
});

describe('HybridMemoryAdapter.sync()', () => {
  it('delegates to inner.sync', async () => {
    const { adapter, inner } = makeAdapter();
    await adapter.sync({ reason: 'test' });
    expect(inner.sync).toHaveBeenCalledWith({ reason: 'test' });
  });
});
