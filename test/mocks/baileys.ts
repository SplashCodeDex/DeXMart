import { EventEmitter } from 'node:events';
import { vi } from 'vitest';

export type MockBaileysSocket = any;

/**
 * Creates a mock Baileys module with a socket whose `ev` is backed by a real
 * EventEmitter. This ensures that `sock.ev.on(event, handler)` actually
 * registers the handler and `sock.ev.emit(event, data)` actually fires it —
 * matching real Baileys behaviour used by session.ts for `creds.update`,
 * `connection.update`, etc.
 *
 * The `on`, `emit`, and `process` methods are wrapped with vi.spyOn so tests
 * can still assert call counts and arguments.
 */
export function createMockBaileys() {
  const ev = new EventEmitter();
  // Wrap EventEmitter methods with spies so test assertions still work
  vi.spyOn(ev, 'on');
  vi.spyOn(ev, 'emit');
  // session.ts doesn't call `process`, but some tests may assert on it
  (ev as any).process = vi.fn();

  const lastSocket = {
    ev,
    sendMessage: vi.fn(),
    readMessages: vi.fn(),
    logout: vi.fn(),
    ws: { close: vi.fn(), on: vi.fn() },
  };
  return {
    lastSocket,
    mod: {
      makeWASocket: vi.fn().mockReturnValue(lastSocket),
      useMultiFileAuthState: vi.fn().mockResolvedValue({
        state: { creds: {}, keys: {} },
        saveCreds: vi.fn(),
      }),
      fetchLatestBaileysVersion: vi.fn().mockResolvedValue({ version: [2, 23, 4] }),
      makeCacheableSignalKeyStore: vi.fn(),
    },
  };
}
