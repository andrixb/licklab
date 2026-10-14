// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// The sample pack must exist, be real audio, and be reachable at the URL the
// engine actually requests. This file is the regression net for the M3.5 botch:
// the shipped pack was generated placeholder SINES (every instrument "beeped")
// in a directory Vite never copied to dist (silently 404'd), and the lick voice
// was created with `urls: {}` so it had no buffers at all.
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sampleDirFor, samplerUrlsFor, type SampleVoice } from "../../src/adapters/tone/sampleMaps.js";

const ROOT = resolve(process.cwd());
const VOICES: SampleVoice[] = ["bass", "drums", "piano", "lick"];

interface Wav {
  channels: number;
  sampleRate: number;
  bits: number;
  /** Mono 16-bit PCM samples. */
  data: Int16Array;
}

/** Note name or GM number -> MIDI. */
function midiOf(key: string | number): number {
  if (typeof key === "number") return key;
  if (/^\d+$/.test(key)) return parseInt(key, 10); // GM note numbers (drums)
  const m = /^([A-G]#?)(-?\d)$/.exec(key);
  if (!m) throw new Error(`unexpected note key: ${key}`);
  const semitone = NOTES[m[1] ?? ""];
  if (semitone === undefined) throw new Error(`unknown note letter: ${m[1]}`);
  return semitone + 12 * (parseInt(m[2] ?? "0", 10) + 1);
}

const NOTES: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };

/** Chunk-aware WAV reader (ffmpeg writes a LIST/INFO chunk before "data"). */
function readWav(path: string): Wav {
  const b = readFileSync(path);
  expect(b.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(b.subarray(8, 12).toString("ascii")).toBe("WAVE");
  let offset = 12;
  let channels = 0;
  let sampleRate = 0;
  let bits = 0;
  let data: Int16Array | null = null;
  while (offset + 8 <= b.length) {
    const id = b.toString("ascii", offset, offset + 4);
    const size = b.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      channels = b.readUInt16LE(body + 2);
      sampleRate = b.readUInt32LE(body + 4);
      bits = b.readUInt16LE(body + 14);
    } else if (id === "data") {
      data = new Int16Array(b.buffer, b.byteOffset + body, size / 2);
      break;
    }
    offset = body + size + (size % 2);
  }
  if (!data) throw new Error(`no data chunk in ${path}`);
  return { channels, sampleRate, bits, data };
}

/**
 * Same targeted check scripts/build-samples.mjs runs: is there confident
 * periodicity at this note (±2 semitones)? Catches an octave-shifted or
 * extra-note file without depending on global peak picking.
 */
function pitchScoreAt(wav: Wav, note: string): number {
  const { data, sampleRate } = wav;
  const n = data.length;
  const at = (i: number) => data[i] ?? 0;
  let peak = 0;
  for (let i = 0; i < Math.min(n, Math.floor(sampleRate * 0.3)); i++) {
    const v = Math.abs(at(i));
    if (v > peak) peak = v;
  }
  let start = Math.floor(n * 0.2);
  for (let i = 0; i < n; i++) {
    if (Math.abs(at(i)) >= peak) {
      start = i + Math.floor(sampleRate * 0.06);
      break;
    }
  }
  const len = Math.min(Math.floor(sampleRate * 0.3), n - start - 4000);
  const w: number[] = [];
  for (let i = 0; i < len; i++) w.push(at(start + i) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (len - 1))));
  const centre = Math.round(sampleRate / (440 * 2 ** ((midiOf(note) - 69) / 12)));
  const margin = Math.round(centre * (2 ** (2 / 12) - 1));
  let best = 0;
  for (let lag = centre - margin; lag <= centre + margin; lag++) {
    if (lag < 1 || lag + 1 >= len) continue;
    let e = 0;
    let a = 0;
    let c = 0;
    for (let i = 0; i + lag < len; i++) {
      const x = w[i] ?? 0;
      const y = w[i + lag] ?? 0;
      e += x * y;
      a += x * x;
      c += y * y;
    }
    const score = e / (Math.sqrt(a * c) || 1);
    if (score > best) best = score;
  }
  return best;
}

function abs(voice: SampleVoice, url: string): string {
  return join(ROOT, sampleDirFor(voice), url);
}

/**
 * A pure sine has 1-2 distinct zero-crossing intervals in strict alternation;
 * every real instrument sound has far more. Cheap "is this a placeholder
 * tone?" sentinel (the shipped pack used to be exactly those).
 */
function distinctZeroCrossingIntervals(wav: Wav): number {
  const { data } = wav;
  const start = Math.floor(data.length / 4);
  const end = Math.min(start + wav.sampleRate * 2, data.length - 2);
  const intervals = new Set<number>();
  let last = -1;
  for (let i = start; i < end; i++) {
    const a = data[i] ?? 0;
    const c = data[i + 1] ?? 0;
    if (a < 0 !== c < 0) {
      if (last >= 0) intervals.add(i - last);
      last = i;
    }
  }
  return intervals.size;
}

describe("sample pack (ADR-018)", () => {
  it("every voice is mapped to at least one sample", () => {
    // Regression: the lick voice used to be `{ urls: {} }` — no buffers at all.
    for (const voice of VOICES) {
      const { urls, baseUrl } = samplerUrlsFor(voice);
      expect(Object.keys(urls).length, `${voice} has no samples`).toBeGreaterThan(0);
      expect(Object.values(urls).every((u) => u.endsWith(".wav"))).toBe(true);
      expect(baseUrl.endsWith("/")).toBe(true);
      expect(baseUrl.startsWith("/samples/")).toBe(true);
    }
  });

  it("mapped filenames are bare (never full paths)", () => {
    // Regression: urls values were full paths while baseUrl was also set, so
    // Tone double-prefixed and every request 404'd.
    for (const voice of VOICES) {
      for (const [note, url] of Object.entries(samplerUrlsFor(voice).urls)) {
        expect(url.startsWith("/"), `${voice}/${note} looks like a path`).toBe(false);
        expect(url).not.toContain("/");
      }
    }
  });

  it("built URLs keep the whole filename (no fragment truncation)", () => {
    // Regression: "#" (sharp) in a filename is a URL FRAGMENT separator. Tone
    // builds `baseUrl + filename`, so "/samples/piano/UprightPiano_C#3.wav"
    // requests "/samples/piano/UprightPiano_C" — the SPA fallback answers
    // 200 text/html, decodeAudioData fails, and the voice is silently mute
    // while the "#"-free drums still play. Sharp is spelled "s" in filenames.
    for (const voice of VOICES) {
      const { urls, baseUrl } = samplerUrlsFor(voice);
      for (const [note, url] of Object.entries(urls)) {
        // exactly what the browser resolves when Tone concatenates the two
        const resolved = new URL(`${baseUrl}${url}`, "https://licklab.invalid");
        expect(resolved.pathname, `${voice}/${note} truncated: ${resolved.pathname}`).toBe(`${baseUrl}${url}`);
        expect(resolved.hash, `${voice}/${note} left a fragment`).toBe("");
      }
    }
  });

  it("every mapped file exists on disk", () => {
    // Regression: the pack sat at repo root and Vite never copied it to dist,
    // so /samples/*.wav silently served the SPA's index.html instead.
    for (const voice of VOICES) {
      for (const url of Object.values(samplerUrlsFor(voice).urls)) {
        expect(existsSync(abs(voice, url)), `missing sample: ${sampleDirFor(voice)}/${url}`).toBe(true);
      }
    }
  });

  it("samples are mono 44.1 kHz WAVs long enough to be playable", () => {
    for (const voice of VOICES) {
      for (const url of Object.values(samplerUrlsFor(voice).urls)) {
        const wav = readWav(abs(voice, url));
        expect(wav.bits, `${url} bit depth`).toBe(16);
        expect(wav.channels, `${url} channels`).toBeLessThanOrEqual(1);
        expect(wav.sampleRate, `${url} sample rate`).toBe(44100);
        expect(wav.data.length / 44100, `${url} duration (s)`).toBeGreaterThan(0.1);
      }
    }
  });

  it("no sample is a generated placeholder (pure sine) tone", () => {
    // Regression: sine-wave placeholders shipped once and every voice beeped.
    for (const voice of VOICES) {
      for (const url of Object.values(samplerUrlsFor(voice).urls)) {
        const distinct = distinctZeroCrossingIntervals(readWav(abs(voice, url)));
        expect(distinct, `placeholder sine detected: ${voice}/${url}`).toBeGreaterThan(4);
      }
    }
  });

  it("no sample is whisper-quiet (normalize at build time)", () => {
    // Regression: the contrabass arrived ~30dB under the kick, so the bass was
    // inaudible no matter the voice gain. The build peak-normalizes everything
    // to -3dBFS; this pins a floor so a silent file can never ship.
    for (const voice of VOICES) {
      for (const url of Object.values(samplerUrlsFor(voice).urls)) {
        const wav = readWav(abs(voice, url));
        let peak = 0;
        for (let i = 0; i < wav.data.length; i++) {
          const a = Math.abs(wav.data[i] ?? 0);
          if (a > peak) peak = a;
        }
        expect(peak / 32768, `${voice}/${url} peaks at ${(20 * Math.log10(peak / 32768)).toFixed(1)}dBFS`).toBeGreaterThan(0.35);
      }
    }
  });

  it("drums cover the roles the band engine schedules", () => {
    // kick 35/36, snare 38/40, hat 42/44/46, ride 51/59, crash 49/57 —
    // plus the jmove adapter's GM extras (side-stick 37, toms 43/45/47/50,
    // china/splash 52/55, ride-bell 53), aliased to family voices.
    const drums = samplerUrlsFor("drums").urls;
    for (const midi of [35, 36, 37, 38, 40, 42, 43, 44, 45, 46, 47, 49, 50, 51, 52, 53, 55, 57, 59]) {
      expect(drums[midi], `no drum sample for MIDI ${midi}`).toBeDefined();
    }
    expect(new Set(Object.values(drums)).size).toBe(5);
  });

  it("every mapped sample sounds the note it is named for", () => {
    // Regression: the upstream contrabass pack labels files an octave low, so a
    // "G#2" file really contains G#3 + F#3 — the bass literally played two notes
    // at once. Builds now name files by measured pitch (src/adapters/tone/); this
    // test is the second net, so a renamed or swapped file cannot ship.
    // drums are unpitched (GM-kit samples) — pitch only applies to pitched voices
    for (const voice of (["bass", "piano", "lick"] as const)) {
      const { urls } = samplerUrlsFor(voice);
      for (const [note, url] of Object.entries(urls)) {
        const score = pitchScoreAt(readWav(abs(voice, url)), note);
        expect(score, `${voice}/${url} (${note}) has no periodicity at its note (score ${score.toFixed(2)})`).toBeGreaterThan(0.5);
      }
    }
  });

  it("leaves no more than 2 semitones of repitching anywhere the band plays", () => {
    // Regression: a sparse map makes Tone resample a neighbour into the note,
    // which is what makes a sampler sound fake. 2 semitones is inaudible.
    const expectNear = (voice: SampleVoice, fromMidi: number, toMidi: number) => {
      const mapped = Object.keys(samplerUrlsFor(voice).urls).map(midiOf);
      for (let m = fromMidi; m <= toMidi; m++) {
        const nearest = mapped.reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a), mapped[0]!);
        expect(nearest - m < 3 && m - nearest < 3, `${voice} MIDI ${m} would repitch ${nearest - m} semitones`).toBe(true);
      }
    };
    expectNear("bass", 28, 45); // E1..A2 (placeNear(.., 40) register)
    expectNear("piano", 49, 84); // C#3..C6 (comping + lick range)
  });
});
