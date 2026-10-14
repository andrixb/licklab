# ADR-020: Login-gated writes, open reads, same-origin CUD

Status: Accepted.
Context: The catalog/sync API grew route by route; each write checked the
session in its own handler, and only `DELETE /api/account` checked `Origin`.
That left CSRF posture per-handler (easy to forget on the next route) and docs
claiming health+auth were the only public endpoints while catalog reads were
already public.
Decision:
1. Central same-origin gate in `fetch()`: every `POST`/`PUT`/`DELETE` under
   `/api/` except `/api/auth/*` (OAuth is cross-site by nature), `/api/admin/*`
   (shared-secret header, unforgeable cross-origin), and the read-only
   `POST /api/licks/lookup` is rejected with 403 before any session check or
   write unless `Origin` or `Sec-Fetch-Site` proves same-origin.
2. Session rule unchanged and now total: all CUD (licks, likes, favorites,
   packs, reports, sync, account) 401 without login; reads (catalog GETs,
   lookup, health, auth flow) and all client-side playback stay anonymous.
Consequences: CSRF protection is structural, not per-handler — new CUD routes
inherit it. Workerd tests assert 401 on every CUD route, 403 on foreign/missing
origin with zero rows written, and 200 reads under a foreign origin.
