# Security & auth

Design (Phase 0 recommendation, to be proven in M4): OAuth Google + GitHub via a
maintained Workers+D1 auth library (Better Auth + Drizzle/Kysely D1 adapter
candidate; no password hashing in OAuth-only config — scrypt/bcrypt at secure
strength exceeds the 10 ms free CPU budget). Passkeys only if they fit CPU.
No passwords, no home-made crypto. Record final choice in ADR.

Sessions: HttpOnly/Secure/SameSite cookies, short-lived + rotation, stored in
D1. Same-origin API. Origin/CSRF checks on state-changing routes + strict CSP.
All routes require valid session except auth routes + `/api/health`.
`ownerId` from session only. Cross-user access impossible + tested (guessed IDs,
tampered ownerId). Local-only mode signed out; sign-in attaches local data;
per-user namespacing on shared devices (ADR in M4).

Shared-budget abuse: per-user + per-IP rate limits (WAF free = 1 rule; Workers
`ratelimits` binding has no published free quota — verify; else D1 counters),
per-user quotas (max licks/songs/changes-per-day/payload), invite-code/
allowlist gate first (open registration behind flag later). Capacity estimate +
upgrade path (Workers Paid) documented in M4. `sync paused, try later` UX.

Privacy (EU): minimum stored (email, provider id, display name, timestamps).
Deletion hard-deletes all user rows (tested). In-app JSON export, privacy
policy + terms, no third-party analytics. Never log tokens/session IDs/emails.
Secrets only in Worker/CI secrets.
