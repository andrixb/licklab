# ADR-004: Defer Tone/Verovio/Dexie to feature milestones

Status: Accepted (M0).
Context: M0 proves skeleton/CI/deploy; heavy audio/notation/DB libs bloat
install + payload and need licence/size vetting (Phase 0: Verovio LGPL,
time-stretch copyleft, sample subsets < 25 MiB/file).
Decision: M0 ships React-only hello-world; add Dexie + Verovio in M1, Tone.js +
comping in M2, single-threaded stretch in M5. iReal parser: `ireal-reader`
(MIT) candidate, pin + vendor (stale upstream).
Consequences: fast M0 CI; each milestone vets size/licence before adding dep.
