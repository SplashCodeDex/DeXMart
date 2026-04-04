import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import AuthSystem from './authSystem.js';
import { useFirestoreAuthState } from '../lib/baileysFirestoreAuth.js';
import * as baileys from 'baileys';
import logger from '../utils/logger.js';

// Mock dependencies
vi.mock('../lib/baileysFirestoreAuth.js', () => ({
  useFirestoreAuthState: vi.fn(() => Promise.resolve({
    state: {
      creds: {},
      keys: {}
    },
    saveCreds: vi.fn()
  }))
}));

vi.mock('baileys', async () => {
  const actual = await vi.importActual('baileys');
  return {
    ...actual,
    makeWASocket: vi.fn(() => ({
      ev: {
        on: vi.fn(),
        emit: vi.fn()
      },
      requestPairingCode: vi.fn(),
      end: vi.fn()
    })),
    DisconnectReason: {
        loggedOut: 401
    }
  };
});

vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('AuthSystem', () => {
  const tenantId = 'test-tenant';
  const channelId = 'test-channel';
  let authSystem: AuthSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    authSystem = new AuthSystem({ channel: {} }, tenantId, channelId);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('QR Pending Status', () => {
    it('should emit "status" event with "qr_pending" when QR is received', async () => {
      const mockSocket = {
        ev: {
          on: vi.fn((event, callback) => {
            if (event === 'connection.update') {
                mockSocket.connectionUpdateCallback = callback;
            }
          })
        }
      } as any;
      
      vi.mocked(baileys.makeWASocket).mockReturnValue(mockSocket);

      await authSystem.connect();

      const statusSpy = vi.fn();
      authSystem.on('status', statusSpy);

      // Simulate QR event
      mockSocket.connectionUpdateCallback({ qr: 'mock-qr-code' });

      expect(statusSpy).toHaveBeenCalledWith('qr_pending');
    });
  });

  describe('Reconnection Exponential Backoff', () => {
    it('should implement exponential backoff on connection failure', async () => {
      const mockSocket = {
        ev: {
          on: vi.fn((event, callback) => {
            if (event === 'connection.update') {
                mockSocket.connectionUpdateCallback = callback;
            }
          })
        },
        end: vi.fn()
      } as any;
      
      vi.mocked(baileys.makeWASocket).mockReturnValue(mockSocket);

      await authSystem.connect();
      
      // Simulate connection close with a reason that should trigger reconnect
      // Reset mocks to track the NEW connect call
      const connectSpy = vi.spyOn(authSystem, 'connect');
      
      mockSocket.connectionUpdateCallback({ 
          connection: 'close', 
          lastDisconnect: { error: { output: { statusCode: 500 } } } 
      });

      // Initially, it shouldn't have reconnected immediately if we have backoff
      expect(connectSpy).not.toHaveBeenCalled();

      // Fast forward 1 second (initial delay)
      await vi.advanceTimersByTimeAsync(1000);
      expect(connectSpy).toHaveBeenCalledTimes(1);

      // Simulate another failure
      mockSocket.connectionUpdateCallback({ 
          connection: 'close', 
          lastDisconnect: { error: { output: { statusCode: 500 } } } 
      });

      // Should wait 2 seconds now
      await vi.advanceTimersByTimeAsync(1000);
      expect(connectSpy).toHaveBeenCalledTimes(1); // Still 1 from before
      await vi.advanceTimersByTimeAsync(1000);
      expect(connectSpy).toHaveBeenCalledTimes(2);

      // Next should be 4 seconds
      mockSocket.connectionUpdateCallback({ 
          connection: 'close', 
          lastDisconnect: { error: { output: { statusCode: 500 } } } 
      });
      await vi.advanceTimersByTimeAsync(3000);
      expect(connectSpy).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1000);
      expect(connectSpy).toHaveBeenCalledTimes(3);
    });

    it('should reset backoff on successful connection', async () => {
        const mockSocket = {
            ev: {
              on: vi.fn((event, callback) => {
                if (event === 'connection.update') {
                    mockSocket.connectionUpdateCallback = callback;
                }
              })
            },
            end: vi.fn()
        } as any;
        
        vi.mocked(baileys.makeWASocket).mockReturnValue(mockSocket);
        await authSystem.connect();
        const connectSpy = vi.spyOn(authSystem, 'connect');

        // Fail once -> 1s delay
        mockSocket.connectionUpdateCallback({ connection: 'close', lastDisconnect: { error: { output: { statusCode: 500 } } } });
        await vi.advanceTimersByTimeAsync(1000);
        expect(connectSpy).toHaveBeenCalledTimes(1);

        // Fail twice -> would be 2s delay
        mockSocket.connectionUpdateCallback({ connection: 'close', lastDisconnect: { error: { output: { statusCode: 500 } } } });
        
        // But let's say it connects successfully now (if it was called)
        // Wait, it needs to be called first.
        await vi.advanceTimersByTimeAsync(2000);
        expect(connectSpy).toHaveBeenCalledTimes(2);

        // Succeed now
        mockSocket.connectionUpdateCallback({ connection: 'open' });

        // Fail again -> should be back to 1s delay
        mockSocket.connectionUpdateCallback({ connection: 'close', lastDisconnect: { error: { output: { statusCode: 500 } } } });
        await vi.advanceTimersByTimeAsync(1000);
        expect(connectSpy).toHaveBeenCalledTimes(3);
    });
  });
});
