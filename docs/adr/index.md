# ADR index

| ID | Title | Status |
|----|-------|--------|
| [ADR-001](adr-001-clean-architecture.md) | Clean/hexagonal layers + inward-only rule | Accepted |
| [ADR-002](adr-002-workers-assets-vs-pages.md) | Workers Static Assets + /api Worker (not Pages+Functions) | Accepted |
| [ADR-003](adr-003-auth-oauth-only.md) | OAuth-only auth, no passwords (Better Auth) | Accepted (implemented) |
| [ADR-004](adr-004-defer-heavy-deps.md) | Defer Tone/Verovio/Dexie to feature milestones | Accepted |
| [ADR-005](adr-005-worker-test-runner.md) | Workers Vitest integration (`@cloudflare/vitest-plugin`) | Accepted |
| [ADR-006](adr-006-dexie-local-store.md) | Dexie local-first store, one DB per namespace | Accepted |
| [ADR-007](adr-007-verovio-abc-notation.md) | Verovio notation, ABC interchange, lazy WASM | Accepted |
| [ADR-008](adr-008-pwa-workbox.md) | PWA precache shell + runtime-cache WASM | Accepted |
| [ADR-009](adr-009-gpl-license.md) | Code under GPL-3.0-or-later; no GPL-2.0-only deps | Accepted |
| [ADR-010](adr-010-tailwind-no-component-lib.md) | Tailwind v4, no component library | Accepted |
| [ADR-011](adr-011-lick-schema-v2.md) | Lick schema v2: community fields + derived signatures | Accepted |
| [ADR-012](adr-012-signature-grammar-and-analyzer.md) | Signature grammar + segment analyzer (matching core) | Accepted |
| [ADR-013](adr-013-public-read-path.md) | Public read path: edge-cached D1, snapshots as escalation | Proposed (M4) |
| [ADR-014](adr-014-native-ratelimits-binding.md) | Native `ratelimits` Worker binding | Accepted |
| [ADR-015](adr-015-default-license-ccby4.md) | Default lick license: CC BY 4.0 | Proposed (legal review) |
| [ADR-016](adr-016-own-theory-primitives.md) | Own theory primitives (no Tonal) | Accepted |
