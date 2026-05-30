import { describe, it, expect, beforeEach } from "vitest";
import { useAuthorityStore } from "@/stores/useAuthorityStore";
import { canAddChannelSlot } from "./ChannelSlotGuard";

describe("ChannelSlotGuard", () => {
  beforeEach(() => {
    useAuthorityStore.setState({
      tier: "starter",
      capabilities: null,
    });
  });

  it("should allow 1 channel for Starter plan", () => {
    useAuthorityStore.setState({
      tier: "starter",
      capabilities: {
        maxMessages: 1000,
        maxAgents: 1,
        maxChannelSlots: 1,
        minCronIntervalMs: 3600000,
        allowedSkills: [],
        features: {} as any,
        models: ["gemini-1.5-flash"],
      },
    });
    expect(canAddChannelSlot("starter", 0)).toBe(true);
    expect(canAddChannelSlot("starter", 1)).toBe(false);
  });

  it("should allow 3 channels for Pro plan", () => {
    useAuthorityStore.setState({
      tier: "pro",
      capabilities: {
        maxMessages: 10000,
        maxAgents: 5,
        maxChannelSlots: 3,
        minCronIntervalMs: 900000,
        allowedSkills: [],
        features: {} as any,
        models: ["gemini-1.5-flash", "gemini-1.5-pro"],
      },
    });
    expect(canAddChannelSlot("pro", 2)).toBe(true);
    expect(canAddChannelSlot("pro", 3)).toBe(false);
  });

  it("should allow many channels for Enterprise plan", () => {
    useAuthorityStore.setState({
      tier: "enterprise",
      capabilities: {
        maxMessages: 100000,
        maxAgents: 100,
        maxChannelSlots: 100,
        minCronIntervalMs: 60000,
        allowedSkills: [],
        features: {} as any,
        models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-thinking-exp"],
      },
    });
    expect(canAddChannelSlot("enterprise", 10)).toBe(true);
    expect(canAddChannelSlot("enterprise", 99)).toBe(true);
  });
});
