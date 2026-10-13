# Testing

Test-first for domain (transposition, enharmonics, chord parsing, matching, LWW)
with fast-check properties (degree→pitch→degree × 12 keys × qualities; sync
convergence). Target ≥90% on domain+application; coverage reported per milestone.

- Contract tests per port vs. fake + real (fake-indexeddb, workerd D1 via
  `@cloudflare/vitest-plugin`, Tone.Offline + injected Clock — never wall-clock).
- API tests per route: unauth/expired, validation, statement-count caps.
- Security suite: cross-user (read/change/delete incl. guessed IDs + tampered
  ownerId), CSRF/origin, rate-limit/quota, sign-up gate, deletion removes every
  row, no token/email leaks in responses/logs.
- Migration tests (empty DB + upgrade), EXPLAIN QUERY PLAN index tests.
- Importer golden files (self-written/user-provided only; never copyrighted charts).
- Audio timing: scheduling tested via pure `toTimedEvents` (beat→seconds,
  count-in) + FakeAudioEngine contract test — never by listening (ADR-017).
  Tone adapter itself is thin glue (lazy import + Transport.schedule),
  exercised state-only in e2e.
- Playwright e2e: create lick + notation + transpose + delete; sign-in menu;
  anonymous shared-progression → audition → place → solo chorus; preset
  chips + share URL. Audio runs in real (headless) AudioContext; assertions
  are on UI state (Play↔Stop), not sound.
