# ADR-003: OAuth-only auth, no passwords (Better Auth candidate)

Status: Proposed — measure + prove in M4.
Context: Free Worker 10 ms CPU. Third-party measurements: secure password
hashing (PBKDF2 recommended rounds, bcrypt) costs ~65–75 ms — does not fit;
weakening the hash is unacceptable. Cloudflare Access free covers ≤50 team
users, not user-facing login.
Decision (proposed): Google + GitHub OAuth via maintained Workers+D1 library
(Better Auth + Drizzle/Kysely D1 adapter candidate), `emailAndPassword`
disabled (avoids scrypt CPU), D1 sessions, HttpOnly/Secure/SameSite cookies,
same-origin API, Origin/CSRF checks. Passkeys only if CPU fits. Invite-gate first.
Consequences: M4 must measure callback + session-check CPU, verify rate-limit
options, capacity-estimate free tier, and record final library choice here.
