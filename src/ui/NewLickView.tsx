// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import React from "react";
import { LICK_FUNCTIONS, type LickFunction } from "../domain/lick.js";
import { lickLab } from "./composition.js";
import { btnGhost, btnPrimary, card, errorText, input, label, textarea } from "./primitives.js";

const ABC_PLACEHOLDER = "X:1\nL:1/8\nK:C\nD E F G A2 |";

export function NewLickView({ onSaved, onCancel }: { onSaved: (id: string) => void; onCancel: () => void }): React.JSX.Element {
  const [title, setTitle] = React.useState("");
  const [chord, setChord] = React.useState("Dm7");
  const [originalKey, setOriginalKey] = React.useState("C");
  const [fn, setFn] = React.useState<LickFunction>("ii-V-I major");
  const [difficulty, setDifficulty] = React.useState("2");
  const [artist, setArtist] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [abc, setAbc] = React.useState(ABC_PLACEHOLDER);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    try {
      const lick = await lickLab.createLickFromAbc({
        title,
        abc,
        chord,
        originalKey,
        function: fn,
        artist,
        tags: tags.split(","),
        difficulty: Number(difficulty) as 1 | 2 | 3 | 4 | 5,
      });
      onSaved(lick.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form className={`${card} grid max-w-[620px] gap-3.5 p-[22px]`} aria-label="new lick" onSubmit={(e) => void submit(e)}>
      <h2 className="font-serif text-2xl mt-0 mb-1.5">New lick from ABC</h2>
      {error && (
        <p className={errorText} role="alert">
          {error}
        </p>
      )}
      <label className={label}>
        Title
        <input className={input} aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
      </label>
      <div className="flex flex-wrap gap-3.5">
        <label className={`${label} grow basis-45`}>
          Chord
          <input className={input} aria-label="Chord" value={chord} onChange={(e) => setChord(e.target.value)} required />
        </label>
        <label className={`${label} grow basis-30`}>
          Key
          <input className={input} aria-label="Key" value={originalKey} onChange={(e) => setOriginalKey(e.target.value)} required />
        </label>
        <label className={`${label} grow basis-55`}>
          Function
          <select className={input} aria-label="Function" value={fn} onChange={(e) => setFn(e.target.value as LickFunction)}>
            {LICK_FUNCTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className={`${label} grow basis-30`}>
          Difficulty
          <select className={input} aria-label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {["1", "2", "3", "4", "5"].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-3.5">
        <label className={`${label} grow basis-55`}>
          Artist
          <input className={input} aria-label="Artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
        </label>
        <label className={`${label} grow basis-60`}>
          Tags (comma separated)
          <input className={input} aria-label="Tags" value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
      </div>
      <label className={label}>
        ABC (notes, rests, bar lines)
        <textarea className={textarea} aria-label="ABC" value={abc} onChange={(e) => setAbc(e.target.value)} rows={6} />
      </label>
      <div className="mt-1.5 flex gap-3">
        <button type="submit" className={btnPrimary}>
          Save lick
        </button>
        <button type="button" className={btnGhost} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
