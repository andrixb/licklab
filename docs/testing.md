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
- Playwright e2e: create lick, import song, fitting licks, play, export, two-context
  sync — audio/MIDI mocked. Red pipeline blocks the milestone.
