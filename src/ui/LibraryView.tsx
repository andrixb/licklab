import React from "react";
import { LICK_FUNCTIONS } from "../domain/lick.js";
import type { Lick } from "../domain/lick.js";
import { lickLab } from "./composition.js";

export function LibraryView({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }): React.JSX.Element {
  const [licks, setLicks] = React.useState<Lick[]>([]);
  const [search, setSearch] = React.useState("");
  const [fn, setFn] = React.useState("");
  const [loading, setLoading] = React.useState(true);

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
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <label>
          Search licks <input aria-label="Search licks" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="title, artist, tag…" />
        </label>
        <label>
          Function{" "}
          <select aria-label="Filter by function" value={fn} onChange={(e) => setFn(e.target.value)}>
            <option value="">All</option>
            {LICK_FUNCTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onNew}>
          + New lick
        </button>
      </div>
      {loading ? (
        <p>Loading…</p>
      ) : licks.length === 0 ? (
        <p>No licks yet — add one with ABC or wait for the seeded examples.</p>
      ) : (
        <ul>
          {licks.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => onOpen(l.id)}>
                {l.title}
              </button>{" "}
              <span>
                {l.harmonicContext.chords.map((c) => c.symbol).join(" | ")} · {l.harmonicContext.function} · ★{l.difficulty}
              </span>{" "}
              <button
                type="button"
                aria-label={`Delete ${l.title}`}
                onClick={() => {
                  void lickLab.removeLick(l.id).then(() => refresh());
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
