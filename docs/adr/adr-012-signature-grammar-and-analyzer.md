# ADR-012: Signature grammar + segment analyzer (matching core)

Status: Accepted (M2). Full spec: `docs/matching.md`.
Context: Community matching must be key-independent, cheap for D1 (indexed
string lookup) and fully client-side (Worker CPU budget).
Decision: contextKey = `code@rootInterval:beats` tokens joined by `.`
(quality short codes, root intervals mod 12 from the FIRST chord, beats
bucketed to ¼); functionKey = first match of exact-length rules
(ii-V-I.maj, ii-V-i.min, cycle.of-fifths, turnaround.maj, V-I.tritone,
V-I.maj, V-I.min, ii-V) else `static.<fam>`/`dom`/`other`; the analyzer
adds `blues.12bar` (anchor-based, quick-change tolerant). Segments: greedy
longest-first coverage; uncovered chords become single-chord segments.
Ties (Em7-A7-Dm7+G7) resolve to the longer reading — accepted trade-off for
determinism + O(chords × rules). patternHash = fnv1a64 of canonical pattern
+ contextKey (dedup warning only, not security). Matching tiers 1 exact
context window / 2 same function / 3 single-chord quality; rank by likes →
recency; licks never overflow a segment (chord-count bound).
Alternatives: interval-class bitstrings (harder to index in SQL), embedding
search (CPU/DB budget overkill), Tonal-based analysis (ADR-016).
Consequences: signatures are stable IDs stored in D1 columns (M4); grammar
changes require new migration + recompute path (version via schemaVersion).
