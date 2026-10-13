import { describe, expect, it } from "vitest";
import { soundingToAbc } from "../../src/domain/abc.js";
import { parseChordSymbol } from "../../src/domain/chords.js";
import { transposeLick } from "../../src/domain/transpose.js";
import { VerovioRenderer } from "../../src/adapters/notation/verovio.js";
import { sampleLick } from "./lick-contract.js";

describe("VerovioRenderer (real WASM, lazy)", () => {
  it("renders treble and bass SVG", async () => {
    const lick = sampleLick("n", "u1");
    const root = parseChordSymbol("C7").root;
    const renderer = new VerovioRenderer();
    const treble = await renderer.renderAbcToSvg(soundingToAbc(transposeLick(lick, root), { title: lick.title }));
    expect(treble).toContain("<svg");
    const bass = await renderer.renderAbcToSvg(soundingToAbc(transposeLick(lick, root), { clef: "bass" }));
    expect(bass).toContain("<svg");
    expect(bass).not.toBe(treble);
  }, 60_000);
});
