// Worker auth tests (workerd + local D1). OAuth providers are not hit:
// sessions are minted through a test-only better-auth instance with
// email+password enabled against the SAME dialect+schema, then exercised
// against the real worker routes (prod config).
import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import worker, { __resetRateLimitsForTests, type Env } from "../../src/worker/index.js";
import { createAuth } from "../../src/worker/auth.js";
import mig1 from "../../migrations/0001_init.sql?raw";
import mig2 from "../../migrations/0002_auth.sql?raw";

const ORIGIN = "http://localhost";
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
  // Same factory as production; email+password enabled ONLY to mint sessions
  // without hitting OAuth providers. Schema, dialect, gate, and secret match.
  return createAuth(db, { ...testEnv(), OPEN_SIGNUP: "1" }, ORIGIN, { enableEmailPassword: true });
}

async function signUpCookie(db: Env["DB"], email: string): Promise<string> {
  const auth = testAuth(db);
  const res = await auth.api.signUpEmail({
    body: { email, password: "password123", name: email.split("@")[0] as string },
    asResponse: true,
  });
  const setCookie = (res as unknown as Response).headers.getSetCookie?.() ?? [];
  const session = setCookie.map((c) => c.split(";")[0]).join("; ");
  if (!session) throw new Error(`no session cookie for ${email}`);
  return session;
}

async function get(path: string, db: Env["DB"], cookie?: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (cookie) headers.set("cookie", cookie);
  return worker.fetch(new Request(`${ORIGIN}${path}`, { ...init, headers }), { ...testEnv(), DB: db });
}

beforeAll(async () => {
  const statements = `${mig1}\n${mig2}`
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  await (env.DB as D1Database).batch(statements.map((sql) => (env.DB as D1Database).prepare(sql)));
});

describe("auth routes", () => {
  it("/api/me requires a session", async () => {
    const db = testEnv().DB;
    const anon = await get("/api/me", db);
    expect(anon.status).toBe(401);
    const cookie = await signUpCookie(db, "a@example.com");
    const me = (await (await get("/api/me", db, cookie)).json()) as { ok: boolean; data: { user: { email: string } } };
    expect(me.ok).toBe(true);
    expect(me.data.user.email).toBe("a@example.com");
  });

  it("sign-up gate blocks unlisted emails when closed", async () => {
    const db = testEnv().DB;
    const gatedEnv = testEnv(false);
    const gated = createAuth(db, gatedEnv, ORIGIN, { enableEmailPassword: true });
    await expect(
      gated.api.signUpEmail({ body: { email: "stranger@example.com", password: "password123", name: "s" } }),
    ).rejects.toThrow();
    // Allowlisted email passes.
    await db.prepare("INSERT INTO allowed_email (email, createdAt) VALUES (?, ?)").bind("friend@example.com", Date.now()).run();
    await gated.api.signUpEmail({ body: { email: "friend@example.com", password: "password123", name: "f" } });
    const row = await db.prepare("SELECT token FROM session").bind().first<{ token: string }>();
    expect(row).not.toBeNull();
  });

  it("account deletion removes only the caller's rows (cross-user)", async () => {
    const db = testEnv().DB;
    const cookieA = await signUpCookie(db, "del-a@example.com");
    const cookieB = await signUpCookie(db, "del-b@example.com");
    const del = await get("/api/account", db, cookieA, {
      method: "DELETE",
      headers: { origin: ORIGIN },
    });
    expect(del.status).toBe(200);
    // B's session still verifies; B's user row survives.
    expect((await get("/api/me", db, cookieB)).status).toBe(200);
    const users = await db.prepare("SELECT email FROM user WHERE email LIKE 'del-%'").bind().all<{ email: string }>();
    expect((users.results ?? []).map((u) => u.email)).toEqual(["del-b@example.com"]);
  });

  it("DELETE /api/account rejects cross-origin (CSRF)", async () => {
    const db = testEnv().DB;
    const cookie = await signUpCookie(db, "csrf@example.com");
    const evil = await get("/api/account", db, cookie, { method: "DELETE", headers: { origin: "https://evil.example" } });
    expect(evil.status).toBe(403);
  });

  it("export returns the caller's data, never tokens", async () => {
    const db = testEnv().DB;
    const cookie = await signUpCookie(db, "exp@example.com");
    const body = (await (await get("/api/account/export", db, cookie)).json()) as { ok: boolean; data: Record<string, unknown> };
    expect(body.ok).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/password|accessToken|refreshToken|session_token/);
  });

  it("auth endpoints rate-limit abusive IPs (in-isolate fallback)", async () => {
    __resetRateLimitsForTests();
    const db = testEnv().DB;
    let last = 200;
    for (let i = 0; i < 35; i++) {
      last = (await get("/api/auth/nope", db)).status;
    }
    expect(last).toBe(429);
    __resetRateLimitsForTests();
  });

  it("uses the native RL_AUTH binding when present", async () => {
    const calls: string[] = [];
    const rlAuth = {
      limit: async ({ key }: { key: string }) => {
        calls.push(key);
        return { success: calls.length < 3 };
      },
    };
    const db = testEnv().DB;
    const fetchWithBinding = (path: string) =>
      worker.fetch(new Request(`${ORIGIN}${path}`), { ...testEnv(), DB: db, RL_AUTH: rlAuth });
    // Binding allows the first two (they reach the better-auth handler, not 429).
    expect((await fetchWithBinding("/api/auth/nope")).status).not.toBe(429);
    expect((await fetchWithBinding("/api/auth/nope")).status).not.toBe(429);
    expect((await fetchWithBinding("/api/auth/nope")).status).toBe(429);
    // Key is per-IP (unknown when no cf-connecting-ip in tests) and scoped to auth.
    expect(calls.every((k) => k.startsWith("auth:"))).toBe(true);
  });
});
