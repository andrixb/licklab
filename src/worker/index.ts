// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// worker: thin driving adapter. Routing → auth check → validate → use case → JSON.
// No business logic, no heavy compute here. Harmonic matching etc. run client-side.
import { checkHealth } from "../application/health.js";
import { createAuth, type AppAuth, type AuthEnv } from "./auth.js";
import type { D1Like } from "./d1-dialect.js";

export interface Env extends AuthEnv {
  DB: D1Like;
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  /** Native rate-limit bindings (ADR-014); absent in some local runtimes. */
  RL_AUTH?: RateLimitLike;
  RL_ACCOUNT?: RateLimitLike;
}

/** Minimal shape of the Workers ratelimits binding (worker-configuration types not in main tsconfig). */
export interface RateLimitLike {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

// Fallback for runtimes without the ratelimits binding (older miniflare):
// best-effort in-memory sliding window per isolate. Production always uses
// the native binding (per-CF-location counters, ~0 CPU).
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();
export function __resetRateLimitsForTests(): void {
  hits.clear();
}
function fallbackRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) return false;
  recent.push(now);
  hits.set(key, recent);
  return true;
}
async function rateLimit(binding: RateLimitLike | undefined, fallbackKey: string, fallbackLimit: number): Promise<boolean> {
  if (binding) {
    const { success } = await binding.limit({ key: fallbackKey });
    return success;
  }
  return fallbackRateLimit(fallbackKey, fallbackLimit);
}

function json(data: unknown, status = 200, extra?: HeadersInit): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...extra,
    },
  });
}

function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

function originOf(request: Request): string {
  return new URL(request.url).origin;
}

// Constructing better-auth per request is too heavy for the 10 ms CPU budget,
// but D1 bindings are per-request. Pattern: build the auth instance once per
// isolate over a proxy that always resolves to the CURRENT request's DB.
let liveDb: Env["DB"] | undefined;
const proxyDb: D1Like = {
  prepare(query: string) {
    if (!liveDb) throw new Error("no live D1 binding");
    return liveDb.prepare(query);
  },
};
let cachedAuth: AppAuth | undefined;
let cachedOrigin: string | undefined;

function getAuth(env: Env, origin: string): AppAuth {
  liveDb = env.DB;
  if (!cachedAuth || cachedOrigin !== origin) {
    cachedAuth = createAuth(proxyDb, env, origin);
    cachedOrigin = origin;
  }
  return cachedAuth;
}

/** Same-origin gate for state-changing routes (CSRF): Origin or Fetch-Metadata must agree. */
function isSameOrigin(request: Request, appOrigin: string): boolean {
  const origin = request.headers.get("origin");
  if (origin) return origin === appOrigin;
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  return false;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const appOrigin = env.APP_ORIGIN ?? originOf(request);

    if (url.pathname === "/api/health") {
      if (request.method !== "GET") return json({ ok: false, error: { code: "method_not_allowed", message: "GET only" } }, 405);
      return json({ ok: true, data: checkHealth({ clock: { nowIso: () => new Date().toISOString() } }) });
    }

    if (url.pathname.startsWith("/api/auth/")) {
      if (!(await rateLimit(env.RL_AUTH, `auth:${clientIp(request)}`, 30))) {
        return json({ ok: false, error: { code: "rate_limited", message: "too many requests, try later" } }, 429);
      }
      const auth = getAuth(env, appOrigin);
      return auth.handler(request);
    }

    if (url.pathname === "/api/me") {
      if (request.method !== "GET") return json({ ok: false, error: { code: "method_not_allowed", message: "GET only" } }, 405);
      const auth = getAuth(env, appOrigin);
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return json({ ok: false, error: { code: "unauthorized", message: "sign in required" } }, 401);
      return json({
        ok: true,
        data: { user: { id: session.user.id, email: session.user.email, name: session.user.name, image: session.user.image } },
      });
    }

    if (url.pathname === "/api/account/export") {
      if (request.method !== "GET") return json({ ok: false, error: { code: "method_not_allowed", message: "GET only" } }, 405);
      const auth = getAuth(env, appOrigin);
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return json({ ok: false, error: { code: "unauthorized", message: "sign in required" } }, 401);
      const userId = session.user.id;
      const accounts = await env.DB.prepare("SELECT providerId, accountId, createdAt FROM account WHERE userId = ?")
        .bind(userId)
        .all<{ providerId: string; accountId: string; createdAt: number }>();
      return json({
        ok: true,
        data: {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          user: { id: userId, email: session.user.email, name: session.user.name },
          accounts: accounts.results ?? [],
          licks: [], // cloud lick/song tables land with sync; local data exports from the app
          songs: [],
        },
      });
    }

    if (url.pathname === "/api/account" && request.method === "DELETE") {
      if (!isSameOrigin(request, appOrigin)) {
        return json({ ok: false, error: { code: "forbidden", message: "origin check failed" } }, 403);
      }
      if (!(await rateLimit(env.RL_ACCOUNT, `account:${clientIp(request)}`, 10))) {
        return json({ ok: false, error: { code: "rate_limited", message: "too many requests, try later" } }, 429);
      }
      const auth = getAuth(env, appOrigin);
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) return json({ ok: false, error: { code: "unauthorized", message: "sign in required" } }, 401);
      const userId = session.user.id;
      // Hard delete, owner-scoped everywhere. Cloud lick/song tables join this list with sync.
      await env.DB.prepare("DELETE FROM session WHERE userId = ?").bind(userId).run();
      await env.DB.prepare("DELETE FROM account WHERE userId = ?").bind(userId).run();
      await env.DB.prepare("DELETE FROM verification WHERE identifier LIKE ?").bind(`%${userId}%`).run();
      await env.DB.prepare("DELETE FROM user WHERE id = ?").bind(userId).run();
      return json({ ok: true, data: { deleted: true } });
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ ok: false, error: { code: "not_found", message: "unknown api route" } }, 404);
    }
    return env.ASSETS.fetch(request);
  },
};
