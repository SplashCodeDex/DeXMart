import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import AuthSystem from './authSystem.js';
import * as baileys from 'baileys';
import { useFirestoreAuthState } from '../lib/baileysFirestoreAuth.js';

// Mock dependencies
const mockClearAuthState = vi.fn().mockResolvedValue(undefined);
const mockSaveCreds = vi.fn();

vi.mock('../lib/baileysFirestoreAuth.js', () => ({
    useFirestoreAuthState: vi.fn(() => Promise.resolve({
        state: { creds: { registrationId: 123 }, keys: {} },
        saveCreds: mockSaveCreds,
        clearAuthState: mockClearAuthState
    }))
}));

vi.mock('baileys', async () => {
    const actual = await vi.importActual('baileys');
    return {
        ...actual,
        makeWASocket: vi.fn(() => ({
            ev: { on: vi.fn(), emit: vi.fn() },
            requestPairingCode: vi.fn(),
            end: vi.fn()
        })),
        fetchLatestBaileysVersion: vi.fn(() => Promise.resolve({ version: [2, 3000, 1015901307] })),
        initAuthCreds: vi.fn(() => ({ registrationId: 456 })),
        Browsers: { macOS: vi.fn() }
    };
});

describe('AuthSystem Resilience (Unit Tests)', () => {
    const tenantId = 'resilience-tenant';
    const channelId = 'resilience-channel';
    let authSystem: AuthSystem;

    beforeEach(async () => {
        vi.clearAllMocks();
        authSystem = new AuthSystem({ channel: {} }, tenantId, channelId);
    });

    it('Scenario 2: should propagate Firestore timeout errors', async () => {
        vi.mocked(useFirestoreAuthState).mockRejectedValueOnce(new Error('Firestore Timeout'));
        
        const result = await authSystem.connect();
        expect(result.success).toBe(false);
        expect(result.error?.message).toBe('Firestore Timeout');
    });

    it('Scenario 5: should auto-heal by calling initAuthCreds when forceNewSession is true', async () => {
        await authSystem.connect(true);
        
        const { initAuthCreds } = await import('baileys');
        expect(initAuthCreds).toHaveBeenCalled();
    });

    it('Scenario 9: should detect device logout and clear state', async () => {
        const mockSocket = {
            ev: {
                on: vi.fn((event, callback) => {
                    if (event === 'connection.update') mockSocket.connCallback = callback;
                })
            }
        } as any;
        vi.mocked(baileys.makeWASocket).mockReturnValue(mockSocket);

        await authSystem.connect();
        
        const statusSpy = vi.fn();
        authSystem.on('status', statusSpy);

        // Simulate Logged Out (StatusCode 401 in Baileys)
        mockSocket.connCallback({ 
            connection: 'close', 
            lastDisconnect: { error: { output: { statusCode: 401 } } } 
        });

        // Wait for async handler in AuthSystem.ts to finish
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(mockClearAuthState).toHaveBeenCalled();
        expect(statusSpy).toHaveBeenCalledWith('logged_out');
    });

    it('Scenario 11: should correctly detect empty session vs valid session', async () => {
        const { useFirestoreAuthState } = await import('../lib/baileysFirestoreAuth.js');
        
        // Mock valid session
        vi.mocked(useFirestoreAuthState).mockResolvedValueOnce({
            state: { creds: { registrationId: 123, me: { id: 'me' } }, keys: {} } as any,
            saveCreds: vi.fn(),
            clearAuthState: vi.fn()
        });

        let session = await authSystem.detectExistingSession();
        expect(session.hasSession).toBe(true);
        expect(session.isValid).toBe(true);

        // Mock empty session
        vi.mocked(useFirestoreAuthState).mockResolvedValueOnce({
            state: { creds: {}, keys: {} } as any,
            saveCreds: vi.fn(),
            clearAuthState: vi.fn()
        });

        session = await authSystem.detectExistingSession();
        expect(session.isValid).toBe(false);
    });

    it('Scenario 4: should reconnect automatically on network switching (503 error)', async () => {
        const mockSocket = {
            ev: {
                on: vi.fn((event, callback) => {
                    if (event === 'connection.update') mockSocket.connCallback = callback;
                })
            }
        } as any;
        vi.mocked(baileys.makeWASocket).mockReturnValue(mockSocket);

        await authSystem.connect();
        
        vi.useFakeTimers();
        const connectSpy = vi.spyOn(authSystem, 'connect');

        // Simulate 503 Service Unavailable (common during network jitter)
        mockSocket.connCallback({ 
            connection: 'close', 
            lastDisconnect: { error: { output: { statusCode: 503 } } } 
        });

        await vi.advanceTimersByTimeAsync(1100);
        expect(connectSpy).toHaveBeenCalled();
        
        vi.useRealTimers();
    });

    it('Scenario 12: should handle database write failure during creds update', async () => {
        const { useFirestoreAuthState } = await import('../lib/baileysFirestoreAuth.js');
        const mockSaveCreds = vi.fn().mockRejectedValue(new Error('Firestore Write Error'));
        
        vi.mocked(useFirestoreAuthState).mockResolvedValueOnce({
            state: { creds: {}, keys: {} } as any,
            saveCreds: mockSaveCreds,
            clearAuthState: vi.fn()
        });

        const mockSocket = {
            ev: {
                on: vi.fn((event, callback) => {
                    if (event === 'creds.update') mockSocket.credsCallback = callback;
                })
            }
        } as any;
        vi.mocked(baileys.makeWASocket).mockReturnValue(mockSocket);

        await authSystem.connect();
        
        // Trigger creds update which calls saveCreds
        // In AuthSystem.ts: this.client.ev.on('creds.update', saveCreds);
        // Baileys calls the callback directly.
        await expect(mockSocket.credsCallback()).rejects.toThrow('Firestore Write Error');
    });

    it('Scenario 7: should timeout if handshake hangs for 30s', async () => {
        vi.useFakeTimers();
        const statusSpy = vi.fn();
        authSystem.on('disconnected', statusSpy);

        // Start connection
        authSystem.connect();

        // Fast forward 31 seconds
        await vi.advanceTimersByTimeAsync(31000);

        expect(statusSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Handshake Timeout' }));
        vi.useRealTimers();
    });
});
