// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// Sync API tests (workerd + real D1): round-trip, LWW, tombstones, cursor
// pull, and cross-user isolation (B must never read or overwrite A's rows).
import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import worker, { __resetRateLimitsForTests, type Env } from "../../src/worker/index.js";
import { createAuth } from "../../src/worker/auth.js";
import mig1 from "../../migrations/0001_init.sql?raw";
import mig2 from "../../migrations/0002_auth.sql?raw";
import mig3 from "../../migrations/0003_catalog.sql?raw";

const ORIGIN = "https://licklab.licklab.workers.dev";
const SECRET = "test-secret-please-ignore-32-chars-min";

function testEnv(): Env {
  return {
    DB: env.DB as unknown as Env["DB"],
    ASSETS: { fetch: async () => new Response("asset") },
    APP_ORIGIN: ORIGIN,
    BETTER_AUTH_SECRET: SECRET,
    OPEN_SIGNUP: "1",
  };
}

function testAuth(db: Env["DB"]) {
  return createAuth(db, testEnv(), ORIGIN, { enableEmailPassword: true });
}

async function signUpCookie(db: Env["DB"], email: string): Promise<string> {
  const res = (await testAuth(db).api.signUpEmail({
    body: { email, password: "password123", name: email.split("@")[0] as string },
    asResponse: true,
  })) as unknown as Response;
  const session = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  if (!session) throw new Error(`no session cookie for ${email}`);
  return session;
}

async function api(path: string, init?: RequestInit & { cookie?: string }): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.cookie) headers.set("cookie", init.cookie);
  headers.set("origin", ORIGIN);
  return worker.fetch(new Request(`${ORIGIN}${path}`, { ...init, headers }), testEnv());
}

const LICK_PAYLOAD = {
  id: "sync-lick-1",
  ownerId: "IGNORED-from-body",
  title: "Synced Line",
  pattern: [
    { steps: 0, semitones: 0, octaveOffset: 0, startBeat: 0, durationBeats: 1 },
    { steps: 2, semitones: 3, octaveOffset: 0, startBeat: 1, durationBeats: 1 },
    { steps: 4, semitones: 7, octaveOffset: 0, startBeat: 2, durationBeats: 1 },
    { steps: 6, semitones: 10, octaveOffset: 0, startBeat: 3, durationBeats: 1 },
  ],
  harmonicContext: {
    chords: [
      { symbol: "Dm7", beats: 4 },
      { symbol: "G7", beats: 4 },
    ],
    originalKey: "C",
    function: "ii-V-I major",
  },
  visibility: "private",
  license: "CC BY 4.0",
  source: { artist: "", instrument: "", track: "", album: "", year: null, recordingUrl: "", timestampSeconds: null, location: "" },
  tags: ["synced"],
  difficulty: 2,
  notes: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
  schemaVersion: 2,
};

interface ChangeResp {
  ok: boolean;
  data: {
    changes: { kind: string; id: string; ownerId: string; updatedAt: string; deletedAt: string | null; payload: { id?: string } }[];
    cursor: string;
  };
}
interface PushResp {
  ok: boolean;
  data: { applied: number; rejected: { index: number; error: string }[]; droppedStale: number };
}

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

describe("sync requires a session", () => {
  it("push and changes are both gated", async () => {
    __resetRateLimitsForTests();
    expect((await api("/api/sync/changes")).status).toBe(401);
    expect((await api("/api/sync/push", { method: "POST", body: JSON.stringify({ changes: [] }) })).status).toBe(401);
  });
});

describe("sync round-trip", () => {
  it("pushes a private lick and pulls it back with the session owner", async () => {
    __resetRateLimitsForTests();
    const db = env.DB as unknown as Env["DB"];
    const cookie = await signUpCookie(db, "sync-owner@example.com");
    const me = (await (await api("/api/me", { cookie })).json()) as { data: { user: { id: string } } };

    const push = await api("/api/sync/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cookie,
      body: JSON.stringify({ changes: [{ kind: "lick", id: "sync-lick-1", updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null, payload: LICK_PAYLOAD }] }),
    });
    expect(push.status).toBe(200);
    const pushBody = (await push.json()) as PushResp;
    expect(pushBody.data.applied).toBe(1);
    expect(pushBody.data.rejected).toEqual([]);

    // owner_id came from the session, never from the tampered body field.
    const row = await db.prepare("SELECT owner_id, visibility FROM lick WHERE id = ?").bind("sync-lick-1").first<{ owner_id: string; visibility: string }>();
    expect(row?.owner_id).toBe(me.data.user.id);
    expect(row?.visibility).toBe("private");

    // Pull from the beginning returns it.
    const pulled = (await (await api("/api/sync/changes", { cookie })).json()) as ChangeResp;
    const found = pulled.data.changes.find((c) => c.id === "sync-lick-1");
    expect(found?.kind).toBe("lick");
    expect((found?.payload as { id?: string }).id).toBe("sync-lick-1");

    // Pulling with a cursor past it yields nothing (monotonic cursor).
    const later = (await (await api(`/api/sync/changes?since=${pulled.data.cursor}`, { cookie })).json()) as ChangeResp;
    expect(later.data.changes.filter((c) => c.id === "sync-lick-1")).toHaveLength(0);
  });

  it("private synced licks never appear in the PUBLIC catalog", async () => {
    __resetRateLimitsForTests();
    const listed = await api("/api/licks?limit=50&publiccheck=1");
    const body = (await listed.json()) as { data: { licks: { lick: { id: string } }[] } };
    expect(body.data.licks.some((e) => e.lick.id === "sync-lick-1")).toBe(false);
  });
});

describe("sync LWW", () => {
  it("an older push is dropped, a newer one wins", async () => {
    __resetRateLimitsForTests();
    const db = env.DB as unknown as Env["DB"];
    const cookie = await signUpCookie(db, "sync-lww@example.com");
    const send = (updatedAt: string, title: string) =>
      api("/api/sync/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cookie,
        body: JSON.stringify({
          changes: [{ kind: "lick", id: "lww-1", updatedAt, deletedAt: null, payload: { ...LICK_PAYLOAD, id: "lww-1", title } }],
        }),
      });

    expect(((await send("2026-05-01T00:00:00.000Z", "Newest")) as Response).status).toBe(200);
    const stale = (await (await send("2026-01-01T00:00:00.000Z", "Ancient")).json()) as PushResp;
    expect(stale.data.applied).toBe(0);
    expect(stale.data.droppedStale).toBe(1);
    const row = await db.prepare("SELECT title FROM lick WHERE id = ?").bind("lww-1").first<{ title: string }>();
    expect(row?.title).toBe("Newest");

    const newer = (await (await send("2026-09-01T00:00:00.000Z", "Newer still")).json()) as PushResp;
    expect(newer.data.applied).toBe(1);
    const row2 = await db.prepare("SELECT title FROM lick WHERE id = ?").bind("lww-1").first<{ title: string }>();
    expect(row2?.title).toBe("Newer still");
  });
});
describe("sync tombstones", () => {
  it("a delete propagates as a tombstone and reaches other devices", async () => {
    __resetRateLimitsForTests();
    const db = env.DB as unknown as Env["DB"];
    const cookie = await signUpCookie(db, "sync-del@example.com");
    await api("/api/sync/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cookie,
      body: JSON.stringify({ changes: [{ kind: "lick", id: "del-1", updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null, payload: { ...LICK_PAYLOAD, id: "del-1" } }] }),
    });
    const push = await api("/api/sync/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cookie,
      body: JSON.stringify({ changes: [{ kind: "lick", id: "del-1", updatedAt: "2026-06-01T00:00:00.000Z", deletedAt: "2026-06-01T00:00:00.000Z", payload: { ...LICK_PAYLOAD, id: "del-1" } }] }),
    });
    expect(((await push.json()) as PushResp).data.applied).toBe(1);

    const row = await db.prepare("SELECT deleted_at FROM lick WHERE id = ?").bind("del-1").first<{ deleted_at: number | null }>();
    expect(row?.deleted_at).not.toBeNull(); // soft delete, not a hard wipe

    const pulled = (await (await api("/api/sync/changes", { cookie })).json()) as ChangeResp;
    const tomb = pulled.data.changes.find((c) => c.id === "del-1" && c.deletedAt !== null);
    expect(tomb).toBeDefined();
  });
});
describe("sync cross-user isolation", () => {
  it("user B can neither read nor overwrite user A's rows", async () => {
    __resetRateLimitsForTests();
    const db = env.DB as unknown as Env["DB"];
    const cookieA = await signUpCookie(db, "iso-a2@example.com");
    const cookieB = await signUpCookie(db, "iso-b2@example.com");
    await api("/api/sync/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cookie: cookieA,
      body: JSON.stringify({ changes: [{ kind: "lick", id: "owned-by-a", updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null, payload: { ...LICK_PAYLOAD, id: "owned-by-a" } }] }),
    });

    // B's pull must not contain A's record (guessing the id is not enough).
    const pulledB = (await (await api("/api/sync/changes", { cookie: cookieB })).json()) as ChangeResp;
    expect(pulledB.data.changes.some((c) => c.id === "owned-by-a")).toBe(false);

    // B pushing the same id must not mutate A's row (owner scope in the WHERE).
    const hijack = await api("/api/sync/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cookie: cookieB,
      body: JSON.stringify({ changes: [{ kind: "lick", id: "owned-by-a", updatedAt: "2026-09-09T00:00:00.000Z", deletedAt: null, payload: { ...LICK_PAYLOAD, id: "owned-by-a", title: "HIJACKED" } }] }),
    });
    expect(hijack.status).toBe(200);

    const stored = await db
      .prepare("SELECT owner_id, title FROM lick WHERE id = ?")
      .bind("owned-by-a")
      .first<{ owner_id: string; title: string }>();
    const meA = (await (await api("/api/me", { cookie: cookieA })).json()) as { data: { user: { id: string } } };
    const meB = (await (await api("/api/me", { cookie: cookieB })).json()) as { data: { user: { id: string } } };
    // B's push created (or updated) ONLY a row B owns; A's row is untouched.
    expect(stored?.owner_id).toBe(meA.data.user.id);
    expect(stored?.title).not.toBe("HIJACKED");
    expect(meA.data.user.id).not.toBe(meB.data.user.id);
  });
});
describe("sync validation + limits", () => {
  it("rejects malformed records with per-index errors and writes nothing", async () => {
    __resetRateLimitsForTests();
    const db = env.DB as unknown as Env["DB"];
    const cookie = await signUpCookie(db, "sync-bad@example.com");
    const res = await api("/api/sync/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cookie,
      body: JSON.stringify({
        changes: [
          { kind: "not-a-kind", id: "x", updatedAt: "2026-01-01T00:00:00.000Z", payload: {} },
          { kind: "lick", id: "y", updatedAt: "garbage", payload: {} },
          { kind: "lick", id: "z", updatedAt: "2026-01-01T00:00:00.000Z", payload: { title: "" } },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as PushResp;
    expect(body.data.applied).toBe(0);
    expect(body.data.rejected.map((r) => r.index)).toEqual([0, 1, 2]);
  });
  it("rejects an oversized push", async () => {
    __resetRateLimitsForTests();
    const db = env.DB as unknown as Env["DB"];
    const cookie = await signUpCookie(db, "sync-big@example.com");
    const changes = Array.from({ length: 41 }, (_, i) => ({
      kind: "lick",
      id: `b${i}`,
      updatedAt: "2026-01-01T00:00:00.000Z",
      payload: LICK_PAYLOAD,
    }));
    const res = await api("/api/sync/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cookie,
      body: JSON.stringify({ changes }),
    });
    expect(res.status).toBe(400);
  });
});
