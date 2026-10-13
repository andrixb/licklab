# ADR-003: OAuth-only auth, no passwords — implemented with Better Auth

Status: Accepted (implemented with this milestone).
Context: Free Worker 10 ms CPU. Password hashing (PBKDF2 recommended rounds /
bcrypt, ~65–75 ms) does not fit; weakening it is unacceptable. Cloudflare
Access free (≤50 users) is team-oriented, not user login.
Decision: Better Auth 1.7.x (`better-auth` + `@better-auth/kysely-adapter`,
MIT), OAuth-only in production (`emailAndPassword.enabled: false`; enabled
**only** inside the workerd test seam to mint sessions without live OAuth).
D1 via our own minimal Kysely dialect (`src/worker/d1-dialect.ts`): no
interactive transactions (verified better-auth never uses them), Date/ISO
params -> epoch millis, `RETURNING` rows fetched via `.all()`,
`advanced.database.validateSchema: false` (D1 blocks `pragma_table_info`; we
own the schema via Wrangler migrations, proven by workerd tests).
Auth instance built **once per isolate** over a live-DB proxy (per-request
bindings, per-request auth construction was the CPU risk).
Sessions: HttpOnly/Secure/SameSite cookies in D1 + `cookieCache compact`
(300 s) to cut D1 reads; OAuth tokens encrypted at rest.
Sign-up gate: `databaseHooks.session.create.before` checks the `allowed_email`
table unless `OPEN_SIGNUP=1`.
CSRF/origin: same-origin API; `trustedOrigins`; DELETE /api/account requires
matching `Origin` or `Sec-Fetch-Site: same-origin`. Rate limit: in-isolate
sliding window (auth 30/min/IP, account 10/min/IP) + WAF rule (free: 1 rule)
recommended as the hard edge.
Consequences: `BETTER_AUTH_SECRET` (≥32 chars) via `wrangler secret put`;
Google/GitHub OAuth apps provide `*_CLIENT_ID/SECRET`. ADR-009 licence note:
better-auth MIT ✓.
