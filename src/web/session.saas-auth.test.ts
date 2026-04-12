/**
 * Task 5.2 — Firestore auth as default for SaaS mode
 *
 * RED phase: tests fail until resolveWaAuthStateFactory is exported from session.ts
 * and uses SAAS_MODE env to auto-select Firestore-backed auth.
 */
import { describe, expect, it } from "vitest";
// This import will fail (red) until resolveWaAuthStateFactory is exported
import { resolveWaAuthStateFactory } from "./session.js";

describe("Task 5.2 — resolveWaAuthStateFactory selects auth store based on SAAS_MODE", () => {
  it("returns a Firestore factory when saasMode=true and userId+channelId provided", () => {
    const factory = resolveWaAuthStateFactory(
      { userId: "user-001", channelId: "chan-wa-001" },
      true,
    );

    expect(factory).toBeDefined();
    expect(typeof factory).toBe("function");
  });

  it("returns undefined when saasMode=false even if userId+channelId provided", () => {
    const factory = resolveWaAuthStateFactory(
      { userId: "user-001", channelId: "chan-wa-001" },
      false,
    );

    expect(factory).toBeUndefined();
  });

  it("returns undefined when saasMode=true but userId is missing", () => {
    const factory = resolveWaAuthStateFactory({ channelId: "chan-wa-001" }, true);
    expect(factory).toBeUndefined();
  });

  it("returns undefined when saasMode=true but channelId is missing", () => {
    const factory = resolveWaAuthStateFactory({ userId: "user-001" }, true);
    expect(factory).toBeUndefined();
  });

  it("returns an explicit authStateFactory regardless of saasMode", () => {
    const explicit = async () => ({
      state: {} as import("@whiskeysockets/baileys").AuthenticationState,
      saveCreds: async () => {},
    });
    const factory = resolveWaAuthStateFactory({ authStateFactory: explicit }, true);
    expect(factory).toBe(explicit);
  });

  it("explicit authStateFactory takes precedence over saas auto-factory", () => {
    const explicit = async () => ({
      state: {} as import("@whiskeysockets/baileys").AuthenticationState,
      saveCreds: async () => {},
    });
    const factory = resolveWaAuthStateFactory(
      { userId: "user-001", channelId: "chan-001", authStateFactory: explicit },
      true,
    );
    expect(factory).toBe(explicit);
  });
});
