import React from "react";
import { soundingToAbc } from "../domain/abc.js";
import { parseChordSymbol } from "../domain/chords.js";
import type { Lick } from "../domain/lick.js";
import { fitBassRange, transposeChordSymbol, transposeLick, transposeRoot } from "../domain/transpose.js";
import { lickLab } from "./composition.js";
import { btnGhost, btnPrimary, tag } from "./primitives.js";
import { NotationView } from "./NotationView.js";

type View = "concert" | "Bb" | "Eb" | "bass";

const VIEW_SHIFT: Record<View, number> = { concert: 0, Bb: 2, Eb: 9, bass: 0 };
const VIEW_CLEF: Record<View, "treble" | "bass"> = { concert: "treble", Bb: "treble", Eb: "treble", bass: "bass" };
const VIEW_LABEL: Record<View, string> = { concert: "C (concert)", Bb: "for Bb", Eb: "for Eb", bass: "Bass clef" };

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
    const chordLabel = lick.harmonicContext.chords.map((c) => c.symbol).join(" → ");
    const displayLabel =
      shift === 0 ? chordLabel : `${lick.harmonicContext.chords.map((c) => transposeChordSymbol(c.symbol, shift)).join(" → ")} (concert ${chordLabel})`;
    return { abc, displayLabel };
  }, [lick, view]);

  if (!lick) return <p className="py-5 italic text-dim">Loading…</p>;
  return (
    <article aria-label="lick detail">
      <button type="button" className={btnGhost} onClick={onBack}>
        ← Library
      </button>
      <h2 className="font-serif text-[1.7rem] mt-2 mb-0.5">{lick.title}</h2>
      <p className="font-semibold text-gold tracking-wide">{rendered?.displayLabel}</p>
      <p className="text-dim text-sm">
        {lick.harmonicContext.function} · key {lick.harmonicContext.originalKey} · {"★".repeat(lick.difficulty)}
        {lick.source.artist ? ` · ${lick.source.artist}` : ""}
        {lick.source.track ? ` — ${lick.source.track}` : ""}
        {lick.source.year ? ` (${lick.source.year})` : ""}
      </p>
      {lick.tags.length > 0 && (
        <p>
          {lick.tags.map((t) => (
            <span key={t} className={tag}>
              {t}
            </span>
          ))}
        </p>
      )}
      {lick.notes && <p className="text-dim text-sm">{lick.notes}</p>}
      <div className="my-4 flex flex-wrap gap-2" role="group" aria-label="Transposition view">
        {(["concert", "Bb", "Eb", "bass"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            className={view === v ? btnPrimary : btnGhost}
            onClick={() => setView(v)}
          >
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>
      {rendered && <NotationView abc={rendered.abc} title={lick.title} />}
    </article>
  );
}
