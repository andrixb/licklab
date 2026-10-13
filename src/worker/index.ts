// worker: thin driving adapter. Routing → auth check → validate → use case → JSON.
// No business logic, no heavy compute here. Harmonic matching etc. run client-side.
import { checkHealth } from "../application/health.js";

// Minimal structural bindings (no workers-types import in M0; `wrangler types`
// output lands in M4 with the real D1/auth tables).
export interface Env {
  DB: {
    prepare(query: string): {
      first(): Promise<unknown>;
    };
  };
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      if (request.method !== "GET") return json({ ok: false, error: { code: "method_not_allowed", message: "GET only" } }, 405);
      return json({ ok: true, data: checkHealth({ clock: { nowIso: () => new Date().toISOString() } }) });
    }
    if (url.pathname === "/api/ping-db") {
      // M0 smoke test for the D1 binding. Auth + real tables land in M4.
      try {
        await env.DB.prepare("SELECT 1 AS one").first();
        return json({ ok: true, data: { db: "up" } });
      } catch (e) {
        return json({ ok: false, error: { code: "db_down", message: String(e) } }, 500);
      }
    }
    if (url.pathname.startsWith("/api/")) {
      return json({ ok: false, error: { code: "not_found", message: "unknown api route" } }, 404);
    }
    return env.ASSETS.fetch(request);
  },
};
