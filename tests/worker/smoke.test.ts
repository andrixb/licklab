import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("workerd smoke", () => {
  it("has a local D1 binding", async () => {
    const row = await (env.DB as D1Database).prepare("SELECT 1 AS one").first<{ one: number }>();
    expect(row?.one).toBe(1);
  });
});
