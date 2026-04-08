/**
 * channel-auth-state.ts — DeXMart Fusion: Universal Channel Auth State (FR-2)
 *
 * OpenClaw uses Baileys' useMultiFileAuthState (file-system) for WhatsApp sessions.
 * DeXMart serves many users — file-system auth cannot scale to N users × M channels.
 *
 * This module provides useChannelAuthState(), a generalized Baileys-compatible
 * auth state that persists to ANY key-value store via a structural interface.
 *
 * The concrete Firestore adapter (makeFirestoreAuthStore) is also exported here.
 * Other adapters (Redis, Postgres) can be added the same way without touching
 * the core auth state logic.
 *
 * Per the fusion plan: this replaces BOTH:
 *   - src/persistence/firestore-auth-state.ts (hard-coupled to FirebaseService)
 *   - src/dexmart-lib/baileysFirestoreAuth.ts  (duplicate of the above)
 * Both of those files are kept for now (backward compat) but new code uses this.
 *
 * Design: zero hard imports of firebase-admin, baileys types are imported only
 * as types so this file compiles without baileys installed at the root level.
 */

import type {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
} from '@whiskeysockets/baileys';

// ── Storage Interface ─────────────────────────────────────────────────────────

/**
 * Minimal key-value store interface for auth state persistence.
 * Implement this to plug in any storage backend (Firestore, Redis, Postgres…).
 */
export interface AuthKeyValueStore {
  /** Read a value by key. Returns null if not found. */
  get(key: string): Promise<unknown | null>;
  /** Write a value. Pass null to delete. */
  set(key: string, value: unknown | null): Promise<void>;
}

// ── Core Auth State ───────────────────────────────────────────────────────────

/**
 * Creates a Baileys-compatible AuthenticationState backed by any AuthKeyValueStore.
 *
 * This is the universal replacement for:
 *   - useMultiFileAuthState (file-system, single-user)
 *   - useFirestoreAuthState (Firestore, coupled to FirebaseService)
 *
 * Usage:
 *   const store = makeFirestoreAuthStore(userId, channelId, firestoreClient);
 *   const { state, saveCreds } = await useChannelAuthState(store);
 *
 * @param store - Any AuthKeyValueStore implementation.
 */
export async function useChannelAuthState(store: AuthKeyValueStore): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearAuthState: () => Promise<void>;
}> {
  // Lazy import baileys — only available in openclaw's package scope at runtime
  const { BufferJSON, initAuthCreds, proto } = await import('baileys');

  const readData = async (key: string): Promise<unknown | null> => {
    try {
      const raw = await store.get(key);
      if (raw == null) return null;
      return JSON.parse(JSON.stringify(raw), BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const writeData = async (key: string, value: unknown): Promise<void> => {
    const serialized = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
    await store.set(key, serialized);
  };

  const deleteData = async (key: string): Promise<void> => {
    await store.set(key, null);
  };

  const creds: AuthenticationCreds =
    (await readData('creds')) as AuthenticationCreds ?? initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(
          type: T,
          ids: string[],
        ): Promise<Record<string, SignalDataTypeMap[T]>> => {
          const result: Record<string, SignalDataTypeMap[T]> = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`) as SignalDataTypeMap[T] | null;
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(
                  value as object,
                ) as SignalDataTypeMap[T];
              }
              result[id] = value as SignalDataTypeMap[T];
            }),
          );
          return result;
        },
        set: async (data: Partial<Record<keyof SignalDataTypeMap, Record<string, unknown>>>) => {
          const tasks: Promise<void>[] = [];
          for (const [category, entries] of Object.entries(data)) {
            if (!entries) continue;
            for (const [id, value] of Object.entries(entries)) {
              const key = `${category}-${id}`;
              tasks.push(value != null ? writeData(key, value) : deleteData(key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData('creds', creds);
    },
    clearAuthState: async () => {
      await deleteData('creds');
      // Keys are prefixed by category; clearing creds kills the active session.
      // A full key-space wipe requires store.listKeys() which varies by backend.
      // Callers needing full wipe should implement AuthKeyValueStore.clear().
    },
  };
}

// ── Firestore Adapter ─────────────────────────────────────────────────────────

/**
 * Structural interface for the Firestore operations needed by the auth store.
 * Matches firebase-admin's Firestore API — no direct import required.
 */
export interface FirestoreAuthClient {
  collection(path: string): {
    doc(id: string): {
      get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
      set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<unknown>;
      delete(): Promise<unknown>;
    };
  };
}

/**
 * Creates an AuthKeyValueStore backed by a Firestore subcollection.
 *
 * Path structure: /users/{userId}/channels/{channelId}/auth/{keyId}
 * This scopes each user's channel session data independently (user-as-tenant model).
 *
 * @param userId    - Firebase UID of the authenticated user (the tenant).
 * @param channelId - Channel identifier (e.g., 'whatsapp', 'signal-1').
 * @param firestore - Firestore client (firebase-admin or compatible).
 */
export function makeFirestoreAuthStore(
  userId: string,
  channelId: string,
  firestore: FirestoreAuthClient,
): AuthKeyValueStore {
  // Path: /users/{userId}/channels/{channelId}/auth
  const authPath = `users/${userId}/channels/${channelId}/auth`;

  return {
    async get(key: string): Promise<unknown | null> {
      const doc = await firestore.collection(authPath).doc(key).get();
      if (!doc.exists) return null;
      const data = doc.data();
      return data?.['value'] ?? null;
    },
    async set(key: string, value: unknown | null): Promise<void> {
      const ref = firestore.collection(authPath).doc(key);
      if (value == null) {
        await ref.delete();
      } else {
        await ref.set({ value }, { merge: false });
      }
    },
  };
}

/**
 * Convenience function: creates a complete Firestore-backed channel auth state.
 * Drop-in replacement for the old useFirestoreAuthState(tenantId, channelId).
 *
 * @param userId    - Firebase UID of the authenticated user.
 * @param channelId - Channel identifier.
 * @param firestore - Firestore client.
 */
export async function useFirestoreChannelAuthState(
  userId: string,
  channelId: string,
  firestore: FirestoreAuthClient,
): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearAuthState: () => Promise<void>;
}> {
  const store = makeFirestoreAuthStore(userId, channelId, firestore);
  return useChannelAuthState(store);
}
