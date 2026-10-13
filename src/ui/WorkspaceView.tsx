// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import React from "react";
import { BAND_STYLES, type BandStyle } from "../domain/band.js";
import type { Lick } from "../domain/lick.js";
import type { RankedMatch } from "../domain/matching.js";
import type { SegmentMatches } from "../application/matching.js";
import { navigate, shareUrlForChords } from "./router.js";
import { workspace } from "./composition.js";
import { btn, btnGhost, btnPrimary, card, errorText, input, label, tag } from "./primitives.js";

export interface Placement {
  readonly id: string;
  readonly segmentIndex: number;
  readonly lick: Lick;
}

const TIER_LABEL: Record<1 | 2 | 3, string> = { 1: "exact", 2: "function", 3: "quality" };

function MatchRow({ match, onAudition, onPlace, onKeys }: {
  match: RankedMatch;
  onAudition: () => void;
  onPlace: () => void;
  onKeys: () => void;
}): React.JSX.Element {
  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5 border-b border-line last:border-b-0">
      <span className="text-cream grow min-w-40">
        {match.lick.title}
        {match.lick.source.artist ? <span className="text-dim text-sm"> · {match.lick.source.artist}</span> : ""}
      </span>
      <span className={tag}>{TIER_LABEL[match.tier]}</span>
      {match.likes > 0 && <span className={tag}>{match.likes} ♡</span>}
      <button type="button" className={btnGhost} onClick={onAudition} aria-label={`Audition ${match.lick.title}`}>▶</button>
      <button type="button" className={btnGhost} onClick={onKeys} aria-label={`Twelve keys ${match.lick.title}`}>12</button>
      <button type="button" className={btn} onClick={onPlace} aria-label={`Place ${match.lick.title} on bars`}>＋ bars</button>
    </li>
  );
}

export interface WorkspaceSeed {
  readonly preset?: string | undefined;
  readonly chords?: string | undefined;
}

function seedChords(seed: WorkspaceSeed | undefined): string {
  try {
    if (seed?.preset) return workspace.chordsOf(seed.preset);
    if (seed?.chords) return seed.chords;
  } catch {
    /* fall through to default */
  }
  return "Dm7 G7 | Cmaj7 |";
}

export function WorkspaceView({ seed }: { seed?: WorkspaceSeed | undefined }): React.JSX.Element {
  const [inputText, setInputText] = React.useState(() => seedChords(seed));
  const [style, setStyle] = React.useState<BandStyle>("swing");
  const [tempo, setTempo] = React.useState(120);
  const [parts, setParts] = React.useState({ bass: true, piano: true, drums: true });
  const [segments, setSegments] = React.useState<SegmentMatches[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [placements, setPlacements] = React.useState<Placement[]>([]);
  const [playing, setPlaying] = React.useState(false);
  const [shareCopied, setShareCopied] = React.useState(false);

  React.useEffect(() => workspace.onPlayChange(() => setPlaying(workspace.isPlaying)), []);

  React.useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      void workspace
        .matches(inputText)
        .then((r) => {
          if (!cancelled) {
            setSegments(r.result);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e));
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [inputText]);

  const bandPart = { ...parts, tempoBpm: tempo };

  const guard = (p: Promise<boolean>): void => {
    void p.then((found) => {
      if (!found) setError("That lick does not fit the current progression.");
    });
  };

  return (
    <section aria-label="progression workspace" className="grid gap-5">
      <div className={`${card} p-[18px] grid gap-3`}>
        <div className="flex flex-wrap gap-2" role="group" aria-label="presets">
          {workspace.presets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={btnGhost}
              onClick={() => {
                setInputText(workspace.chordsOf(p.id));
                navigate({ view: "play", chords: workspace.chordsOf(p.id) });
              }}
            >
              {p.title}
            </button>
          ))}
        </div>
        <label className={label}>
          Chords (bars separated by |)
          <textarea
            className={`${input} min-h-[64px] font-mono`}
            aria-label="Chords input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className={label}>
            Style
            <select className={input} aria-label="Band style" value={style} onChange={(e) => setStyle(e.target.value as BandStyle)}>
              {BAND_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Tempo
            <input className={input} aria-label="Tempo BPM" type="number" min={40} max={300} value={tempo} onChange={(e) => setTempo(Number(e.target.value))} />
          </label>
          {(["bass", "piano", "drums"] as const).map((v) => (
            <label key={v} className={`${label} flex items-center gap-2`}>
              <input type="checkbox" checked={parts[v]} onChange={(e) => setParts((p) => ({ ...p, [v]: e.target.checked }))} aria-label={v} />
              {v}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {playing ? (
            <button type="button" className={btnPrimary} onClick={() => workspace.stop()}>■ Stop</button>
          ) : (
            <button type="button" className={btnPrimary} onClick={() => guard(workspace.playChorus(inputText, style, bandPart))}>
              ▶ Play chorus
            </button>
          )}
          {placements.length > 0 && (
            <button
              type="button"
              className={btn}
              onClick={() => guard(workspace.playSoloChorus(inputText, placements.map((pl) => ({ lick: pl.lick, segmentIndex: pl.segmentIndex })), style, bandPart))}
            >
              ▶ Solo chorus ({placements.length})
            </button>
          )}
          <button
            type="button"
            className={btn}
            onClick={() => {
              void navigator.clipboard?.writeText(shareUrlForChords(inputText)).catch(() => undefined);
              setShareCopied(true);
              window.setTimeout(() => setShareCopied(false), 1500);
            }}
          >
            {shareCopied ? "Link copied" : "Share link"}
          </button>
        </div>
        {error && (
          <p className={errorText} role="alert">
            {error}
          </p>
        )}
      </div>

      {placements.length > 0 && (
        <div className={`${card} p-[18px]`} aria-label="placed licks">
          <h3 className="font-serif mt-0 mb-2">Your solo chorus</h3>
          <ol className="list-none m-0 p-0">
            {placements.map((pl, i) => (
              <li key={pl.id} className="flex items-center gap-3 py-1">
                <span className="text-dim text-sm">bar ~{i + 1}</span>
                <span className="grow">{pl.lick.title}</span>
                <button type="button" className={btnGhost} aria-label={`Remove ${pl.lick.title}`} onClick={() => setPlacements((ps) => ps.filter((x) => x.id !== pl.id))}>
                  ✕
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {segments.map((sm, i) => (
        <div key={`${sm.segment.startBeat}-${i}`} className={`${card} p-[18px]`} aria-label={`segment ${i + 1}`}>
          <p className="m-0 mb-2">
            <span className="font-semibold text-gold-dim tracking-wide">{sm.segment.chords.map((c) => c.symbol).join(" → ")}</span>{" "}
            <span className={tag}>{sm.segment.functionKey}</span>
            <span className="text-dim text-sm ml-2">
              beats {sm.segment.startBeat}–{sm.segment.endBeat}
            </span>
          </p>
          {sm.matches.length === 0 ? (
            <p className="text-dim text-sm m-0">No licks fit this segment yet — contribute one or wait for the community.</p>
          ) : (
            <ul className="list-none m-0 p-0">
              {sm.matches.map((m) => (
                <MatchRow
                  key={`${i}:${m.lick.id}`}
                  match={m}
                  onAudition={() => guard(workspace.auditionLick(inputText, m.lick, style, bandPart))}
                  onKeys={() => guard(workspace.playTwelveKeys(m.lick, style, bandPart))}
                  onPlace={() =>
                    setPlacements((ps) =>
                      ps.some((x) => x.lick.id === m.lick.id && x.segmentIndex === i)
                        ? ps
                        : [...ps, { id: `${i}:${m.lick.id}`, segmentIndex: i, lick: m.lick }],
                    )
                  }
                />
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}
