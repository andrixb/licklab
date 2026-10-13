# ADR-016: Keep own theory primitives (no Tonal)

Status: Accepted (M2).
Context: The spec asked to evaluate a theory library (e.g. Tonal, MIT)
before writing primitives. Evaluation result: Tonal's model is key/major-
scale-centric (`Note.fromIntervals` resolves spellings against a key),
while our invariant is spelling **from degrees relative to the chord root**
(letter arithmetic forcing Eb°7 → Eb Gb Bbb Dbb, no key signature involved).
Adopting it would mean wrapping it in our own types anyway — and our
primitives already exist behind domain types with 97% coverage and
12-key property tests (round trips, enharmonic invariance).
Decision: Keep `src/domain/pitch|chords|transpose|signatures` as the single
theory layer; no external theory dependency. Anything still missing
(e.g. richer key-signature logic for importers in M5/M6) gets written
in-domain, test-first. The port stays swappable: only domain files would
change.
Consequences: we own spelling correctness as a tested invariant; no
maintenance/upstream risk; slightly more code than a dependency would add.
