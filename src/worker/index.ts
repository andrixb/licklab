// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// worker: thin driving adapter. Routing → auth check → validate → use case → JSON.
// No business logic, no heavy compute here. Harmonic matching etc. run client-side.
import { checkHealth } from "../application/health.js";
import { createAuth, type AppAuth, type AuthEnv } from "./auth.js";
import type { D1Like } from "./d1-dialect.js";
import { patternHashOf, signaturesOf } from "../domain/signatures.js";
import { fromRow } from "../adapters/d1/lick.js";

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
  RL_READ?: RateLimitLike;
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
      // Hard delete, owner-scoped everywhere (GDPR: no soft-deleted PII).
      // Order matters: children before parents (they may lack ON DELETE CASCADE
      // path in every runtime), and every statement is owner/user-scoped ONLY.
      await env.DB.prepare("DELETE FROM session WHERE userId = ?").bind(userId).run();
      await env.DB.prepare("DELETE FROM account WHERE userId = ?").bind(userId).run();
      await env.DB.prepare("DELETE FROM verification WHERE identifier LIKE ?").bind(`%${userId}%`).run();
      // Auth tables must die before user (they reference it).
      // Catalog rows this user created: their likes/favorites/packs go too.
      await env.DB.prepare("DELETE FROM lick_like WHERE user_id = ?").bind(userId).run();
      await env.DB.prepare("DELETE FROM favorite WHERE user_id = ?").bind(userId).run();
      await env.DB.prepare("DELETE FROM report WHERE reporter_id = ?").bind(userId).run();
      await env.DB.prepare("DELETE FROM user_quota WHERE user_id = ?").bind(userId).run();
      // Licks the user authored: hard-deleted, not tombstoned (account gone).
      await env.DB.prepare("DELETE FROM lick_tag WHERE lick_id IN (SELECT id FROM lick WHERE owner_id = ?)")
        .bind(userId)
        .run();
      await env.DB.prepare("DELETE FROM lick_like WHERE lick_id IN (SELECT id FROM lick WHERE owner_id = ?)")
        .bind(userId)
        .run();
      await env.DB.prepare("DELETE FROM report WHERE lick_id IN (SELECT id FROM lick WHERE owner_id = ?)")
        .bind(userId)
        .run();
      await env.DB.prepare("DELETE FROM pack_lick WHERE lick_id IN (SELECT id FROM lick WHERE owner_id = ?)")
        .bind(userId)
        .run();
      await env.DB.prepare("DELETE FROM favorite WHERE lick_id IN (SELECT id FROM lick WHERE owner_id = ?)")
        .bind(userId)
        .run();
      await env.DB.prepare("DELETE FROM lick WHERE owner_id = ?").bind(userId).run();
      // Packs: membership rows first, then the packs.
      await env.DB.prepare("DELETE FROM pack_lick WHERE pack_id IN (SELECT id FROM pack WHERE owner_id = ?)")
        .bind(userId)
        .run();
      await env.DB.prepare("DELETE FROM pack WHERE owner_id = ?").bind(userId).run();
      // Private progressions.
      await env.DB.prepare("DELETE FROM progression WHERE owner_id = ?").bind(userId).run();
      await env.DB.prepare("DELETE FROM user WHERE id = ?").bind(userId).run();
      return json({ ok: true, data: { deleted: true } });
    }

    // ----- Catalog API (public reads, edge-cached per ADR-013) -----
    if (url.pathname === "/api/licks" && request.method === "GET") {
      if (!(await rateLimit(env.RL_READ, `read:${clientIp(request)}`, 120))) {
        return json({ ok: false, error: { code: "rate_limited", message: "too many requests, try later" } }, 429);
      }
      return handleListLicks(request, env);
    }
    if (url.pathname === "/api/licks/lookup" && request.method === "POST") {
      if (!(await rateLimit(env.RL_READ, `read:${clientIp(request)}`, 120))) {
        return json({ ok: false, error: { code: "rate_limited", message: "too many requests, try later" } }, 429);
      }
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

    // ----- Collections: favorites + packs (session required) -----
    if (url.pathname === "/api/favorites" && request.method === "GET") return handleListFavorites(request, env);
    if (url.pathname.match(/^\/api\/licks\/[^/]+\/favorite$/) && request.method === "PUT")
      return handleAddFavorite(request, env);
    if (url.pathname.match(/^\/api\/licks\/[^/]+\/favorite$/) && request.method === "DELETE")
      return handleRemoveFavorite(request, env);

    if (url.pathname === "/api/packs" && request.method === "GET") return handleListPacks(request, env);
    if (url.pathname === "/api/packs" && request.method === "POST") return handleCreatePack(request, env);
    if (url.pathname.match(/^\/api\/packs\/[^/]+\/licks$/) && request.method === "POST") return handleAddToPack(request, env);
    if (url.pathname.match(/^\/api\/packs\/[^/]+\/licks\/[^/]+$/) && request.method === "DELETE")
      return handleRemoveFromPack(request, env);
    if (url.pathname.match(/^\/api\/packs\/[^/]+$/) && request.method === "GET") return handleGetPack(request, env);

if (url.pathname.startsWith("/api/")) {
      return json({ ok: false, error: { code: "not_found", message: "unknown api route" } }, 404);
    }
    return env.ASSETS.fetch(request);
  },
};

// ----- Catalog API handlers -----

/**
 * Edge cache for public catalog reads (ADR-013): anonymous traffic shares
 * the free-tier budget (100k req/d, 5M rows read/d), so cache public GETs
 * at the edge for `PUBLIC_MAX_AGE` with `stale-while-revalidate`.
 * A short TTL keeps likes/new licks fresh enough; `If-None-Match` clients
 * get 304 without a body. Falling back to a live fetch on any cache miss.
 */
const PUBLIC_MAX_AGE = 300;
const PUBLIC_SWR = 60;
const CACHE_NAME = "licklab-public";

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cacheableJson(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": `public, s-maxage=${PUBLIC_MAX_AGE}, stale-while-revalidate=${PUBLIC_SWR}, max-age=60`,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

/**
 * Cache-first public read: builds `data` only on miss, keys by
 * path+query, revalidates against the client's ETag (304) or a background
 * SWR refresh. Handlers stay cache-agnostic — they just return a Response.
 */
function cachedPublicGet(request: Request, build: () => Promise<Response>): Promise<Response> {
  const url = new URL(request.url);
  const key = new Request(`${url.origin}${url.pathname}${url.search}`, { method: "GET" });
  const cachePromise = caches.open(CACHE_NAME);
  return cachePromise.then(async (cache) => {
    const hit = await cache.match(key);
    const hitEtag = hit?.headers.get("etag") ?? null;
    if (hit) {
      // Revalidate cheaply: identical body -> 304 for the client.
      if (hitEtag && request.headers.get("if-none-match") === hitEtag) {
        return new Response(null, { status: 304, headers: { etag: hitEtag } });
      }
      // Serve stale and refresh in the background when still fresh enough.
      const birth = Number(hit.headers.get("cache-birth") ?? "0");
      const now = Math.floor(Date.now() / 1000);
      if (now - birth > PUBLIC_MAX_AGE + PUBLIC_SWR) {
        const fresh = await build();
        const freshEtag = await sha256Hex(await fresh.clone().text());
        if (hitEtag === freshEtag) {
          return new Response(null, { status: 304, headers: { etag: freshEtag } });
        }
        const stamped = stampEtag(fresh, freshEtag, now);
        await cache.put(key, stamped.clone());
        return stamped;
      }
      return hit;
    }
    const fresh = await build();
    const body = await fresh.clone().text();
    const stamped = stampEtag(fresh, await sha256Hex(body), Math.floor(Date.now() / 1000));
    await cache.put(key, stamped.clone());
    return stamped;
  });
}

/**
 * Drop cached public reads whose path starts with /api/licks. The catalog is
 * written to (creates, likes) far less often than read, and the entries
 * number in the tens, so an invalidate-on-write keeps the 5-minute TTL from
 * showing a user's own new lick as missing.
 */
async function invalidatePublicReads(): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    for (const key of keys) {
      const path = new URL(key.url).pathname;
      if (path === "/api/licks" || path.startsWith("/api/licks/")) await cache.delete(key);
    }
  } catch {
    /* cache unavailable (local dev) — reads still work, just uncached */
  }
}

/** Copy `fresh` with an ETag + cache birth marker so later reads can age it. */
function stampEtag(fresh: Response, etag: string, birth: number): Response {
  const stamped = new Response(fresh.body, {
    status: fresh.status,
    headers: { ...Object.fromEntries(fresh.headers), etag, "cache-birth": String(birth) },
  });
  return stamped;
}

async function handleListLicks(request: Request, env: Env): Promise<Response> {
  return cachedPublicGet(request, () => buildListLicks(request, env));
}

async function buildListLicks(request: Request, env: Env): Promise<Response> {
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

  const results = (dbResults ?? []).map(row => ({ lick: fromRow(row), likes: row.likes }));
  return cacheableJson({ ok: true, data: { licks: results, page, limit, total } });
}
async function handleLookupLicks(request: Request, env: Env): Promise<Response> {
  return cachedPublicGet(request, () => buildLookupLicks(request, env));
}

async function buildLookupLicks(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({ signatures: [] })) as { signatures?: string[] };
  const signatures = body.signatures ?? [];
  if (signatures.length === 0 || signatures.length > 100) {
    return json({ ok: false, error: { code: "invalid_input", message: "signatures array required (1-100 items)" } }, 400);
  }
  const placeholders = signatures.map(() => "?").join(",");
  const { results: dbResults } = await env.DB.prepare("SELECT * FROM lick WHERE visibility = 'public' AND moderation_state = 'approved' AND deleted_at IS NULL AND context_key IN (" + placeholders + ") ORDER BY likes DESC, updated_at DESC").bind(...signatures).all() as { results: LickRow[] };

  const results = dbResults.map(row => ({ lick: fromRow(row), likes: row.likes }));
  return cacheableJson({ ok: true, data: { licks: results } });
}

async function handleGetLick(request: Request, env: Env): Promise<Response> {
  return cachedPublicGet(request, () => buildGetLick(request, env));
}

async function buildGetLick(request: Request, env: Env): Promise<Response> {
  const id = request.url.split("/api/licks/")[1]?.split("?")[0];
  if (!id) return json({ ok: false, error: { code: "invalid_input", message: "lick id required" } }, 400);

  const row = await env.DB.prepare("SELECT * FROM lick WHERE id = ? AND visibility = 'public' AND moderation_state = 'approved' AND deleted_at IS NULL").bind(id).first() as LickRow | null;

  if (!row) return json({ ok: false, error: { code: "not_found", message: "lick not found" } }, 404);
  return cacheableJson({ ok: true, data: { lick: fromRow(row) } });
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
    body.visibility ?? "private", body.license ?? "CC BY 4.0", "approved",
    body.source?.artist ?? "", body.source?.instrument ?? "", body.source?.track ?? "", body.source?.album ?? "",
    body.source?.year ?? null, body.source?.recordingUrl ?? "", body.source?.timestampSeconds ?? null, body.source?.location ?? "",
    JSON.stringify(body.tags ?? []), body.difficulty ?? 3, body.notes ?? "", 0, Date.now(), Date.now(), null, 2
  ).run();

  await invalidatePublicReads();
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

// ---- Collections: favorites + packs (session-gated, owner-scoped) ----

async function currentUserId(request: Request, env: Env): Promise<string | null> {
  const auth = getAuth(env, new URL(request.url).origin);
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

function jsonError(code: string, message: string, status: number): Response {
  return json({ ok: false, error: { code, message } }, status);
}

class Unauthorized extends Error {}

async function withSession(request: Request, env: Env, fn: (userId: string) => Promise<Response>): Promise<Response> {
  const userId = await currentUserId(request, env);
  if (!userId) return jsonError("unauthorized", "sign in required", 401);
  try {
    return await fn(userId);
  } catch (e) {
    if (e instanceof Unauthorized) return jsonError("unauthorized", "sign in required", 401);
    throw e;
  }
}

/** Favorites: list the caller's, newest first, with lick rows joined. */
async function handleListFavorites(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async (userId) => {
    const { results } = (await env.DB.prepare(
      `SELECT l.* FROM favorite f JOIN lick l ON l.id = f.lick_id
       WHERE f.user_id = ? AND l.deleted_at IS NULL
       ORDER BY f.created_at DESC LIMIT 200`,
    )
      .bind(userId)
      .all()) as { results: LickRow[] };
    return json({ ok: true, data: { licks: results.map((r) => ({ lick: fromRow(r), likes: r.likes })) } });
  });
}

async function handleAddFavorite(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async (userId) => {
    const id = lickIdFrom(request.url);
    if (!id) return jsonError("invalid_input", "lick id required", 400);
    // The lick must exist (any visibility: you may favorite your own).
    const lick = await env.DB.prepare("SELECT id FROM lick WHERE id = ? AND deleted_at IS NULL").bind(id).first<{ id: string }>();
    if (!lick) return jsonError("not_found", "lick not found", 404);
    // Idempotent: (user_id, lick_id) is UNIQUE, so a re-favorite is a no-op
    // and we report the pre-existing row as success rather than a 500.
    await env.DB.prepare(
      "INSERT OR IGNORE INTO favorite (id, user_id, lick_id, created_at) VALUES (?, ?, ?, ?)",
    )
      .bind(crypto.randomUUID(), userId, id, Date.now())
      .run();
    return json({ ok: true, data: { favorited: true } }, 201);
  });
}

async function handleRemoveFavorite(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async (userId) => {
    const id = lickIdFrom(request.url);
    if (!id) return jsonError("invalid_input", "lick id required", 400);
    const r = await env.DB.prepare("DELETE FROM favorite WHERE user_id = ? AND lick_id = ?").bind(userId, id).run();
    if ((r as { meta: { changes: number } }).meta.changes === 0) return jsonError("not_found", "not favorited", 404);
    return json({ ok: true, data: { favorited: false } });
  });
}

function lickIdFrom(url: string): string | null {
  const m = /\/api\/licks\/([^/]+)\/favorite/.exec(new URL(url).pathname);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

// ---- Packs ----

const PACK_SHORT_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz"; // no 0/1/o/l

/** Short, unguessable-ish share id (8 chars, unambiguous alphabet). */
function shortId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => PACK_SHORT_ALPHABET[b % PACK_SHORT_ALPHABET.length]).join("");
}

function packFromRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    shortId: row.short_id,
    createdAt: new Date(row.created_at as number).toISOString(),
    updatedAt: new Date(row.updated_at as number).toISOString(),
    deletedAt: row.deleted_at ? new Date(row.deleted_at as number).toISOString() : null,
  };
}

async function handleListPacks(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async (userId) => {
    const mine = (await env.DB.prepare("SELECT * FROM pack WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 100")
      .bind(userId)
      .all()) as { results: Record<string, unknown>[] };
    return json({ ok: true, data: { packs: (mine.results ?? []).map(packFromRow) } });
  });
}

async function handleCreatePack(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async (userId) => {
    const body = (await request.json().catch(() => ({}))) as { title?: string; description?: string; visibility?: string };
    const title = (body.title ?? "").trim();
    if (!title || title.length > 120) return jsonError("invalid_input", "title required (<=120 chars)", 400);
    const visibility = body.visibility === "unlisted" || body.visibility === "public" ? body.visibility : "private";
    const now = Date.now();
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO pack (id, owner_id, title, description, visibility, short_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(id, userId, title, body.description ?? "", visibility, shortId(), now, now)
      .run();
    const row = (await env.DB.prepare("SELECT * FROM pack WHERE id = ?").bind(id).first()) as Record<string, unknown>;
    return json({ ok: true, data: { pack: packFromRow(row) } }, 201);
  });
}

async function handleGetPack(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const id = url.pathname.slice("/api/packs/".length);
  if (!id) return jsonError("invalid_input", "pack id required", 400);
  // Public/unlisted packs are readable by anyone sharing the link; private
  // ones only by their owner (there is no guessing without the session).
  const row = (await env.DB.prepare("SELECT * FROM pack WHERE id = ? AND deleted_at IS NULL").bind(id).first()) as
    | Record<string, unknown>
    | null;
  if (!row) return jsonError("not_found", "pack not found", 404);
  const viewer = await currentUserId(request, env);
  if (row.visibility === "private" && row.owner_id !== viewer) {
    return jsonError("forbidden", "private pack", 403);
  }
  const members = (await env.DB.prepare(
    `SELECT l.*, pl.position AS pack_position FROM pack_lick pl
     JOIN lick l ON l.id = pl.lick_id
     WHERE pl.pack_id = ? AND l.deleted_at IS NULL
     ORDER BY pl.position ASC LIMIT 200`,
  )
    .bind(id)
    .all()) as { results: LickRow[] };
  return json({
    ok: true,
    data: {
      pack: packFromRow(row),
      licks: (members.results ?? []).map((r) => ({ lick: fromRow(r), likes: r.likes })),
    },
  });
}

async function handleAddToPack(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async (userId) => {
    const packId = packIdFrom(request.url);
    if (!packId) return jsonError("invalid_input", "pack id required", 400);
    const body = (await request.json().catch(() => ({}))) as { lickId?: string };
    const lickId = body.lickId?.trim();
    if (!lickId) return jsonError("invalid_input", "lickId required", 400);
    const pack = (await env.DB.prepare("SELECT id, owner_id FROM pack WHERE id = ? AND deleted_at IS NULL")
      .bind(packId)
      .first()) as { id: string; owner_id: string } | null;
    if (!pack) return jsonError("not_found", "pack not found", 404);
    if (pack.owner_id !== userId) return jsonError("forbidden", "not your pack", 403);
    const lick = await env.DB.prepare("SELECT id FROM lick WHERE id = ? AND deleted_at IS NULL").bind(lickId).first<{ id: string }>();
    if (!lick) return jsonError("not_found", "lick not found", 404);
    const next = (await env.DB.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM pack_lick WHERE pack_id = ?")
      .bind(packId)
      .first<{ pos: number }>()) ?? { pos: 0 };
    await env.DB.prepare("INSERT OR REPLACE INTO pack_lick (pack_id, lick_id, position) VALUES (?, ?, ?)")
      .bind(packId, lickId, next.pos)
      .run();
    await env.DB.prepare("UPDATE pack SET updated_at = ? WHERE id = ?").bind(Date.now(), packId).run();
    return json({ ok: true, data: { added: true } }, 201);
  });
}

async function handleRemoveFromPack(request: Request, env: Env): Promise<Response> {
  return withSession(request, env, async (userId) => {
    const m = /\/api\/packs\/([^/]+)\/licks\/([^/]+)$/.exec(new URL(request.url).pathname);
    if (!m) return jsonError("invalid_input", "pack and lick ids required", 400);
    const packId = decodeURIComponent(m[1] as string);
    const lickId = decodeURIComponent(m[2] as string);
    const pack = (await env.DB.prepare("SELECT id, owner_id FROM pack WHERE id = ? AND deleted_at IS NULL")
      .bind(packId)
      .first()) as { id: string; owner_id: string } | null;
    if (!pack) return jsonError("not_found", "pack not found", 404);
    if (pack.owner_id !== userId) return jsonError("forbidden", "not your pack", 403);
    const r = await env.DB.prepare("DELETE FROM pack_lick WHERE pack_id = ? AND lick_id = ?").bind(packId, lickId).run();
    await env.DB.prepare("UPDATE pack SET updated_at = ? WHERE id = ?").bind(Date.now(), packId).run();
    if ((r as { meta: { changes: number } }).meta.changes === 0) return jsonError("not_found", "not in pack", 404);
    return json({ ok: true, data: { removed: true } });
  });
}

function packIdFrom(url: string): string | null {
  const m = /\/api\/packs\/([^/]+)\/licks/.exec(new URL(url).pathname);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}
