/**
 * Tests for channel-auth-state.ts (FR-2 spec).
 *
 * Strategy:
 *   - Test useChannelAuthState with a mock AuthKeyValueStore (no baileys import needed).
 *   - Test makeFirestoreAuthStore with a mock Firestore client.
 *   - Verify get/set/delete paths, proto deserialization for app-state-sync-key,
 *     saveCreds, and clearAuthState.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFirestoreAuthStore, useChannelAuthState } from "./channel-auth-state.js";

// ── Mock baileys ─────────────────────────────────────────────────────────────
// baileys is not installed at root — mock its lazy import.
// Must use the same specifier the source uses: `import('baileys')` (line 63 of channel-auth-state.ts).
// Using the resolved subpath '@whiskeysockets/baileys/lib/index.js' is unreliable in combined runs
// because Vitest's module cache normalises it differently across test files.
vi.mock("baileys", () => ({
  BufferJSON: {
    replacer: (_key: string, value: unknown) => value,
    reviver: (_key: string, value: unknown) => value,
  },
  initAuthCreds: vi.fn(() => ({ me: null, signedIdentityKey: {} })),
  proto: {
    Message: {
      AppStateSyncKeyData: {
        fromObject: vi.fn((v: unknown) => ({ __converted: true, ...(v as object) })),
      },
    },
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeMemStore(
  initial: Record<string, unknown> = {},
): import("./channel-auth-state.js").AuthKeyValueStore {
  const map = new Map<string, unknown>(Object.entries(initial));
  return {
    get: vi.fn(async (key) => map.get(key) ?? null),
    set: vi.fn(async (key, value) => {
      if (value == null) map.delete(key);
      else map.set(key, value);
    }),
  };
}

function makeFirestoreMock() {
  const docs = new Map<string, Record<string, unknown>>();
  return {
    client: {
      collection: vi.fn((path: string) => ({
        doc: vi.fn((id: string) => ({
          get: vi.fn(async () => {
            const key = `${path}/${id}`;
            const data = docs.get(key);
            return { exists: data !== undefined, data: () => data };
          }),
          set: vi.fn(async (data: Record<string, unknown>) => {
            docs.set(`${path}/${id}`, data);
          }),
          delete: vi.fn(async () => {
            docs.delete(`${path}/${id}`);
          }),
        })),
      })),
    },
    docs,
  };
}

// ── Tests: useChannelAuthState ────────────────────────────────────────────────
describe("useChannelAuthState", () => {
  it("initializes fresh creds when store is empty", async () => {
    const store = makeMemStore();
    const { state } = await useChannelAuthState(store);
    // initAuthCreds returns { me: null, signedIdentityKey: {} }
    expect(state.creds.me).toBeNull();
  });

  it("loads existing creds from store", async () => {
    const store = makeMemStore({
      creds: { me: { id: "user@s.whatsapp.net" }, signedIdentityKey: {} },
    });
    const { state } = await useChannelAuthState(store);
    expect((state.creds.me as any)?.id).toBe("user@s.whatsapp.net");
  });

  it("saveCreds writes creds to store", async () => {
    const store = makeMemStore();
    const { saveCreds } = await useChannelAuthState(store);
    await saveCreds();
    expect(store.set).toHaveBeenCalledWith("creds", expect.any(Object));
  });

  it("clearAuthState deletes creds from store", async () => {
    const store = makeMemStore({ creds: { me: null } });
    const { clearAuthState } = await useChannelAuthState(store);
    await clearAuthState();
    expect(store.set).toHaveBeenCalledWith("creds", null);
  });

  it("keys.get retrieves values by type-id composite key", async () => {
    const store = makeMemStore({ "session-abc123": { data: "session-data" } });
    const { state } = await useChannelAuthState(store);
    const result = await state.keys.get("session", ["abc123"]);
    expect(result["abc123"]).toEqual({ data: "session-data" });
  });

  it("keys.get applies proto deserialization for app-state-sync-key", async () => {
    const store = makeMemStore({ "app-state-sync-key-mykey": { keyData: "raw" } });
    const { state } = await useChannelAuthState(store);
    const result = await state.keys.get("app-state-sync-key", ["mykey"]);
    expect((result["mykey"] as any).__converted).toBe(true);
  });

  it("keys.set writes non-null values and deletes null values", async () => {
    const store = makeMemStore();
    const { state } = await useChannelAuthState(store);
    await state.keys.set({
      "pre-key": { "1": { keyPair: {} }, "2": null as any },
    });
    expect(store.set).toHaveBeenCalledWith("pre-key-1", expect.any(Object));
    expect(store.set).toHaveBeenCalledWith("pre-key-2", null);
  });
});

// ── Tests: makeFirestoreAuthStore ─────────────────────────────────────────────
describe("makeFirestoreAuthStore", () => {
  let firestore: ReturnType<typeof makeFirestoreMock>;
  let store: import("./channel-auth-state.js").AuthKeyValueStore;

  beforeEach(() => {
    firestore = makeFirestoreMock();
    store = makeFirestoreAuthStore("user-123", "whatsapp", firestore.client as any);
  });

  it("returns null for missing keys", async () => {
    const result = await store.get("creds");
    expect(result).toBeNull();
  });

  it("reads value from Firestore doc", async () => {
    // Pre-seed the Firestore mock
    firestore.docs.set("users/user-123/channels/whatsapp/auth/creds", { value: { me: "test" } });
    const result = await store.get("creds");
    expect(result).toEqual({ me: "test" });
  });

  it("writes value to Firestore doc", async () => {
    await store.set("creds", { me: "user@s.whatsapp.net" });
    const doc = firestore.docs.get("users/user-123/channels/whatsapp/auth/creds");
    expect(doc).toEqual({ value: { me: "user@s.whatsapp.net" } });
  });

  it("deletes Firestore doc when value is null", async () => {
    firestore.docs.set("users/user-123/channels/whatsapp/auth/creds", { value: {} });
    await store.set("creds", null);
    expect(firestore.docs.has("users/user-123/channels/whatsapp/auth/creds")).toBe(false);
  });

  it("scopes paths correctly per userId and channelId", async () => {
    const store2 = makeFirestoreAuthStore("user-456", "signal", firestore.client as any);
    await store.set("creds", { owner: "user-123" });
    await store2.set("creds", { owner: "user-456" });

    const doc1 = firestore.docs.get("users/user-123/channels/whatsapp/auth/creds");
    const doc2 = firestore.docs.get("users/user-456/channels/signal/auth/creds");
    expect((doc1 as any)?.value?.owner).toBe("user-123");
    expect((doc2 as any)?.value?.owner).toBe("user-456");
  });
});
