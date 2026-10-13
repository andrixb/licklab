// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

/**
 * Build the band-engine sample pack (ADR-018).
 *
 *   node scripts/build-samples.mjs
 *
 * Sources — BOTH CC0 (no attribution gate, no share-alike, nothing to copyleft):
 *   - VSCO 2 CE (Versilian Studios, CC0 1.0):
 *       bass  Strings/Solo Contrabass/Pizz      (pizzicato)
 *       piano Keys/Upright Piano                (dyn2 = medium velocity)
 *   - Virtuosity Drums (CC0): "oh" overhead mix of the "house" jazz kit
 *
 * Every file is downmixed to MONO 44.1 kHz 16-bit WAV and trimmed: the web
 * pack must stay small (free-tier static budget) and Tone already cuts
 * playback to the requested duration, so long tails are dead weight.
 *
 * Output lands in public/samples/<voice>/ and is served at /samples/<voice>/.
 * src/adapters/tone/sampleMaps.ts must list the same filenames (a unit test
 * asserts every mapped file exists, so a rename can never ship a 404).
 */
import { mkdirSync, rmSync, existsSync, writeFileSync, readdirSync, statSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/samples");
const TMP = "/tmp/licklab-sample-src";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteName = (midi) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

/** voice -> [{ src, out, trim }] */
function sources() {
  // Upright piano maps index -> MIDI key number (MappingChart.txt): index k is
  // MIDI 21 + 2k, and only even indices ship, so samples land every 4 semitones
  // (C#3, F3, A3, …) — the pack's own design; Tone repitches the notes between.
  // 10 notes C#3..C#6 covers comping AND lick lines (which reach up to C6 —
  // gaps above F5 used to force Tone to repitch by up to 7 semitones).
  const piano = [];
  for (let midi = 49; midi <= 85; midi += 4) {
    const index = String((midi - 21) / 2).padStart(3, "0");
    piano.push({
      src: `Keys/Upright Piano/Player_dyn2_rr1_${index}.wav`,
      out: `piano/UprightPiano_${noteName(midi)}.wav`,
      trim: 2.2,
      note: noteName(midi),
    });
  }

  // Bass. Two facts about the upstream VSCO-2-CE contrabass set:
  //   1. filenames are NOT trustworthy — every file sounds ONE OCTAVE UP from
  //      the vendor label (a "G#2" file really contains G#3 + F3: that is why
  //      the bass used to sound like extra notes).
  //   2. the low/labelled files carry a noisy click that defeats analysis.
  // So the pack is built from files that MEASURE correctly, named after their
  // measured pitch, and the in-between anchors are simply a verified neighbour
  // transposed (assertPitch still checks the result, so a mislabelled or noisy
  // file fails the build instead of shipping).
  // Anchors land every 1-4 semitones over E1..A2 — the range placeNear(.., 40)
  // uses — so Tone never repitches by more than 2 semitones.
  const bass = [
    { src: "Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_E0_v1_rr1.wav", note: "E1" },
    { src: "x", note: "F#1", from: "bass/Contrabass_pizz_E1.wav", semis: 2 },
    { src: "x", note: "G1", from: "bass/Contrabass_pizz_E1.wav", semis: 3 },
    { src: "x", note: "A#1", from: "bass/Contrabass_pizz_E1.wav", semis: 6 },
    { src: "Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_C1_v1_rr1.wav", note: "C2" },
    { src: "Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_D1_v1_rr1.wav", note: "D2" },
    { src: "x", note: "F#2", from: "bass/Contrabass_pizz_D2.wav", semis: 4 },
    { src: "Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_G#1_v1_rr1.wav", note: "G#2" },
    { src: "Strings/Solo Contrabass/Pizz/BKCtbss_Pizz_A1_v1_rr1.wav", note: "A2" },
  ].map((b) => ({ ...b, out: `bass/Contrabass_pizz_${b.note}.wav`, trim: 1.2 }));

  // Virtuosity kit: kick/snare from their CLOSE mics (the "oh" overhead mix has
  // almost no low end and made the kick sound like a bright click), cymbals and
  // hats from the overheads where they were actually recorded.
  const drums = [
    { src: "Samples/kickmic/kick/kickmic_kick_snoff_vl2_rr1.flac", out: "drums/Kick.wav", trim: 1.0, note: null },
    { src: "Samples/snaremic/snare/snaremic_snare_center_vl2.flac", out: "drums/Snare.wav", trim: 0.6, note: null },
    { src: "Samples/oh/hh/oh_hh_closed_vl2_rr1.flac", out: "drums/HiHat.wav", trim: 0.35, note: null },
    { src: "Samples/oh/ride/oh_ride_ride_vl2_rr1.flac", out: "drums/Ride.wav", trim: 2.5, note: null },
    { src: "Samples/oh/crash/oh_crash_crash_vl2_rr1.flac", out: "drums/Crash.wav", trim: 2.5, note: null },
  ];

  return { piano, bass, drums };
}

function sh(cmd, cwd = ROOT) {
  execSync(cmd, { cwd, stdio: "inherit" });
}

function sparseClone(url, dirName, paths) {
  const target = join(TMP, dirName);
  rmSync(target, { recursive: true, force: true });
  sh(`git clone --depth 1 --filter=blob:none --sparse ${url} ${target}`);
  sh(`git sparse-checkout set ${paths.map((p) => `"${p}"`).join(" ")}`, target);
  return target;
}

/** mono/44.1k/16-bit + trim -> small, browser-safe WAV (optionally pitched up). */
function transcode(src, dest, trim, semis = 0) {
  mkdirSync(dirname(dest), { recursive: true });
  // asetrate/aresample transposes (the tempo shift that comes with it is exactly
  // what a sampler does when repitching, and is what Tone would apply anyway).
  const pitch = semis ? `-af asetrate=${Math.round(44100 * 2 ** (semis / 12))},aresample=44100` : "";
  const duration = trim * (semis ? 2 ** (semis / 12) : 1); // compensate the rate change
  execSync(
    `ffmpeg -hide_banner -loglevel error -y -i "${src}" ${pitch} -ac 1 -ar 44100 -t ${duration.toFixed(3)} -c:a pcm_s16le "${dest}"`,
    { cwd: ROOT, stdio: "inherit" },
  );
}

const NOTE_TO_PC = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
const midiOf = (note) => {
  const m = /([A-G]#?)(-?\d)/.exec(note);
  if (!m) throw new Error(`cannot parse note: ${note}`);
  return NOTE_TO_PC[m[1]] + 12 * (parseInt(m[2], 10) + 1);
};

/**
 * Does the file actually contain the note it is named for? Cross-correlates
 * within ±2 semitones of the note and requires a confident period — an
 * octave-shifted upstream file (the VSCO contrabass set is labelled an octave
 * low, and every "G#2" file contains G#3 + F#3) fails here instead of shipping.
 */
function hasPitch(path, note) {
  const b = readFileSync(path);
  let offset = 12;
  let sampleRate = 44100;
  let data = null;
  while (offset + 8 <= b.length) {
    const id = b.toString("ascii", offset, offset + 4);
    const size = b.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") sampleRate = b.readUInt32LE(body + 4);
    else if (id === "data") {
      data = b.subarray(body, body + size);
      break;
    }
    offset = body + size + (size % 2);
  }
  if (!data) throw new Error(`no data chunk in ${path}`);
  const n = Math.floor(data.length / 2);
  const at = (i) => data.readInt16LE(i * 2);

  // Look in the sustained part, away from the pluck, but skip the quiet tail.
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
  const w = [];
  for (let i = 0; i < len; i++) {
    w.push(at(start + i) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (len - 1))));
  }
  const want = 440 * 2 ** ((midiOf(note) - 69) / 12);
  const centre = Math.round(sampleRate / want);
  const margin = Math.round(centre * (2 ** (2 / 12) - 1)); // +2 semitones
  let best = 0;
  for (let lag = centre - margin; lag <= centre + margin; lag++) {
    if (lag < 1 || lag + 1 >= len) continue;
    let e = 0;
    let a = 0;
    let c = 0;
    for (let i = 0; i + lag < len; i++) {
      e += w[i] * w[i + lag];
      a += w[i] * w[i];
      c += w[i + lag] * w[i + lag];
    }
    const score = e / (Math.sqrt(a * c) || 1);
    if (score > best) best = score;
  }
  return { score: best, want };
}


function main() {
  for (const tool of ["git", "ffmpeg"]) {
    try {
      execSync(`which ${tool}`, { stdio: "ignore" });
    } catch {
      console.error(`build-samples: "${tool}" is required (install ffmpeg: brew install ffmpeg)`);
      process.exit(1);
    }
  }

  mkdirSync(TMP, { recursive: true });
  rmSync(OUT, { recursive: true, force: true });
  for (const v of ["bass", "drums", "piano"]) mkdirSync(join(OUT, v), { recursive: true });

  console.log("› cloning CC0 source packs (sparse)…");
  const vsco = sparseClone("https://github.com/sgossner/VSCO-2-CE.git", "VSCO-2-CE", ["Strings/Solo Contrabass/Pizz", "Keys/Upright Piano"]);
  const drums = sparseClone("https://github.com/sfzinstruments/virtuosity_drums.git", "virtuosity_drums", [
    "Samples/kickmic/kick",
    "Samples/snaremic/snare",
    "Samples/oh/hh",
    "Samples/oh/ride",
    "Samples/oh/crash",
  ]);

  const all = Object.values(sources()).flat();
  let total = 0;
  console.log(`› transcoding ${all.length} samples (mono, 44.1 kHz, 16-bit)…`);
  for (const { src, out, trim, note, from, semis } of all) {
    // `from` derives an anchor from an already-built sample (donors are listed
    // first in the spec above); otherwise the source is an upstream file.
    const absSrc = from ? join(OUT, from) : src.startsWith("Samples/") ? join(drums, src) : join(vsco, src);
    if (!existsSync(absSrc)) {
      console.error(`  ✗ missing source: ${absSrc}`);
      process.exit(1);
    }
    transcode(absSrc, join(OUT, out), trim, semis ?? 0);
    const kb = statSync(join(OUT, out)).size / 1024;
    total += kb;
    // Pitched samples must contain the note they are named for (a mislabelled
    // upstream file silently detunes a whole voice).
    if (note) {
      const { score, want } = hasPitch(join(OUT, out), note);
      if (score < 0.5) {
        throw new Error(`${out} is named ${note} (${want.toFixed(1)}Hz) but has no periodicity at that pitch (score ${score.toFixed(2)})`);
      }
    }
    console.log(`  ✓ ${out} (${kb.toFixed(0)} KB${note ? `, ${note}` : ""}${semis ? `, ${semis > 0 ? "+" : ""}${semis}st` : ""})`);
  }

  writeFileSync(
    join(OUT, "ATTRIBUTION.md"),
    `# Sample pack — all sources CC0 1.0 (public domain dedication)

Built by \`node scripts/build-samples.mjs\` (never hand-edit the WAVs).

## Bass — VSCO 2 CE, "Solo Contrabass" pizzicato
- Author: Versilian Studios LLC (https://www.versilstudios.com/)
- License: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/)
- Source: https://github.com/sgossner/VSCO-2-CE

## Drums — Virtuosity Drums (overhead mix)
- Recorded at Virtuosity Musical Instruments, Boston; performed by Austin McMahon
- License: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/)
- Source: https://github.com/sfzinstruments/virtuosity_drums

## Piano — VSCO 2 CE, "Upright Piano" (medium velocity layer)
- Sampled by Simon Dalzell of Ivy Audio; published by Versilian Studios LLC
- License: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/)
- Source: https://github.com/sgossner/VSCO-2-CE

Credit to the authors is encouraged (not required). Every file was downmixed
to mono 44.1 kHz WAV and trimmed by the build script.
`,
  );

  rmSync(TMP, { recursive: true, force: true });
  console.log(`\n✓ ${all.length} samples, ${(total / 1024).toFixed(1)} MB total → public/samples/`);
}

main();
