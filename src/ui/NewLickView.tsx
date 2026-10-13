import React from "react";
import { abcToPattern, parseAbcNotes } from "../domain/abc.js";
import { parseChordSymbol } from "../domain/chords.js";
import { LICK_FUNCTIONS, type LickFunction } from "../domain/lick.js";
import { lickLab } from "./composition.js";

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
      const root = parseChordSymbol(chord).root;
      const { pattern } = abcToPattern(parseAbcNotes(abc), root);
      if (pattern.length === 0) throw new Error("ABC has no notes (only rests?)");
      const lick = await lickLab.createLick({
        title,
        pattern,
        harmonicContext: { chords: [{ symbol: chord.trim(), beats: 4 }], originalKey: originalKey.trim(), function: fn },
        source: { artist: artist.trim(), instrument: "" },
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        difficulty: Number(difficulty) as 1 | 2 | 3 | 4 | 5,
        notes: "",
      });
      onSaved(lick.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form aria-label="new lick" onSubmit={(e) => void submit(e)}>
      <h2>New lick from ABC</h2>
      {error && <p role="alert">{error}</p>}
      <label>
        Title <input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
      </label>
      <label>
        Chord <input aria-label="Chord" value={chord} onChange={(e) => setChord(e.target.value)} required />
      </label>
      <label>
        Key <input aria-label="Key" value={originalKey} onChange={(e) => setOriginalKey(e.target.value)} required />
      </label>
      <label>
        Function{" "}
        <select aria-label="Function" value={fn} onChange={(e) => setFn(e.target.value as LickFunction)}>
          {LICK_FUNCTIONS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <label>
        Difficulty{" "}
        <select aria-label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          {["1", "2", "3", "4", "5"].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label>
        Artist <input aria-label="Artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
      </label>
      <label>
        Tags (comma separated) <input aria-label="Tags" value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>
      <label>
        ABC (notes, rests, bar lines){" "}
        <textarea aria-label="ABC" value={abc} onChange={(e) => setAbc(e.target.value)} rows={6} cols={48} />
      </label>
      <div>
        <button type="submit">Save lick</button> <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
