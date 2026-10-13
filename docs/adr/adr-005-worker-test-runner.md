# ADR-005: Worker test runner (`@cloudflare/vitest-plugin`)

Status: Accepted (M0).
Context: Need API + D1 tests in workerd with bindings.
Decision: `@cloudflare/vitest-plugin` (v1, renamed Aug 2026 from
`vitest-pool-workers` — Cloudflare-recommended 2026; Miniflare under the hood,
isolated per-file storage). Raw Miniflare only for low-level dispatch harnesses.
Consequences: `vitest.config.ts` projects (unit + worker); contract tests run
against workerd D1 from M4.
