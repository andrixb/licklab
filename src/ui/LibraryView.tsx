// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import React from "react";
import { LICK_FUNCTIONS } from "../domain/lick.js";
import type { Lick } from "../domain/lick.js";
import { lickLab } from "./composition.js";
import { btnDanger, btnPrimary, card, input, label, tag } from "./primitives.js";
import { ConfirmDialog } from "./ConfirmDialog.js";

export function LibraryView({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }): React.JSX.Element {
  const [licks, setLicks] = React.useState<Lick[]>([]);
  const [search, setSearch] = React.useState("");
  const [fn, setFn] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [pendingDelete, setPendingDelete] = React.useState<Lick | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const filter = {
      ...(search ? { search } : {}),
      ...(fn ? { function: fn } : {}),
    };
    setLicks(await lickLab.listLicks(filter));
    setLoading(false);
  }, [search, fn]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section aria-label="lick library">
      <div className="mb-5 flex flex-wrap items-end gap-3.5">
        <label className={`${label} grow basis-60`}>
          Search
          <input className={input} aria-label="Search licks" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="title, artist, tag…" />
        </label>
        <label className={`${label} grow basis-45`}>
          Function
          <select className={input} aria-label="Filter by function" value={fn} onChange={(e) => setFn(e.target.value)}>
            <option value="">All</option>
            {LICK_FUNCTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={btnPrimary} onClick={onNew}>
          + New lick
        </button>
      </div>
      {loading ? (
        <p className="py-5 italic text-dim">Loading…</p>
      ) : licks.length === 0 ? (
        <p className="text-dim text-sm">No licks yet — add one with ABC or wait for the seeded examples.</p>
      ) : (
        <ul className="grid list-none m-0 p-0 gap-3">
          {licks.map((l) => (
            <li key={l.id} className={`${card} flex flex-wrap items-center gap-3.5 px-[18px] py-3.5`}>
              <button type="button" className="font-serif text-lg text-cream" onClick={() => onOpen(l.id)}>
                <span className="hover:text-gold">{l.title}</span>
              </button>
              <span className="flex-1 text-dim text-sm">
                <span className="font-semibold text-gold-dim tracking-wide">{l.harmonicContext.chords.map((c) => c.symbol).join(" → ")}</span>{" "}
                · {l.harmonicContext.function} · {"★".repeat(l.difficulty)}
                {l.source.artist ? ` · ${l.source.artist}` : ""}
              </span>
              {l.tags.length > 0 && (
                <span>
                  {l.tags.map((t) => (
                    <span key={t} className={tag}>
                      {t}
                    </span>
                  ))}
                </span>
              )}
              <button type="button" className={btnDanger} aria-label={`Delete ${l.title}`} onClick={() => setPendingDelete(l)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete “${pendingDelete?.title ?? ""}”?`}
        body="It leaves your library and can no longer be matched to songs."
        confirmLabel="Delete lick"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          const lick = pendingDelete;
          setPendingDelete(null);
          if (lick) void lickLab.removeLick(lick.id).then(() => refresh());
        }}
      />
    </section>
  );
}
