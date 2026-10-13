import { describe, expect, it } from "vitest";

describe("worker /api/health (unit-level contract)", () => {
  it("health envelope shape", async () => {
    const { default: worker } = await import("../../src/worker/index.js");
    const res = await worker.fetch(
      new Request("https://test/api/health"),
      { DB: {} as never, ASSETS: { fetch: async () => new Response("asset") } as never },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { ok: boolean } };
    expect(body.ok).toBe(true);
    expect(body.data.ok).toBe(true);
  });

  it("unknown /api route is 404 JSON", async () => {
    const { default: worker } = await import("../../src/worker/index.js");
    const res = await worker.fetch(
      new Request("https://test/api/nope"),
      { DB: {} as never, ASSETS: { fetch: async () => new Response("asset") } as never },
    );
    expect(res.status).toBe(404);
  });
});
