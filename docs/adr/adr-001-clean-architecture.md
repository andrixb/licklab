# ADR-001: Clean/hexagonal layers + inward-only rule

Status: Accepted (M0).
Context: Jazz-harmonic logic must stay testable + portable; adapters (Tone,
Verovio, Dexie, D1, YouTube) churn. Free-tier Worker has 10 ms CPU — heavy work
must stay client-side and out of SQL.
Decision: `domain -> application -> adapters/worker/ui`; ports owned by
application; shared schemas in application; matching/transposition/notation in
domain on client; Worker thin. Enforced by eslint-boundaries + dependency-cruiser
(fail CI), no cycles.
Consequences: more boilerplate; adapters replaceable; domain ≥90% covered.
