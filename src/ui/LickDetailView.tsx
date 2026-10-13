import React from "react";
import { soundingToAbc } from "../domain/abc.js";
import { parseChordSymbol } from "../domain/chords.js";
import type { Lick } from "../domain/lick.js";
import { fitBassRange, transposeChordSymbol, transposeLick, transposeRoot } from "../domain/transpose.js";
import { lickLab } from "./composition.js";
import { NotationView } from "./NotationView.js";

type View = "concert" | "Bb" | "Eb" | "bass";

const VIEW_SHIFT: Record<View, number> = { concert: 0, Bb: 2, Eb: 9, bass: 0 };
const VIEW_CLEF: Record<View, "treble" | "bass"> = { concert: "treble", Bb: "treble", Eb: "treble", bass: "bass" };

export function LickDetailView({ id, onBack }: { id: string; onBack: () => void }): React.JSX.Element {
  const [lick, setLick] = React.useState<Lick | null>(null);
  const [view, setView] = React.useState<View>("concert");

  React.useEffect(() => {
    void lickLab.getLick(id).then(setLick);
  }, [id]);

  const rendered = React.useMemo(() => {
    if (!lick) return null;
    const firstSymbol = lick.harmonicContext.chords[0]?.symbol ?? "C";
    const shift = VIEW_SHIFT[view];
    const root = transposeRoot(parseChordSymbol(firstSymbol).root, shift);
    let notes = transposeLick(lick, root);
    if (view === "bass") notes = fitBassRange(notes);
    const abc = soundingToAbc(notes, { title: lick.title, clef: VIEW_CLEF[view] });
    const chordLabel =
      shift === 0
        ? lick.harmonicContext.chords.map((c) => c.symbol).join(" | ")
        : `${lick.harmonicContext.chords.map((c) => transposeChordSymbol(c.symbol, shift)).join(" | ")} (concert ${lick.harmonicContext.chords.map((c) => c.symbol).join(" | ")})`;
    return { abc, chordLabel };
  }, [lick, view]);

  if (!lick) return <p>Loading…</p>;
  return (
    <article aria-label="lick detail">
      <button type="button" onClick={onBack}>
        ← Library
      </button>
      <h2>{lick.title}</h2>
      <p>
        {rendered?.chordLabel} · {lick.harmonicContext.function} · key {lick.harmonicContext.originalKey} · ★{lick.difficulty}
      </p>
      {lick.source.artist && (
        <p>
          {lick.source.artist} {lick.source.instrument && `(${lick.source.instrument})`} {lick.source.track && `— ${lick.source.track}`}
        </p>
      )}
      {lick.tags.length > 0 && <p>Tags: {lick.tags.join(", ")}</p>}
      {lick.notes && <p>{lick.notes}</p>}
      <div role="group" aria-label="Transposition view">
        {(["concert", "Bb", "Eb", "bass"] as const).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
            {v === "concert" ? "C (concert)" : v === "bass" ? "Bass clef" : `for ${v}`}
          </button>
        ))}
      </div>
      {rendered && <NotationView abc={rendered.abc} title={lick.title} />}
    </article>
  );
}
