import { vi } from 'vitest';

export type MockBaileysSocket = any;

export function createMockBaileys() {
  const lastSocket = {
    ev: { on: vi.fn(), process: vi.fn(), emit: vi.fn() },
    sendMessage: vi.fn(),
    readMessages: vi.fn(),
    logout: vi.fn(),
    ws: { close: vi.fn() }
  };
  return {
    lastSocket,
    mod: {
      makeWASocket: vi.fn().mockReturnValue(lastSocket),
      useMultiFileAuthState: vi.fn().mockResolvedValue({
        state: { creds: {}, keys: {} },
        saveCreds: vi.fn()
      }),
      fetchLatestBaileysVersion: vi.fn().mockResolvedValue({ version: [2, 23, 4] }),
      makeCacheableSignalKeyStore: vi.fn()
    }
  };
}
