import { expect } from "vitest";

export function expectInboundContextContract(ctx: any) {
  expect(ctx).toBeDefined();
  expect(ctx.Provider).toBeDefined();
  expect(ctx.Surface).toBeDefined();
  expect(ctx.ChatType).toMatch(/^(direct|group|channel)$/);
  expect(ctx.From).toBeDefined();
  expect(ctx.To).toBeDefined();
  expect(ctx.Body).toBeDefined();
  expect(ctx).toHaveProperty("RawBody");
  expect(ctx).toHaveProperty("CommandBody");
}
