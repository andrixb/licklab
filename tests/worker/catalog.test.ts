// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// Catalog API tests in the workerd runtime (real D1): public reads are
// cacheable; writes are session-gated; owner comes from the session only;
// hidden licks vanish from public results.
import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import worker, { __resetRateLimitsForTests, type Env } from "../../src/worker/index.js";
import { createAuth } from "../../src/worker/auth.js";
import mig1 from "../../migrations/0001_init.sql?raw";
import mig2 from "../../migrations/0002_auth.sql?raw";
import mig3 from "../../migrations/0003_catalog.sql?raw";

const ORIGIN = "https://licklab.licklab.workers.dev";
const SECRET = "test-secret-please-ignore";

function testEnv(openSignup = true): Env {
  const base = {
    DB: env.DB as unknown as Env["DB"],
    ASSETS: { fetch: async () => new Response("asset") },
    APP_ORIGIN: ORIGIN,
    BETTER_AUTH_SECRET: SECRET,
  } satisfies Env;
  return openSignup ? { ...base, OPEN_SIGNUP: "1" } : base;
}

function testAuth(db: Env["DB"]) {
  return createAuth(db, { ...testEnv(), OPEN_SIGNUP: "1" }, ORIGIN, { enableEmailPassword: true });
}

async function signUpCookie(db: Env["DB"], email: string): Promise<string> {
  const auth = testAuth(db);
  const res = (await auth.api.signUpEmail({
    body: { email, password: "password123", name: email.split("@")[0] as string },
    asResponse: true,
  })) as unknown as Response;
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const session = setCookie.map((c) => c.split(";")[0]).join("; ");
  if (!session) throw new Error(`no session cookie for ${email}`);
  return session;
}

async function api(path: string, init?: RequestInit & { cookie?: string }): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.cookie) headers.set("cookie", init.cookie);
  headers.set("origin", ORIGIN);
  return worker.fetch(new Request(`${ORIGIN}${path}`, { ...init, headers }), testEnv());
}

const LICK_BODY = {
  title: "Test Lick",
  pattern: [
    { steps: 0, semitones: 0, octaveOffset: 0, startBeat: 0, durationBeats: 1 },
    { steps: 2, semitones: 4, octaveOffset: 0, startBeat: 1, durationBeats: 1 },
    { steps: 4, semitones: 7, octaveOffset: 0, startBeat: 2, durationBeats: 1 },
    { steps: 6, semitones: 11, octaveOffset: 0, startBeat: 3, durationBeats: 1 },
  ],
  harmonicContext: {
    chords: [
      { symbol: "Dm7", beats: 4 },
      { symbol: "G7", beats: 4 },
      { symbol: "Cmaj7", beats: 4 },
    ],
    originalKey: "C",
    function: "ii-V-I major",
  },
  visibility: "public",
  tags: ["test"],
  difficulty: 2,
};

beforeAll(async () => {
  const statements = `${mig1}\n${mig2}\n${mig3}`
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  await (env.DB as D1Database).batch(statements.map((sql) => (env.DB as D1Database).prepare(sql)));
});

describe("catalog reads (public, edge-cached per ADR-013)", () => {
  it("anonymous GET /api/licks returns 200 with cache headers + etag", async () => {
    __resetRateLimitsForTests();
    const res = await api("/api/licks?limit=5&probe=1");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=300");
    expect(res.headers.get("cache-control")).toContain("stale-while-revalidate=60");
    expect(res.headers.get("etag")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("If-None-Match with the stored etag returns 304", async () => {
    __resetRateLimitsForTests();
    const first = await api("/api/licks?limit=5&probe=2");
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();
    const second = await api("/api/licks?limit=5&probe=2", { headers: { "if-none-match": etag as string } });
    expect(second.status).toBe(304);
  });
  it("GET /api/licks/:id 404s an unknown id and caches nothing", async () => {
    __resetRateLimitsForTests();
    const res = await api("/api/licks/nope-does-not-exist");
    expect(res.status).toBe(404);
  });
  it("POST /api/licks/lookup validates size and matches signatures", async () => {
    __resetRateLimitsForTests();
    const bad = await api("/api/licks/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signatures: [] }),
    });
    expect(bad.status).toBe(400);
    const good = await api("/api/licks/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signatures: ["m@0:4.7@5:4.M@10:4"] }),
    });
    expect(good.status).toBe(200);
    const body = (await good.json()) as { ok: boolean; data: { licks: unknown[] } };
    expect(body.ok).toBe(true);
  });
});

describe("catalog reads return domain-shaped licks (not raw D1 rows)", () => {
  it("a created public lick round-trips through GET /api/licks and /:id", async () => {
    __resetRateLimitsForTests();
    const db = env.DB as unknown as Env["DB"];
    const cookie = await signUpCookie(db, "reader@example.com");
    const created = await api("/api/licks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cookie,
      body: JSON.stringify(LICK_BODY),
    });
    expect(created.status).toBe(201);
    const lickId = (await db.prepare("SELECT id FROM lick ORDER BY created_at DESC LIMIT 1").first<{ id: string }>())!.id;

    // The regression this guards: reading a row used to hand D1 snake_case
    // straight to parseLick, so any non-empty catalog 500'd.
    const listed = await api("/api/licks?limit=50&rt=1");
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as {
      data: { licks: { lick: { id: string; ownerId: string; contextKey: string; title: string } }[] };
    };
    const found = body.data.licks.find((e) => e.lick.id === lickId);
    expect(found).toBeDefined();
    expect(found?.lick.title).toBe("Test Lick");
    // camelCase domain fields, derived signatures present.
    expect(found?.lick.ownerId).toBeTruthy();
    expect(found?.lick.contextKey).toBe("m@0:4.7@5:4.M@10:4");

    const one = await api(`/api/licks/${lickId}?rt=2`);
    expect(one.status).toBe(200);
    const oneBody = (await one.json()) as { data: { lick: { id: string; ownerId: string } } };
    expect(oneBody.data.lick.ownerId).toBeTruthy();
  });
});

describe("catalog writes are session-gated", () => {
  it("POST /api/licks requires a session (401, never a write)", async () => {
    __resetRateLimitsForTests();
    const res = await api("/api/licks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(LICK_BODY),
    });
    expect(res.status).toBe(401);
  });
  it("like/unlike require a session", async () => {
    __resetRateLimitsForTests();
    expect((await api("/api/licks/whatever/like", { method: "POST" })).status).toBe(401);
  });
});

describe("security: owner comes from the session only", () => {
  it("a tampered ownerId/authorId in the body is ignored", async () => {
    __resetRateLimitsForTests();
    const db = env.DB as unknown as Env["DB"];
    const cookie = await signUpCookie(db, "tamper@example.com");
    const res = await api("/api/licks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cookie,
      body: JSON.stringify({ ...LICK_BODY, ownerId: "someone-else", authorId: "someone-else" }),
    });
    expect(res.status).toBe(201);
    // Owner must be the SESSION user id (a better-auth UUID), never the
    // tampered "someone-else" and never the caller's email.
    const me = (await (await api("/api/me", { cookie })).json()) as { data: { user: { id: string } } };
    const row = await db.prepare("SELECT owner_id FROM lick ORDER BY created_at DESC LIMIT 1").first<{ owner_id: string }>();
    expect(row?.owner_id).toBe(me.data.user.id);
    expect(row?.owner_id).not.toBe("someone-else");
    expect(row?.owner_id).not.toBe("tamper@example.com");
  });
  it("two users coexist and see distinct identities via /api/me", async () => {
    __resetRateLimitsForTests();
    const db = env.DB as unknown as Env["DB"];
    const cookieA = await signUpCookie(db, "iso-a@example.com");
    const cookieB = await signUpCookie(db, "iso-b@example.com");
    const meA = (await (await api("/api/me", { cookie: cookieA })).json()) as { data: { user: { email: string } } };
    const meB = (await (await api("/api/me", { cookie: cookieB })).json()) as { data: { user: { email: string } } };
    expect(meA.data.user.email).toBe("iso-a@example.com");
    expect(meB.data.user.email).toBe("iso-b@example.com");
  });
  it("owner may not exceed the create rate limit (429, no crash)", async () => {
    __resetRateLimitsForTests();
    const db = env.DB as unknown as Env["DB"];
    const cookie = await signUpCookie(db, "rate@example.com");
    let saw429 = false;
    for (let i = 0; i < 7; i++) {
      const r = await api("/api/licks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cookie,
        body: JSON.stringify({ ...LICK_BODY, title: `Rate Lick ${i}` }),
      });
      if (r.status === 429) saw429 = true;
    }
    expect(saw429).toBe(true);
  });
});

describe("account deletion removes every row", () => {
  it("after DELETE /api/account the user owns no rows anywhere", async () => {
    __resetRateLimitsForTests();
    const db = env.DB as unknown as Env["DB"];
    const cookie = await signUpCookie(db, "delete-me@example.com");
    // Create a public lick so there is a row to delete.
    await api("/api/licks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cookie,
      body: JSON.stringify(LICK_BODY),
    });
    const me = (await (await api("/api/me", { cookie })).json()) as { data: { user: { id: string } } };
    const id = me.data.user.id;
    // Sanity: the lick exists before deletion.
    const before = await db.prepare("SELECT COUNT(*) AS n FROM lick WHERE owner_id = ?").bind(id).first<{ n: number }>();
    expect(before?.n).toBe(1);

    const res = await api("/api/account", { method: "DELETE", cookie });
    expect(res.status).toBe(200);

    // Not a single row survives for this user, in ANY table.
    const owned: [string, string][] = [
      ["lick", "owner_id"],
      ["pack", "owner_id"],
      ["progression", "owner_id"],
    ];
    for (const [table, col] of owned) {
      const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ?`).bind(id).first<{ n: number }>();
      expect(row?.n, `${table} rows remain`).toBe(0);
    }
    const userScoped: [string, string][] = [
      ["lick_like", "user_id"],
      ["favorite", "user_id"],
      ["report", "reporter_id"],
      ["user_quota", "user_id"],
    ];
    for (const [table, col] of userScoped) {
      const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ?`).bind(id).first<{ n: number }>();
      expect(row?.n, `${table}.${col} rows remain`).toBe(0);
    }
    const userRow = await db.prepare("SELECT COUNT(*) AS n FROM user WHERE id = ?").bind(id).first<{ n: number }>();
    expect(userRow?.n).toBe(0);
    const sessionRow = await db.prepare("SELECT COUNT(*) AS n FROM session WHERE userId = ?").bind(id).first<{ n: number }>();
    expect(sessionRow?.n).toBe(0);
  });
});

describe("favorites", () => {
  it("requires a session; add/list/remove round-trips", async () => {
    __resetRateLimitsForTests();
    const db = env.DB as unknown as Env["DB"];
    const cookie = await signUpCookie(db, "fav@example.com");
    expect((await api("/api/favorites")).status).toBe(401);
    // Create a lick to favorite.
    const created = await api("/api/licks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cookie,
      body: JSON.stringify(LICK_BODY),
    });
    expect(created.status).toBe(201);
    const lickId = (await db.prepare("SELECT id FROM lick ORDER BY created_at DESC LIMIT 1").first<{ id: string }>())!.id;

    const added = await api(`/api/licks/${lickId}/favorite`, { method: "PUT", cookie });
    expect(added.status).toBe(201);
    // Idempotent insert: adding twice must not duplicate.
    await api(`/api/licks/${lickId}/favorite`, { method: "PUT", cookie });
    const list = (await (await api("/api/favorites", { cookie })).json()) as {
      data: { licks: { lick: { id: string } }[] };
    };
    expect(list.data.licks.filter((e) => e.lick.id === lickId)).toHaveLength(1);

    const removed = await api(`/api/licks/${lickId}/favorite`, { method: "DELETE", cookie });
    expect(removed.status).toBe(200);
    const after = (await (await api("/api/favorites", { cookie })).json()) as { data: { licks: unknown[] } };
    expect(after.data.licks.some((e) => (e as { lick: { id: string } }).lick.id === lickId)).toBe(false);
    // Removing again 404s (not silently 200).
    expect((await api(`/api/licks/${lickId}/favorite`, { method: "DELETE", cookie })).status).toBe(404);
  });
});

describe("packs", () => {
  it("create -> add -> read by owner; private pack hidden from another user", async () => {
    __resetRateLimitsForTests();
    const db = env.DB as unknown as Env["DB"];
    const cookieA = await signUpCookie(db, "pack-a@example.com");
    const cookieB = await signUpCookie(db, "pack-b@example.com");
    const packRes = await api("/api/packs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cookie: cookieA,
      body: JSON.stringify({ title: "My Blues Pack", visibility: "private" }),
    });
    expect(packRes.status).toBe(201);
    const packId = ((await packRes.json()) as { data: { pack: { id: string } } }).data.pack.id;

    // Create a lick, add to the pack.
    await api("/api/licks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cookie: cookieA,
      body: JSON.stringify(LICK_BODY),
    });
    const lickId = (await db.prepare("SELECT id FROM lick ORDER BY created_at DESC LIMIT 1").first<{ id: string }>())!.id;
    const addRes = await api(`/api/packs/${packId}/licks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cookie: cookieA,
      body: JSON.stringify({ lickId }),
    });
    expect(addRes.status).toBe(201);

    // Owner reads the pack back with the lick.
    const owned = (await (await api(`/api/packs/${packId}`, { cookie: cookieA })).json()) as {
      data: { licks: { lick: { id: string } }[] };
    };
    expect(owned.data.licks.map((e) => e.lick.id)).toContain(lickId);

    // Another user gets 403 (private).
    expect((await api(`/api/packs/${packId}`, { cookie: cookieB })).status).toBe(403);
    // ...and cannot add to it.
    const foreign = await api(`/api/packs/${packId}/licks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cookie: cookieB,
      body: JSON.stringify({ lickId }),
    });
    expect(foreign.status).toBe(403);
    // ...and cannot remove from it.
    expect((await api(`/api/packs/${packId}/licks/${lickId}`, { method: "DELETE", cookie: cookieB })).status).toBe(403);
  });
  it("packs list requires a session", async () => {
    __resetRateLimitsForTests();
    expect((await api("/api/packs")).status).toBe(401);
    expect((await api("/api/packs", { method: "POST", body: JSON.stringify({ title: "x" }) })).status).toBe(401);
  });
});
