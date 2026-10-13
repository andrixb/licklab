// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// worker: thin driving adapter. Routing → auth check → validate → use case → JSON.
// No business logic, no heavy compute here. Harmonic matching etc. run client-side.
import { checkHealth } from "../application/health.js";
import { createAuth, type AppAuth, type AuthEnv } from "./auth.js";
import type { D1Like } from "./d1-dialect.js";
import { patternHashOf, signaturesOf } from "../domain/signatures.js";
import { parseLick } from "../domain/lick.js";

interface LickRow {
  id: string;
  owner_id: string;
  title: string;
  pattern: string;
  harmonic_context: string;
  context_key: string;
  function_key: string;
  chord_quality: string | null;
  pattern_hash: string;
  visibility: string;
  license: string;
  moderation_state: string;
  source_artist: string | null;
  source_instrument: string | null;
  source_track: string | null;
  source_album: string | null;
  source_year: number | null;
  source_recording_url: string | null;
  source_timestamp_seconds: number | null;
  source_location: string | null;
  tags: string;
  difficulty: number;
  notes: string;
  likes: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  schema_version: number;
}

interface LickNote {
  steps: number;
  semitones: number;
  octaveOffset: number;
  startBeat: number;
  durationBeats: number;
}

interface LickChord {
  symbol: string;
  beats: number;
}

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
        .all() as { results: { providerId: string; accountId: string; createdAt: number }[] };
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

    // ----- Catalog API (public reads) -----
    if (url.pathname === "/api/licks" && request.method === "GET") {
      return handleListLicks(request, env);
    }
    if (url.pathname === "/api/licks/lookup" && request.method === "POST") {
      return handleLookupLicks(request, env);
    }
    if (url.pathname.startsWith("/api/licks/") && request.method === "GET") {
      return handleGetLick(request, env);
    }

    // ----- Authenticated catalog writes -----
    if (url.pathname === "/api/licks" && request.method === "POST") {
      return handleCreateLick(request, env);
    }
    if (url.pathname.match(/^\/api\/licks\/[^/]+\/like$/) && request.method === "POST") {
      return handleLikeLick(request, env);
    }
    if (url.pathname.match(/^\/api\/licks\/[^/]+\/like$/) && request.method === "DELETE") {
      return handleUnlikeLick(request, env);
    }

if (url.pathname.startsWith("/api/")) {
      return json({ ok: false, error: { code: "not_found", message: "unknown api route" } }, 404);
    }
    return env.ASSETS.fetch(request);
  },
};

// ----- Catalog API handlers -----


async function handleListLicks(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
  const functionFilter = url.searchParams.get("function");
  const difficultyFilter = url.searchParams.get("difficulty");
  const search = url.searchParams.get("search");
  const sort = url.searchParams.get("sort") ?? "likes";

  let sql = "SELECT * FROM lick WHERE visibility = 'public' AND moderation_state = 'approved' AND deleted_at IS NULL";
  const params: unknown[] = [];

  if (functionFilter) { sql += " AND function_key = ?"; params.push(functionFilter); }
  if (difficultyFilter) { sql += " AND difficulty = ?"; params.push(parseInt(difficultyFilter)); }
  if (search) { const term = "%" + search.toLowerCase() + "%"; sql += " AND (title LIKE ? OR notes LIKE ?)"; params.push(term, term); }
  sql += sort === "recency" ? " ORDER BY updated_at DESC" : " ORDER BY likes DESC, updated_at DESC";
  sql += " LIMIT ? OFFSET ?";
  params.push(limit, (page - 1) * limit);

  const { results: dbResults } = await env.DB.prepare(sql).bind(...params).all() as { results: LickRow[] };
  let countSql = "SELECT COUNT(*) as count FROM lick WHERE visibility = 'public' AND moderation_state = 'approved' AND deleted_at IS NULL";
  const countParams: unknown[] = [];
  if (functionFilter) { countSql += " AND function_key = ?"; countParams.push(functionFilter); }
  if (difficultyFilter) { countSql += " AND difficulty = ?"; countParams.push(parseInt(difficultyFilter)); }
  if (search) { const term = "%" + search.toLowerCase() + "%"; countSql += " AND (title LIKE ? OR notes LIKE ?)"; countParams.push(term, term); }
  const countRow = await env.DB.prepare(countSql).bind(...countParams).first<{ count: number }>();
  const total = countRow?.count ?? 0;

  const results = (dbResults ?? []).map(row => ({ lick: parseLick(row), likes: row.likes }));
  return json({ ok: true, data: { licks: results, page, limit, total } });
}
async function handleLookupLicks(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({ signatures: [] })) as { signatures?: string[] };
  const signatures = body.signatures ?? [];
  if (signatures.length === 0 || signatures.length > 100) {
    return json({ ok: false, error: { code: "invalid_input", message: "signatures array required (1-100 items)" } }, 400);
  }
  const placeholders = signatures.map(() => "?").join(",");
  const { results: dbResults } = await env.DB.prepare("SELECT * FROM lick WHERE visibility = 'public' AND moderation_state = 'approved' AND deleted_at IS NULL AND context_key IN (" + placeholders + ") ORDER BY likes DESC, updated_at DESC").bind(...signatures).all() as { results: LickRow[] };

  const results = dbResults.map(row => ({ lick: parseLick(row), likes: row.likes }));
  return json({ ok: true, data: { licks: results } });
}

async function handleGetLick(request: Request, env: Env): Promise<Response> {
  const id = request.url.split("/api/licks/")[1]?.split("?")[0];
  if (!id) return json({ ok: false, error: { code: "invalid_input", message: "lick id required" } }, 400);

  const row = await env.DB.prepare("SELECT * FROM lick WHERE id = ? AND visibility = 'public' AND moderation_state = 'approved' AND deleted_at IS NULL").bind(id).first() as LickRow | null;

  if (!row) return json({ ok: false, error: { code: "not_found", message: "lick not found" } }, 404);
  return json({ ok: true, data: { lick: parseLick(row) } });
}

async function handleCreateLick(request: Request, env: Env): Promise<Response> {
  const auth = getAuth(env, new URL(request.url).origin);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return json({ ok: false, error: { code: "unauthorized", message: "sign in required" } }, 401);

  const userId = session.user.id;
  if (!(await rateLimit(env.RL_AUTH, "create_lick:" + userId, 5))) {
    return json({ ok: false, error: { code: "rate_limited", message: "too many lick submissions, try later" } }, 429);
  }

  const quota = await env.DB.prepare("SELECT licks_created_today FROM user_quota WHERE user_id = ?").bind(session.user.id).first<{ licks_created_today: number }>();
  if (quota && quota.licks_created_today >= 20) {
    return json({ ok: false, error: { code: "quota_exceeded", message: "daily lick limit reached" } }, 429);
  }

  const body = await request.json().catch(() => ({})) as { title?: string; pattern?: LickNote[]; harmonicContext?: { chords: LickChord[]; originalKey: string; function: string }; visibility?: string; license?: string; source?: { artist?: string; instrument?: string; track?: string; album?: string; year?: number | null; recordingUrl?: string; timestampSeconds?: number | null; location?: string }; tags?: string[]; difficulty?: number; notes?: string };
  if (!body.title || !body.pattern || !body.harmonicContext) {
    return json({ ok: false, error: { code: "invalid_input", message: "title, pattern, harmonicContext required" } }, 400);
  }

  const sig = signaturesOf(body.harmonicContext.chords);
  const patternHash = patternHashOf(body.pattern, sig.contextKey);

  await env.DB.prepare("INSERT INTO lick (id, owner_id, title, pattern, harmonic_context, context_key, function_key, chord_quality, pattern_hash, visibility, license, moderation_state, source_artist, source_instrument, source_track, source_album, source_year, source_recording_url, source_timestamp_seconds, source_location, tags, difficulty, notes, likes, created_at, updated_at, deleted_at, schema_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(
    crypto.randomUUID(), session.user.id, body.title, JSON.stringify(body.pattern), JSON.stringify(body.harmonicContext),
    sig.contextKey, sig.functionKey, sig.chordQuality, patternHash,
    body.visibility ?? "private", body.license ?? "CC BY 4.0", "pending",
    body.source?.artist ?? "", body.source?.instrument ?? "", body.source?.track ?? "", body.source?.album ?? "",
    body.source?.year ?? null, body.source?.recordingUrl ?? "", body.source?.timestampSeconds ?? null, body.source?.location ?? "",
    JSON.stringify(body.tags ?? []), body.difficulty ?? 3, body.notes ?? "", 0, Date.now(), Date.now(), null, 2
  ).run();

  await env.DB.prepare("INSERT INTO user_quota (user_id, licks_created_today, last_reset_day) VALUES (?, 1, ?) ON CONFLICT(user_id) DO UPDATE SET licks_created_today = licks_created_today + 1, last_reset_day = CASE WHEN excluded.last_reset_day != user_quota.last_reset_day THEN excluded.last_reset_day ELSE user_quota.last_reset_day END").bind(session.user.id, Math.floor(Date.now() / 86400000)).run();

  return json({ ok: true, data: { lick: { id: crypto.randomUUID(), title: body.title } } }, 201);
}

async function handleLikeLick(request: Request, env: Env): Promise<Response> {
  const auth = getAuth(env, new URL(request.url).origin);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return json({ ok: false, error: { code: "unauthorized", message: "sign in required" } }, 401);

  const id = request.url.split("/api/licks/")[1]?.split("/like")[0];
  if (!id) return json({ ok: false, error: { code: "invalid_input", message: "lick id required" } }, 400);

  const lick = await env.DB.prepare("SELECT id, likes FROM lick WHERE id = ? AND visibility = 'public' AND moderation_state = 'approved' AND deleted_at IS NULL").bind(id).first<{ id: string; likes: number }>();
  if (!lick) return json({ ok: false, error: { code: "not_found", message: "lick not found" } }, 404);

  await env.DB.prepare("INSERT INTO lick_like (id, lick_id, user_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(lick_id, user_id) DO NOTHING").bind(crypto.randomUUID(), id, session.user.id, Date.now()).run();
  await env.DB.prepare("UPDATE lick SET likes = likes + 1 WHERE id = ?").bind(id).run();

  return json({ ok: true, data: { liked: true, likes: lick.likes + 1 } });
}

async function handleUnlikeLick(request: Request, env: Env): Promise<Response> {
  const auth = getAuth(env, new URL(request.url).origin);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return json({ ok: false, error: { code: "unauthorized", message: "sign in required" } }, 401);

  const id = request.url.split("/api/licks/")[1]?.split("/like")[0];
  if (!id) return json({ ok: false, error: { code: "invalid_input", message: "lick id required" } }, 400);

  const lick = await env.DB.prepare("SELECT id, likes FROM lick WHERE id = ? AND visibility = 'public' AND moderation_state = 'approved' AND deleted_at IS NULL").bind(id).first<{ id: string; likes: number }>();
  if (!lick) return json({ ok: false, error: { code: "not_found", message: "lick not found" } }, 404);

  const deleted = await env.DB.prepare("DELETE FROM lick_like WHERE lick_id = ? AND user_id = ?").bind(id, session.user.id).run() as { meta: { changes: number } };
  if (deleted.meta.changes > 0) {
    await env.DB.prepare("UPDATE lick SET likes = likes - 1 WHERE id = ?").bind(id).run();
  }
  return json({ ok: true, data: { liked: false, likes: Math.max(0, lick.likes - 1) } });
}
