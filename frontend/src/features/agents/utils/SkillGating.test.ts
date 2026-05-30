import { describe, it, expect, beforeEach } from "vitest";
import { useAuthorityStore } from "@/stores/useAuthorityStore";
import { isSkillAllowed } from "./SkillGating";

describe("SkillGating Logic", () => {
  beforeEach(() => {
    useAuthorityStore.setState({
      tier: "starter",
      capabilities: null,
    });
  });

  it("should allow basic skills for all tiers", () => {
    useAuthorityStore.setState({
      tier: "starter",
      capabilities: {
        maxMessages: 1000,
        maxAgents: 1,
        maxChannelSlots: 1,
        minCronIntervalMs: 3600000,
        allowedSkills: ["basic_reply"],
        features: {} as any,
        models: ["gemini-1.5-flash"],
      },
    });
    expect(isSkillAllowed("starter", "basic_reply")).toBe(true);

    useAuthorityStore.setState({
      tier: "pro",
      capabilities: {
        maxMessages: 10000,
        maxAgents: 5,
        maxChannelSlots: 3,
        minCronIntervalMs: 900000,
        allowedSkills: ["basic_reply"],
        features: {} as any,
        models: ["gemini-1.5-flash", "gemini-1.5-pro"],
      },
    });
    expect(isSkillAllowed("pro", "basic_reply")).toBe(true);
  });

  it("should restrict Web Search to Pro and Enterprise", () => {
    useAuthorityStore.setState({
      tier: "starter",
      capabilities: {
        maxMessages: 1000,
        maxAgents: 1,
        maxChannelSlots: 1,
        minCronIntervalMs: 3600000,
        allowedSkills: ["basic_reply"],
        features: {} as any,
        models: ["gemini-1.5-flash"],
      },
    });
    expect(isSkillAllowed("starter", "web_search")).toBe(false);

    useAuthorityStore.setState({
      tier: "pro",
      capabilities: {
        maxMessages: 10000,
        maxAgents: 5,
        maxChannelSlots: 3,
        minCronIntervalMs: 900000,
        allowedSkills: ["basic_reply", "web_search"],
        features: {} as any,
        models: ["gemini-1.5-flash", "gemini-1.5-pro"],
      },
    });
    expect(isSkillAllowed("pro", "web_search")).toBe(true);

    useAuthorityStore.setState({
      tier: "enterprise",
      capabilities: {
        maxMessages: 100000,
        maxAgents: 100,
        maxChannelSlots: 100,
        minCronIntervalMs: 60000,
        allowedSkills: ["basic_reply", "web_search"],
        features: {} as any,
        models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-thinking-exp"],
      },
    });
    expect(isSkillAllowed("enterprise", "web_search")).toBe(true);
  });

  it("should restrict File Analysis to Pro and Enterprise", () => {
    useAuthorityStore.setState({
      tier: "starter",
      capabilities: {
        maxMessages: 1000,
        maxAgents: 1,
        maxChannelSlots: 1,
        minCronIntervalMs: 3600000,
        allowedSkills: ["basic_reply"],
        features: {} as any,
        models: ["gemini-1.5-flash"],
      },
    });
    expect(isSkillAllowed("starter", "file_analysis")).toBe(false);

    useAuthorityStore.setState({
      tier: "pro",
      capabilities: {
        maxMessages: 10000,
        maxAgents: 5,
        maxChannelSlots: 3,
        minCronIntervalMs: 900000,
        allowedSkills: ["basic_reply", "file_analysis"],
        features: {} as any,
        models: ["gemini-1.5-flash", "gemini-1.5-pro"],
      },
    });
    expect(isSkillAllowed("pro", "file_analysis")).toBe(true);
  });

  it("should restrict Custom Scripting to Enterprise only", () => {
    useAuthorityStore.setState({
      tier: "starter",
      capabilities: {
        maxMessages: 1000,
        maxAgents: 1,
        maxChannelSlots: 1,
        minCronIntervalMs: 3600000,
        allowedSkills: ["basic_reply"],
        features: {} as any,
        models: ["gemini-1.5-flash"],
      },
    });
    expect(isSkillAllowed("starter", "custom_scripting")).toBe(false);

    useAuthorityStore.setState({
      tier: "pro",
      capabilities: {
        maxMessages: 10000,
        maxAgents: 5,
        maxChannelSlots: 3,
        minCronIntervalMs: 900000,
        allowedSkills: ["basic_reply", "web_search"],
        features: {} as any,
        models: ["gemini-1.5-flash", "gemini-1.5-pro"],
      },
    });
    expect(isSkillAllowed("pro", "custom_scripting")).toBe(false);

    useAuthorityStore.setState({
      tier: "enterprise",
      capabilities: {
        maxMessages: 100000,
        maxAgents: 100,
        maxChannelSlots: 100,
        minCronIntervalMs: 60000,
        allowedSkills: ["basic_reply", "web_search", "custom_scripting"],
        features: {} as any,
        models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-thinking-exp"],
      },
    });
    expect(isSkillAllowed("enterprise", "custom_scripting")).toBe(true);
  });
});
