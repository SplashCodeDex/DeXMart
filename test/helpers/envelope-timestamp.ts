import { formatAgentEnvelope } from "../../src/auto-reply/envelope.js";
import { getLoadConfigMock } from "../../src/telegram/bot.create-telegram-bot.test-harness.js";

export function formatEnvelopeTimestamp(date: Date): string {
    const cfg = getLoadConfigMock()();
    const tz = cfg?.agents?.defaults?.envelopeTimezone;
    // We just want to extract the timestamp part. formatAgentEnvelope formats the whole thing.
    // Let's use formatAgentEnvelope with a fake body and extract the timestamp string
    const res = formatAgentEnvelope({
        channel: "Test",
        body: "test",
        timestamp: date,
        envelope: { timezone: tz }
    });
    // res is like "[Test Thu 2025-01-09T00:00Z] test"
    const match = res.match(/\[Test (.+?)\]/);
    return match ? match[1] : "";
}

export function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
