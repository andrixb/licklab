# ADR-014: Native `ratelimits` Worker binding replaces hand-rolled limiter

Status: Accepted (M1.5).
Context: In-isolate Map counters reset per cold start, aren't shared across
isolates/colos, and cost our 10 ms CPU budget; Cloudflare's Rate Limiting
API binding (Wrangler ≥4.36) provides per-location counters at ~0 CPU and
is available on the free plan (verified Oct 2026 docs).
Decision: `wrangler.jsonc` declares `RL_AUTH` (30/60 s) and `RL_ACCOUNT`
(10/60 s) with account-unique namespace_ids 1001/1002. Worker uses the
binding when present and keeps the sliding-window fallback only for local
runtimes without it (tests exercise both paths). Key: `route:cf-connecting-ip`
(CF docs recommend against IP-only keys; acceptable for auth-abuse
mitigation, refined per-user when M4 catalog routes land).
Consequences: counters survive isolate churn; limits are eventually
consistent per colo (fine for abuse guardrails). New API routes get their
own namespaces + budgets in M4.
