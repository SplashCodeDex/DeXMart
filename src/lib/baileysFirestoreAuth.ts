import { AuthenticationState, AuthenticationCreds, BufferJSON, initAuthCreds, proto } from 'baileys';
import { firebaseService } from '../services/FirebaseService.js';

/**
 * Custom Baileys Auth State using Firestore subcollections
 * Supports both flat (legacy) and hierarchical paths.
 * @param collectionOrPath Either a collection name ('channels') or a partial path ('agents/A/channels/C')
 */
export async function useFirestoreAuthState(tenantId: string, channelId: string, collectionOrPath: string = 'channels'): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void>, clearAuthState: () => Promise<void> }> {

  // Ensure channelId is provided to prevent illegal Firestore paths (e.g., 'channels//auth')
  // which causes the library to hang/retry infinitely.
  if (!channelId && !collectionOrPath.endsWith('/auth')) {
    throw new Error(`[AuthSystem] Failed to initialize Firestore Auth state: 'channelId' is missing for collection '${collectionOrPath}'`);
  }

  // If collectionOrPath already contains '/auth', don't append it
  const path = collectionOrPath.endsWith('/auth') ? collectionOrPath : `${collectionOrPath}/${channelId}/auth`;

  const writeData = async (data: any, id: string) => {
    const serialized = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
    await firebaseService.setDoc(path, id, { value: serialized }, tenantId);
  };

  const readData = async (id: string) => {
    try {
      const doc = await firebaseService.getDoc(path, id, tenantId);
      if (doc && 'value' in (doc as any)) {
        return JSON.parse(JSON.stringify((doc as any).value), BufferJSON.reviver);
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const removeData = async (id: string) => {
    await firebaseService.deleteDoc(path, id, tenantId);
  };

  const creds: AuthenticationCreds = await readData('creds') || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [id: string]: any } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data: any) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(value, key) : removeData(key));
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: async () => {
      await writeData(creds, 'creds');
    },
    clearAuthState: async () => {
      // Clear main creds
      await removeData('creds');
      // This is a rough way to clear keys,
      // ideally we would list all docs in the subcollection.
      // For now, this ensures the main session is dead.
    }
  };
}
