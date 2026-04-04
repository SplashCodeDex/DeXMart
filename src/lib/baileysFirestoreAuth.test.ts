import { describe, it, expect, vi } from 'vitest';
import { useFirestoreAuthState } from './baileysFirestoreAuth.js';
import { firebaseService } from '../services/FirebaseService.js';

describe('Firestore Auth Provider', () => {
  const tenantId = 'test-tenant';
  const channelId = 'test-channel';

  it('should initialize with new creds if none exist', async () => {
    // Mock getDoc to return null (no creds)
    const getDocSpy = vi.spyOn(firebaseService, 'getDoc').mockResolvedValue(null);

    const { state } = await useFirestoreAuthState(tenantId, channelId);
    expect(state.creds).toBeDefined();
    expect(state.creds.noiseKey).toBeDefined();

    getDocSpy.mockRestore();
  });

  it('should save creds to Firestore', async () => {
    let savedData: any = null;
    // Mock getDoc to return null (no creds) to avoid hitting real Firestore
    const getDocSpy = vi.spyOn(firebaseService, 'getDoc').mockResolvedValue(null);
    const setDocSpy = vi.spyOn(firebaseService, 'setDoc').mockImplementation(async (_col, id, data) => {
      if (id === 'creds') savedData = data;
    });

    const { state, saveCreds } = await useFirestoreAuthState(tenantId, channelId);
    await saveCreds();

    expect(savedData).toBeDefined();
    expect(savedData.value).toBeDefined();

    setDocSpy.mockRestore();
    getDocSpy.mockRestore();
  });
});
