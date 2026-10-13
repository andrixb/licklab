# Matching: how a lick fits a progression

All matching runs **client-side in the domain** (`src/domain/signatures.ts`,
`progression.ts`, `matching.ts`); the Worker only looks licks up by indexed
signature strings. Signatures are key-independent: identical shapes in
different keys share them, so `IN (...)` lookups find community matches.

## Signature grammar

**Chord normalization.** `parseChordSymbol` → quality ∈ {maj7, maj6, min7,
min6, minmaj7, dom7, dim7, hdim7, aug, sus7, power5}; families maj/min/dom/
halfdim/dim. Root interval = pc distance **from the first chord** (mod 12,
enharmonic-insensitive). Beats bucketed to ¼-beat grid.

**contextKey** — qualities + root intervals + durations, `.`-joined,
`code@interval:beats`:

| code | quality | code | quality |
|---|---|---|---|
| M | maj7 | 7 | dom7 |
| 6 | maj6 | d | dim7 |
| m | min7 | h | hdim7 |
| m6 | min6 | A | aug |
| mM | minmaj7 | s | sus7 |
| 5 | power5 | | |

**functionKey** — derived by exact-length rules (first match wins),
falling back to `static.<fam>` / `dom` (single chords) or `other`:
`ii-V-I.maj`, `ii-V-i.min`, `cycle.of-fifths`, `turnaround.maj` (I–vi–ii–V),
`V-I.tritone` (subV7 falling a half step onto I), `V-I.maj`, `V-I.min`,
`ii-V`; plus the analyzer's whole-progression `blues.12bar`.

**chordQuality** — quality when context is a single chord, else null.

**patternHash** — `fnv1a64(canonicalPattern | contextKey)`; duplicate
detection before publishing (exact match = warn the author).

## The segment analyzer

`analyzeChords` flattens bars to a chord list and:
1. 12-chord all-dom inputs matching the blues anchors (I, IV on bars 5–6/10,
   V on bar 9, V|I bar 12, quick-change allowed) → one `blues.12bar` segment.
2. Otherwise: find every rule window; greedily cover, **longest segment
   first, then earliest start, then rule specificity**; ties like
   `Em7 A7 Dm7 G7` resolve to `ii-V-i.min` + leftover `dom` rather than two
   `ii-V`s (documented, intentional).
3. Uncovered chords become single-chord segments (`static.*` / `dom`).

## Matching tiers (per segment, best first)

1. **Exact context**: the lick's whole chord context occurs as a contiguous
   window inside the segment (contextKey equality, relative — so a ii-V lick
   tier-1 matches inside a ii-V-I).
2. **Same function**: `lick.functionKey === segment.functionKey` and the
   lick is not longer than the segment.
3. **Chord quality**: single-chord licks match segments containing that
   quality.

Licks never overflow their segment (chord-count bound). Ranking inside a
tier: likes desc, then recency (updatedAt, then createdAt) desc. Deleted and
moderation-hidden licks are excluded upstream (query filters + client skip).

## Worked examples

- **ii-V-I, all 12 keys.** `Dm7 G7 Cmaj7` → `m@0:4.7@5:4.M@10:4`
  (intervals measured from D), `ii-V-I.maj`. Transposed to `F#m7 B7 Emaj7`:
  identical strings. A `Dm7 G7` lick (`m@0:4.7@5:4`, `ii-V`) tier-1-matches
  as a window; a 4-beat single `G7` lick (`7@0:4`, `dom`) also tier-1
  (window = the V itself); a 2-beat `G7` lick tier-3 (quality present, no
  exact 2-beat window).
- **Minor ii-V-i.** `Dm7b5 G7 Cm7` → `h@0:4.7@5:4.m@10:4`, `ii-V-i.min`.
  `Dm7 G7 Cm7` maps to the same functionKey (min ii allowed).
- **Blues in F** (quick change) → one 12-chord segment `blues.12bar`
  (contextKey is the 12-token string). A 4-beat `dom7` single-chord lick
  tier-1-matches inside it (window = any bar); longer/other-shape dom licks
  reach it via tier 2/3 as defined.
- **Rhythm changes A.** `Cmaj7 Am7 Dm7 G7 Em7 A7 Dm7 G7` → segments
  `turnaround.maj` (bars 1–4), `ii-V-i.min` (Em7-A7-Dm7), `dom` (G7) —
  longest-first disambiguation as above.

## Plausibility (author-side, warn-only)

`checkPlausibility`: fraction of notes that are chord tones or common
tensions (9/11/13) of the chord under them; <50% warns "double-check the
context (or keep them on purpose)". Also warns on overflow and single-note
patterns. Never blocks; outside lines are welcome.

Tests: `src/domain/*.test.ts` (property: contextKey/functionKey invariant
under 12-key transposition; matching tier invariant when lick and progression
are transposed together).
