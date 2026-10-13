# ADR-007: Verovio for notation, ABC as interchange, lazy WASM

Status: Accepted (M1).
Context: Need engraved notation + C/Bb/Eb/bass-clef views without blowing the
initial payload (Verovio WASM ≈ 7–8MB) or breaking the YouTube embed
(no SharedArrayBuffer/COOP/COEP).
Decision: Verovio 6.x (`verovio/esm` + single-threaded `verovio/wasm`), loaded
via dynamic import on first render and runtime-cached by the service worker
(preinstall precaches app shell only — see ADR-008). ABC is the interchange:
domain generates explicit-accidental ABC (`K:C clef=…`, no key-signature
dependence) and parses a documented monophonic subset (notes, lengths, rests,
bars; no ties/chords/tuplets). Transposition views re-root degrees
(Bb +2 semis, Eb +9) so enharmonics stay correct; bass view auto-fits range.
LGPL-3.0 noted in docs/legal.md.
Consequences: first notation view downloads ~8MB (loading state in UI);
MusicXML/MEI engraving reuses the same renderer in later milestones.
