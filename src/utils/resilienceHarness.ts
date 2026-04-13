import { getWhatsAppRuntime } from '../../extensions/whatsapp/src/runtime.js';
import { vi } from 'vitest';

/**
 * Resilience Mock Harness
 * Provides utilities to inject failures into the live native WhatsApp socket.
 * Uses the OpenClaw WhatsApp runtime (getWhatsAppRuntime) instead of the
 * deprecated WhatsappAdapter (removed in Task 5.5).
 */
export class ResilienceHarness {
    private getSocket(): any {
        return getWhatsAppRuntime().channel.whatsapp.getActiveWebListener();
    }

    /**
     * Simulates an abrupt socket closure
     */
    public simulateSocketClose() {
        const socket = this.getSocket();
        if (socket && socket.ws) {
            socket.ws.emit('close', 1006, 'Abrupt close simulated by harness');
        } else if (socket && socket.ev) {
            socket.ev.emit('connection.update', {
                connection: 'close',
                lastDisconnect: {
                    error: new Error('Stream Closed (Simulated)'),
                    date: new Date()
                }
            });
        }
    }

    /**
     * Simulates a 401 Unauthorized (Session Expired)
     */
    public simulateAuthFailure() {
        const socket = this.getSocket();
        if (socket && socket.ev) {
            socket.ev.emit('connection.update', {
                connection: 'close',
                lastDisconnect: {
                    error: {
                        output: {
                            statusCode: 401,
                            headers: {},
                            payload: { statusCode: 401, error: 'Unauthorized', message: 'Session expired (simulated)' },
                        }
                    } as unknown as Error,
                    date: new Date()
                }
            });
        }
    }

    /**
     * Simulates a Firestore timeout during credential write
     */
    public mockFirestoreTimeout(firebaseService: any) {
        vi.spyOn(firebaseService, 'setDoc').mockImplementationOnce(() => {
            return new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Firestore Deadline Exceeded')), 100);
            });
        });
    }

    /**
     * Simulates a thundering herd of messages
     */
    public async simulateMessageBurst(count: number, sender = '12345@s.whatsapp.net') {
        const socket = this.getSocket();
        if (!socket || !socket.ev) return;

        for (let i = 0; i < count; i++) {
            socket.ev.emit('messages.upsert', {
                type: 'notify',
                messages: [{
                    key: { remoteJid: sender, fromMe: false, id: `msg_${i}` },
                    message: { conversation: `Burst message ${i}` },
                    messageTimestamp: Math.floor(Date.now() / 1000)
                }]
            });
        }
    }
}
