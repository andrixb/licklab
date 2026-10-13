// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import React from "react";
import { buildGuideTones, buildLickView, type LickViewKind } from "../application/lickViews.js";
import type { Lick } from "../domain/lick.js";
import { lickLab, workspace } from "./composition.js";
import { btnGhost, btnPrimary, tag } from "./primitives.js";
import { NotationView } from "./NotationView.js";

const VIEW_LABEL: Record<LickViewKind, string> = { concert: "C (concert)", Bb: "for Bb", Eb: "for Eb", bass: "Bass clef" };

export function LickDetailView({ id, onBack }: { id: string; onBack: () => void }): React.JSX.Element {
  const [lick, setLick] = React.useState<Lick | null>(null);
  const [view, setView] = React.useState<LickViewKind>("concert");

  React.useEffect(() => {
    void lickLab.getLick(id).then(setLick);
  }, [id]);

  const rendered = React.useMemo(() => (lick ? buildLickView(lick, view) : null), [lick, view]);

  if (!lick) return <p className="py-5 italic text-dim">Loading…</p>;
  return (
    <article aria-label="lick detail">
      <button type="button" className={btnGhost} onClick={onBack}>
        ← Library
      </button>
      <h2 className="font-serif text-[1.7rem] mt-2 mb-0.5">{lick.title}</h2>
      <p className="font-semibold text-gold tracking-wide">{rendered?.chordLabel}</p>
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
      <p className="text-gold-dim text-sm font-semibold">{buildGuideTones(lick)}</p>
      <div className="my-4 flex flex-wrap gap-2" role="group" aria-label="Transposition view">
        {(Object.keys(VIEW_LABEL) as LickViewKind[]).map((v) => (
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
        <button
          type="button"
          className={btnGhost}
          onClick={() => void workspace.playTwelveKeys(lick, "swing", { bass: true, piano: true, drums: true, tempoBpm: 120 })}
        >
          ▶ 12 keys
        </button>
      </div>
      {rendered && <NotationView abc={rendered.abc} title={lick.title} />}
    </article>
  );
}
