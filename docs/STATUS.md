# STATUS.md — current state

**Milestone:** M1 done; **Accounts/Auth milestone** (part of M4) done;
songs/band engine (M2) and sync (rest of M4) still ahead.
**Live:** production `https://licklab.licklab.workers.dev`.
**What works:**
- Lick library + ABC entry + engraved notation with Concert/Bb/Eb/Bass views
  (correct enharmonics), 2 self-written seeds.
- **Accounts**: Better Auth OAuth (Google/GitHub) over D1 via our own Kysely
  dialect; sessions HttpOnly/Secure cookies + compact cookie cache; `/api/me`,
  `/api/account/export`, `DELETE /api/account` (hard delete, owner-scoped);
  sign-up gate via `allowed_email` (owner email seeded; `OPEN_SIGNUP=1` to open);
  per-IP in-isolate rate limits. Signed-out local-only mode; on first sign-in
  local licks attach to the user namespace.
- **UI**: restyled with Tailwind v4 (ADR-010): dark jazz theme, cards, 44px
  touch targets, native-dialog confirmations, lazy account menu + notation.
**Tests:** 69 unit + 7 workerd auth tests (cross-user deletion, CSRF 403,
gate, rate limit 429, export leak check); 2 e2e flows (create→notation→
transpose→delete via confirm dialog; sign-in menu); coverage thresholds hold;
budget 357/400 KB initial; arch rule 0 violations; docs-check 10 ADRs.
**Known issues / next steps for sign-in:** OAuth apps NOT yet created —
follow the "Secrets & auth configuration" table in `docs/deployment.md`
(Google + GitHub apps, redirect URIs, then `wrangler secret put` ×4).
Until then the app is fully usable signed-out. Sync (changes API, LWW,
quotas, paused state) is the remaining M4 work; preview versions share prod
D1; Verovio `.map` files still shipped.
**Next:** M2 (song import + Tone.js band engine) or finish M4 sync — propose M2.

Cold-start: read `AGENTS.md`, then this file, then `docs/`.
