# Security & auth (implemented: Better Auth + D1, OAuth-only)

## Design as built

- **Better Auth 1.7.x** (`better-auth`, `@better-auth/kysely-adapter`, MIT)
  mounted at `/api/auth/*` (Google + GitHub OAuth). **No passwords**:
  `emailAndPassword.enabled: false` in production — better-auth's scrypt
  hashing (~65–75 ms) exceeds the 10 ms free CPU budget and is never invoked.
  Tests enable email+password **only** in the workerd test seam to mint
  sessions without live OAuth (same factory, same schema).
- **D1 sessions** via our minimal Kysely dialect (`src/worker/d1-dialect.ts`;
  ADR-003): no interactive transactions (verified unused), epoch-millis dates,
  `validateSchema: false` + schema owned by Wrangler migrations
  (`migrations/0002_auth.sql`). Auth instance built once per isolate over a
  live-DB proxy to keep per-request CPU low.
- **Cookies**: HttpOnly, Secure (https origins), SameSite=Lax via
  `__Host`/`__Secure` prefixed names; `session.cookieCache` (compact, 300 s)
  avoids D1 reads on most requests; OAuth tokens encrypted at rest
  (`account.encryptOAuthTokens`).
- **Every protected route** verifies the session from the cookie; `ownerId` is
  the session user id only — never read from request input. `/api/health` and
  the auth routes are the only public endpoints.
- **CSRF/origin**: same-origin API (Worker serves assets + `/api`); state-
  changing `/api/account` DELETE requires matching `Origin` or
  `Sec-Fetch-Site: same-origin` (403 otherwise; e2e-covered by workerd tests).
  CSP in `public/_headers` for asset responses.
- **Sign-up gate**: `databaseHooks.user.create.before` — account creation is
  blocked unless `OPEN_SIGNUP=1` or the email exists in `allowed_email`; owner
  seeded in `docs/deployment.md`. Deliberately on USER creation, not session:
  `user.create.before` receives the email directly, whereas a session hook has
  to read the just-inserted user row back mid-OAuth-callback, where D1
  read-after-write/replica lag returns nothing and the gate silently blocks —
  which bricked sign-in for already-created accounts. Revoking an existing
  user's access later is the admin-suspend path, not this gate.
- **Rate limits**: native Workers `ratelimits` bindings (ADR-014) — `RL_AUTH`
  30/min/IP, `RL_READ` 120/min/IP on public catalog reads, `RL_ACCOUNT`
  10/min/IP, and a per-user 5/min on lick creation. In-isolate sliding windows
  remain only as a fallback for local runtimes without the binding. Per-user
  daily quotas (`user_quota`: 20 licks/day) back the burst limits.
- **Account deletion**: `DELETE /api/account` hard-deletes every row the caller
  owns across all tables — auth (session/account/verification/user), licks,
  `lick_tag`, likes (given and made), favorites, reports (as reporter and as
  author), packs + membership, `user_quota`, progressions — then purges cached
  public reads so removed licks disappear immediately (workerd test asserts
  zero surviving rows in every table and that user B is unaffected).
- **Data export**: `GET /api/account/export` (identity + provider links, no
  secrets) plus a client-side full library JSON export.
- **Never logged**: tokens, session ids, emails. Secrets only via
  `wrangler secret put` / CI secrets.
- **Local-first**: signed-out = local-only namespace `local`; on first sign-in
  local licks are moved into the `user` namespace (ownerId rewritten),
  per-user namespaces keep shared devices clean.

## Capacity estimate (shared free tier)

Assume a regular sync (M4) costs ~3–6 API requests and ~5–20 D1 reads per
session check amortized by cookieCache. Worker 100k req/d → ~5k–30k requests
left for auth churn; with ~40 API hits/active user/day: **~1,000–2,000 active
users/day** before the 100k/day Worker ceiling or D1 write budget (100k/d)
becomes the binding constraint (heavy editors ~50–100 writes/day → same
order). The rate limits above keep a single buggy client from eating the
budget. Upgrade path when it binds: Workers Paid (cheaper per-request, 10 ms
CPU is the same, D1 paid adds rows) — documented in `docs/deployment.md`.

## Threat model notes

- Compromised OAuth provider → provider-level revocation is upstream; our
  session cookie is `__Secure` + short cookieCache TTL bounds staleness.
- IDOR: impossible by construction (queries keyed by session user id).
- Abuse of `/api/auth` login endpoints is capped at 30/min/IP.
