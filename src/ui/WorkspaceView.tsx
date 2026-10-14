// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

import React from "react";
import { BAND_STYLES, type BandStyle } from "../domain/band.js";
import type { Lick } from "../domain/lick.js";
import type { RankedMatch } from "../domain/matching.js";
import type { SegmentMatches } from "../application/matching.js";
import type { BassVariant, PianoVariant, DrumVariant } from "../application/ports.js";
import { navigate, shareUrlForChords } from "./router.js";
import { workspace, type WorkspacePlayOpts } from "./composition.js";
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

/** Control-room defaults per style (Classic Swing / Soft Ballad / Bossa Nova presets). */
interface FeelState {
  readonly swing: number;
  readonly density: number;
  readonly strum: number;
  readonly creativity: number;
  readonly conversation: number;
  readonly airGaps: number;
  readonly harmonic: number;
  readonly cxDrums: number;
  readonly cxPiano: number;
  readonly cxBass: number;
}

const FEEL_DEFAULTS: Record<BandStyle, FeelState> = {
  swing: { swing: 70, density: 50, strum: 20, creativity: 30, conversation: 35, airGaps: 15, harmonic: 20, cxDrums: 50, cxPiano: 50, cxBass: 50 },
  ballad: { swing: 40, density: 20, strum: 0, creativity: 20, conversation: 25, airGaps: 35, harmonic: 20, cxDrums: 50, cxPiano: 50, cxBass: 50 },
  bossa: { swing: 0, density: 50, strum: 20, creativity: 15, conversation: 20, airGaps: 10, harmonic: 15, cxDrums: 50, cxPiano: 50, cxBass: 50 },
  straight: { swing: 0, density: 50, strum: 0, creativity: 15, conversation: 20, airGaps: 10, harmonic: 15, cxDrums: 50, cxPiano: 50, cxBass: 50 },
};

function fmtTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Slider({ name, value, min, max, step, unit, onChange }: {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}): React.JSX.Element {
  return (
    <label className={`${label} flex items-center gap-2`}>
      <span className="w-28 shrink-0">{name}</span>
      <input
        type="range"
        className="grow"
        aria-label={name}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="text-dim text-sm w-14 text-right">
        {value}
        {unit}
      </span>
    </label>
  );
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
  const [levels, setLevels] = React.useState({ bass: 100, piano: 100, drums: 100 });
  const [bassVariant, setBassVariant] = React.useState<BassVariant>("upright");
  const [pianoVariant, setPianoVariant] = React.useState<PianoVariant>("upright");
  const [drumVariant, setDrumVariant] = React.useState<DrumVariant>("jazz");
  const [countIn, setCountIn] = React.useState<0 | 4 | 8>(4);
  const [loop, setLoop] = React.useState(false);
  const [feel, setFeel] = React.useState<FeelState>(FEEL_DEFAULTS.swing);
  const [takeSeed, setTakeSeed] = React.useState<number | null>(null);
  const [position, setPosition] = React.useState(0);
  const [segments, setSegments] = React.useState<SegmentMatches[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [placements, setPlacements] = React.useState<Placement[]>([]);
  const [playing, setPlaying] = React.useState(false);
  const [shareCopied, setShareCopied] = React.useState(false);

  React.useEffect(() => workspace.onPlayChange(() => setPlaying(workspace.isPlaying)), []);

  React.useEffect(() => {
    if (!playing) {
      setPosition(0);
      return;
    }
    const id = window.setInterval(() => setPosition(workspace.positionSeconds()), 250);
    return () => window.clearInterval(id);
  }, [playing]);

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

  React.useEffect(() => {
    void workspace.setBassVariant(bassVariant);
  }, [bassVariant]);

  React.useEffect(() => {
    void workspace.setPianoVariant(pianoVariant);
  }, [pianoVariant]);

  React.useEffect(() => {
    void workspace.setDrumVariant(drumVariant);
  }, [drumVariant]);

  const bandPart = { ...parts, tempoBpm: tempo };
  const setF = (key: keyof FeelState) => (v: number) => setFeel((f) => ({ ...f, [key]: v }));
  const setLevel = (key: keyof typeof levels) => (v: number) => setLevels((l) => ({ ...l, [key]: v }));

  const playOpts: WorkspacePlayOpts = {
    levels: { bass: levels.bass / 100, piano: levels.piano / 100, drums: levels.drums / 100 },
    loop,
    countInBeats: countIn,
    pianoVoice: pianoVariant === "dx7" ? "dx7" : "upright",
    band: {
      ...(takeSeed !== null ? { seed: takeSeed } : {}),
      density: feel.density,
      swingAmount: feel.swing,
      strumMs: feel.strum,
      creativity: feel.creativity,
      conversation: feel.conversation,
      airGaps: feel.airGaps,
      harmonicFreedom: feel.harmonic,
      drumComplexity: feel.cxDrums,
      pianoComplexity: feel.cxPiano,
      bassComplexity: feel.cxBass,
    },
  };

  const info = workspace.playbackInfo();
  const beat = info ? position - (info.countInBeats * 60) / info.tempoBpm : 0;
  const currentSegment = beat >= 0 ? segments.findIndex((sm) => beat >= sm.segment.startBeat && beat < sm.segment.endBeat) : -1;

  const guard = (p: Promise<boolean>): void => {
    void p.then((found) => {
      if (!found) setError(workspace.audioError ?? "That lick does not fit the current progression.");
    });
  };

  const pickStyle = (s: BandStyle): void => {
    setStyle(s);
    setFeel(FEEL_DEFAULTS[s]);
    setTakeSeed(null);
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
            <select className={input} aria-label="Band style" value={style} onChange={(e) => pickStyle(e.target.value as BandStyle)}>
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
        </div>
        <div className="flex flex-wrap gap-2">
          {playing ? (
            <button type="button" className={btnPrimary} onClick={() => workspace.stop()}>■ Stop</button>
          ) : (
            <button type="button" className={btnPrimary} onClick={() => guard(workspace.playChorus(inputText, style, bandPart, playOpts))}>
              ▶ Play chorus
            </button>
          )}
          <div className="flex flex-wrap gap-2 items-center" role="group" aria-label="Count-in">
            {([0, 4, 8] as const).map((b) => (
              <button
                key={b}
                type="button"
                className={countIn === b ? btn : btnGhost}
                aria-label={b === 0 ? "Count-in off" : `Count-in ${b / 4} bar${b === 4 ? "" : "s"}`}
                aria-pressed={countIn === b}
                onClick={() => setCountIn(b)}
              >
                {b === 0 ? "No count" : `${b / 4} bar${b === 4 ? "" : "s"}`}
              </button>
            ))}
          </div>
          <label className={`${label} flex items-center gap-2`}>
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} aria-label="Loop chorus" />
            Loop
          </label>
          <button type="button" className={btnGhost} onClick={() => setTakeSeed((Math.random() * 0xffffffff) | 0)} aria-label="New take">
            New take
          </button>
          {placements.length > 0 && (
            <button
              type="button"
              className={btn}
              onClick={() => guard(workspace.playSoloChorus(inputText, placements.map((pl) => ({ lick: pl.lick, segmentIndex: pl.segmentIndex })), style, bandPart, playOpts))}
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
        {info && (
          <p className="text-dim text-sm m-0" aria-label="Playback status">
            {fmtTime(position)} / {fmtTime(info.totalSeconds)} · {info.engineLabel} · take {takeSeed !== null ? takeSeed.toString(16) : "auto"}
            {currentSegment >= 0 && segments[currentSegment] ? ` · now: ${segments[currentSegment]?.segment.chords.map((c) => c.symbol).join(" ") ?? ""}` : ""}
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={`${card} p-[18px] grid gap-3`} aria-label="Band mixer">
        <h3 className="font-serif mt-0 mb-0">Mixer</h3>
        {(["bass", "piano", "drums"] as const).map((v) => (
          <div key={v} className="flex flex-wrap items-center gap-2">
            <label className={`${label} flex items-center gap-2`}>
              <input type="checkbox" checked={parts[v]} onChange={(e) => setParts((p) => ({ ...p, [v]: e.target.checked }))} aria-label={v} />
              {v}
            </label>
            <div className="grow min-w-40">
              <Slider name={`${v} level`} value={levels[v]} min={0} max={100} step={1} unit="%" onChange={setLevel(v)} />
            </div>
          </div>
        ))}
        <label className={label}>
          Bass sound
          <select className={input} aria-label="Bass sound" value={bassVariant} onChange={(e) => setBassVariant(e.target.value as BassVariant)}>
            <option value="upright">Upright (sampled)</option>
            <option value="acoustic">Acoustic Bass</option>
            <option value="electric">Electric Bass</option>
          </select>
        </label>
        <label className={label}>
          Piano sound
          <select className={input} aria-label="Piano sound" value={pianoVariant} onChange={(e) => setPianoVariant(e.target.value as PianoVariant)}>
            <option value="upright">Upright (sampled)</option>
            <option value="dx7">DX7 (FM electric)</option>
            <option value="electric_piano">Electric Piano 2</option>
            <option value="grand_piano">Grand Piano</option>
          </select>
        </label>
        <label className={label}>
          Drums
          <select className={input} aria-label="Drums" value={drumVariant} onChange={(e) => setDrumVariant(e.target.value as DrumVariant)}>
            <option value="jazz">Jazz Kit (sampled)</option>
            <option value="machine">Machine Kit (Casio RZ-1)</option>
          </select>
        </label>
      </div>

      <div className={`${card} p-[18px] grid gap-3`} aria-label="Band feel">
        <h3 className="font-serif mt-0 mb-0">Feel</h3>
        <Slider name="Swing" value={feel.swing} min={0} max={100} step={1} unit="%" onChange={setF("swing")} />
        <Slider name="Density" value={feel.density} min={0} max={100} step={1} unit="%" onChange={setF("density")} />
        <Slider name="Strum" value={feel.strum} min={0} max={30} step={1} unit="ms" onChange={setF("strum")} />
      </div>

      <div className={`${card} p-[18px] grid gap-3`} aria-label="Band musicality">
        <h3 className="font-serif mt-0 mb-0">Musicality</h3>
        <Slider name="Creativity" value={feel.creativity} min={0} max={100} step={1} unit="%" onChange={setF("creativity")} />
        <Slider name="Conversation" value={feel.conversation} min={0} max={100} step={1} unit="%" onChange={setF("conversation")} />
        <Slider name="Air gaps" value={feel.airGaps} min={0} max={100} step={1} unit="%" onChange={setF("airGaps")} />
        <Slider name="Harmonic freedom" value={feel.harmonic} min={0} max={100} step={1} unit="%" onChange={setF("harmonic")} />
      </div>

      <div className={`${card} p-[18px] grid gap-3`} aria-label="Instrument complexity">
        <h3 className="font-serif mt-0 mb-0">Complexity</h3>
        <Slider name="Drums" value={feel.cxDrums} min={0} max={100} step={1} unit="%" onChange={setF("cxDrums")} />
        <Slider name="Piano" value={feel.cxPiano} min={0} max={100} step={1} unit="%" onChange={setF("cxPiano")} />
        <Slider name="Bass" value={feel.cxBass} min={0} max={100} step={1} unit="%" onChange={setF("cxBass")} />
      </div>
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
        <div key={`${sm.segment.startBeat}-${i}`} aria-label={`segment ${i + 1}`} aria-current={i === currentSegment ? "true" : undefined} className={`${card} p-[18px]`}>
          <p className="m-0 mb-2">
            <span className="font-semibold text-gold-dim tracking-wide">
              {i === currentSegment ? "▶ " : ""}
              {sm.segment.chords.map((c) => c.symbol).join(" → ")}
            </span>{" "}
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
                  onAudition={() => guard(workspace.auditionLick(inputText, m.lick, style, bandPart, playOpts))}
                  onKeys={() => guard(workspace.playTwelveKeys(m.lick, style, bandPart, playOpts))}
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
