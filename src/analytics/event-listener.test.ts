/**
 * Tests for src/analytics/event-listener.ts
 *
 * Strategy:
 *   - Test parseSessionKey: valid, too-short, missing parts, undefined
 *   - Test mapAgentEvent: every stream type and phase combination
 *   - Test startAgentEventListener: subscribes and forwards; ignores no-userId events;
 *     handles errors without throwing; prevents double-registration
 *   - No external deps — MastermindStreamService and agent-events mocked
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../infra/agent-events.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    onAgentEvent: vi.fn(),
  };
});

vi.mock('../services/MastermindStreamService.js', () => ({
  mastermindStreamService: {
    emit: vi.fn(),
  },
}));

vi.mock('../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { onAgentEvent } from '../infra/agent-events.js';
import { mastermindStreamService } from '../services/MastermindStreamService.js';
import {
  parseSessionKey,
  mapAgentEvent,
  startAgentEventListener,
  stopAgentEventListener,
  isAgentEventListenerRunning,
} from './event-listener.js';
import type { AgentEventPayload } from '../infra/agent-events.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvt(overrides: Partial<AgentEventPayload> = {}): AgentEventPayload {
  return {
    runId: 'run-1',
    seq: 1,
    stream: 'lifecycle',
    ts: Date.now(),
    data: {},
    sessionKey: 'user-abc:agent-1:whatsapp-1',
    ...overrides,
  };
}

// ── parseSessionKey ────────────────────────────────────────────────────────────

describe('parseSessionKey', () => {
  it('parses valid three-part key', () => {
    const result = parseSessionKey('user-abc:agent-1:whatsapp-1');
    expect(result).toEqual({ userId: 'user-abc', agentId: 'agent-1', channelId: 'whatsapp-1' });
  });

  it('parses two-part key with default channelId', () => {
    const result = parseSessionKey('user-abc:agent-1');
    expect(result).toEqual({ userId: 'user-abc', agentId: 'agent-1', channelId: 'unknown' });
  });

  it('returns null for single-part key', () => {
    expect(parseSessionKey('user-abc')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseSessionKey('')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseSessionKey(undefined)).toBeNull();
  });

  it('returns null when userId is empty', () => {
    expect(parseSessionKey(':agent-1:whatsapp-1')).toBeNull();
  });
});

// ── mapAgentEvent ─────────────────────────────────────────────────────────────

describe('mapAgentEvent', () => {
  describe('lifecycle stream', () => {
    it('maps phase=start to reasoning:start', () => {
      const result = mapAgentEvent(makeEvt({ stream: 'lifecycle', data: { phase: 'start' } }), 'agent-1');
      expect(result?.type).toBe('reasoning:start');
      expect(result?.payload.agentId).toBe('agent-1');
    });

    it('maps phase=complete to reasoning:complete with summary', () => {
      const result = mapAgentEvent(
        makeEvt({ stream: 'lifecycle', data: { phase: 'complete', summary: 'Done!' } }),
        'agent-1',
      );
      expect(result?.type).toBe('reasoning:complete');
      expect(result?.payload.content).toBe('Done!');
    });

    it('maps phase=error to reasoning:error', () => {
      const result = mapAgentEvent(
        makeEvt({ stream: 'lifecycle', data: { phase: 'error', error: 'Timeout' } }),
        'agent-1',
      );
      expect(result?.type).toBe('reasoning:error');
      expect(result?.payload.error).toBe('Timeout');
    });

    it('returns null for unknown lifecycle phase (heartbeat)', () => {
      const result = mapAgentEvent(
        makeEvt({ stream: 'lifecycle', data: { phase: 'heartbeat' } }),
        'agent-1',
      );
      expect(result).toBeNull();
    });

    it('returns null for lifecycle with no phase', () => {
      expect(mapAgentEvent(makeEvt({ stream: 'lifecycle', data: {} }), 'agent-1')).toBeNull();
    });
  });

  describe('assistant stream', () => {
    it('maps to reasoning:thought with content', () => {
      const result = mapAgentEvent(
        makeEvt({ stream: 'assistant', data: { text: 'I am thinking...' } }),
        'agent-1',
      );
      expect(result?.type).toBe('reasoning:thought');
      expect(result?.payload.content).toBe('I am thinking...');
    });

    it('returns null when text is empty', () => {
      expect(mapAgentEvent(makeEvt({ stream: 'assistant', data: { text: '' } }), 'agent-1')).toBeNull();
    });

    it('returns null when text is missing', () => {
      expect(mapAgentEvent(makeEvt({ stream: 'assistant', data: {} }), 'agent-1')).toBeNull();
    });
  });

  describe('tool stream', () => {
    it('maps phase=invoke to tool:invoke', () => {
      const result = mapAgentEvent(
        makeEvt({ stream: 'tool', data: { phase: 'invoke', toolName: 'search', params: { q: 'test' } } }),
        'agent-1',
      );
      expect(result?.type).toBe('tool:invoke');
      expect(result?.payload.toolName).toBe('search');
      expect(result?.payload.params).toEqual({ q: 'test' });
    });

    it('maps phase=call to tool:invoke', () => {
      const result = mapAgentEvent(
        makeEvt({ stream: 'tool', data: { phase: 'call', name: 'calculator' } }),
        'agent-1',
      );
      expect(result?.type).toBe('tool:invoke');
      expect(result?.payload.toolName).toBe('calculator');
    });

    it('maps phase=result to tool:result', () => {
      const result = mapAgentEvent(
        makeEvt({ stream: 'tool', data: { phase: 'result', toolName: 'search', result: ['item1'] } }),
        'agent-1',
      );
      expect(result?.type).toBe('tool:result');
      expect(result?.payload.result).toEqual(['item1']);
    });

    it('maps phase=complete to tool:result', () => {
      const result = mapAgentEvent(
        makeEvt({ stream: 'tool', data: { phase: 'complete', toolName: 'web', output: 'done' } }),
        'agent-1',
      );
      expect(result?.type).toBe('tool:result');
    });

    it('maps phase=error to reasoning:error with tool context', () => {
      const result = mapAgentEvent(
        makeEvt({ stream: 'tool', data: { phase: 'error', toolName: 'search', error: 'rate limited' } }),
        'agent-1',
      );
      expect(result?.type).toBe('reasoning:error');
      expect(result?.payload.error).toContain('search');
    });

    it('returns null for unknown tool phase', () => {
      expect(
        mapAgentEvent(makeEvt({ stream: 'tool', data: { phase: 'queued' } }), 'agent-1'),
      ).toBeNull();
    });
  });

  describe('error stream', () => {
    it('maps to reasoning:error', () => {
      const result = mapAgentEvent(
        makeEvt({ stream: 'error', data: { error: 'out of memory' } }),
        'agent-1',
      );
      expect(result?.type).toBe('reasoning:error');
      expect(result?.payload.error).toBe('out of memory');
    });

    it('uses message field if error field missing', () => {
      const result = mapAgentEvent(
        makeEvt({ stream: 'error', data: { message: 'fatal' } }),
        'agent-1',
      );
      expect(result?.payload.error).toBe('fatal');
    });

    it('uses fallback message when no error or message field', () => {
      const result = mapAgentEvent(makeEvt({ stream: 'error', data: {} }), 'agent-1');
      expect(result?.payload.error).toBe('Unknown agent error');
    });
  });

  describe('unknown stream', () => {
    it('returns null', () => {
      expect(mapAgentEvent(makeEvt({ stream: 'custom-stream' as any, data: {} }), 'agent-1')).toBeNull();
    });
  });
});

// ── startAgentEventListener ───────────────────────────────────────────────────

describe('startAgentEventListener', () => {
  let capturedListener: ((evt: AgentEventPayload) => void) | null = null;
  const unsubMock = vi.fn();

  beforeEach(() => {
    capturedListener = null;
    unsubMock.mockReset();
    vi.mocked(onAgentEvent).mockReset();
    vi.mocked(onAgentEvent).mockImplementation((fn) => {
      capturedListener = fn;
      return unsubMock;
    });
    vi.mocked(mastermindStreamService.emit).mockReset();
    // Ensure listener is stopped before each test
    stopAgentEventListener();
  });

  afterEach(() => {
    stopAgentEventListener();
  });

  it('subscribes to agent events on start', () => {
    startAgentEventListener();
    expect(onAgentEvent).toHaveBeenCalledOnce();
    expect(isAgentEventListenerRunning()).toBe(true);
  });

  it('forwards a mapped event to MastermindStreamService', () => {
    startAgentEventListener();
    capturedListener!(makeEvt({ stream: 'lifecycle', data: { phase: 'start' } }));
    expect(mastermindStreamService.emit).toHaveBeenCalledWith(
      'user-abc',
      'reasoning:start',
      expect.objectContaining({ agentId: 'agent-1' }),
    );
  });

  it('ignores events without a valid sessionKey (no userId)', () => {
    startAgentEventListener();
    capturedListener!(makeEvt({ sessionKey: undefined }));
    expect(mastermindStreamService.emit).not.toHaveBeenCalled();
  });

  it('ignores events that map to null (heartbeat)', () => {
    startAgentEventListener();
    capturedListener!(makeEvt({ stream: 'lifecycle', data: { phase: 'heartbeat' } }));
    expect(mastermindStreamService.emit).not.toHaveBeenCalled();
  });

  it('does not throw when MastermindStreamService.emit throws', () => {
    vi.mocked(mastermindStreamService.emit).mockImplementation(() => {
      throw new Error('socket disconnected');
    });
    startAgentEventListener();
    expect(() =>
      capturedListener!(makeEvt({ stream: 'lifecycle', data: { phase: 'start' } })),
    ).not.toThrow();
  });

  it('prevents double-registration', () => {
    startAgentEventListener();
    startAgentEventListener(); // second call
    expect(onAgentEvent).toHaveBeenCalledOnce(); // only one subscription
  });

  it('unsubscribes on stop', () => {
    startAgentEventListener();
    stopAgentEventListener();
    expect(unsubMock).toHaveBeenCalledOnce();
    expect(isAgentEventListenerRunning()).toBe(false);
  });

  it('stop is idempotent', () => {
    startAgentEventListener();
    stopAgentEventListener();
    stopAgentEventListener(); // second call — should not throw
    expect(unsubMock).toHaveBeenCalledOnce();
  });
});
