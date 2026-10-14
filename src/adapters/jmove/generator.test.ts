// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/jmove contract: translation is faithful (roots/qualities/timing),
// output is beat-grid sorted/clipped, parts gate voices, takes are
// deterministic per seed, unsupported styles throw (composition falls back).

import { describe, expect, it } from "vitest";
import {
  createJmoveBandProvider,
  deriveSeed,
  flatToChordEvents,
  gmToDrumRole,
  QUALITY_MAP,
  rootNameOf,
} from "./generator.js";
import { flattenProgression, parseProgressionInput } from "../../domain/progression.js";
import type { BandPart } from "../../domain/band.js";
import type { ChordQuality } from "../../domain/chords.js";

const flatOf = (input: string) => flattenProgression(parseProgressionInput(input));
const partAll: BandPart = { bass: true, piano: true, drums: true, tempoBpm: 120 };
const qualities: ChordQuality[] = ["maj7", "maj6", "min7", "min6", "minmaj7", "dom7", "dim7", "hdim7", "aug", "sus7", "power5"];

describe("jmove translation (pure, no audio)", () => {
  it("maps every local chord quality to a jmove quality string", () => {
    for (const q of qualities) expect(QUALITY_MAP[q]).toMatch(/^[a-z0-9#b()^+/]+$/i);
  });
  it("roots use pitch-class names (never exotic spellings)", () => {
    expect(rootNameOf("Ebm7")).toBe("Eb");
    expect(rootNameOf("F#m7b5")).toBe("Gb"); // pitch-class name, flats preferred
    expect(rootNameOf("Bb7")).toBe("Bb");
    expect(rootNameOf("Cmaj7")).toBe("C");
  });
  it("chord events carry seconds timing + mapped qualities", () => {
    const evts = flatToChordEvents(flatOf("Dm7 | G7 | Cmaj7 |"), 120);
    expect(evts).toHaveLength(3);
    expect(evts[0]).toMatchObject({ root: "D", quality: "m7", time: 0, duration: 2 });
    expect(evts[1]).toMatchObject({ root: "G", quality: "7", time: 2, duration: 2 });
    expect(evts[2]).toMatchObject({ root: "C", quality: "maj7", time: 4, duration: 2 });
  });
  it("GM vocabulary maps to roles; unknown notes are dropped (null)", () => {
    expect(gmToDrumRole(36)).toBe("kick");
    expect(gmToDrumRole(38)).toBe("snare");
    expect(gmToDrumRole(37)).toBe("snare");
    expect(gmToDrumRole(43)).toBe("snare");
    expect(gmToDrumRole(42)).toBe("hat");
    expect(gmToDrumRole(51)).toBe("ride");
    expect(gmToDrumRole(53)).toBe("ride-bell");
    expect(gmToDrumRole(49)).toBe("crash");
    expect(gmToDrumRole(52)).toBe("crash");
    expect(gmToDrumRole(0)).toBeNull();
    expect(gmToDrumRole(127)).toBeNull();
  });
  it("deriveSeed is stable per content and varies with it", () => {
    const flat = flatOf("Dm7 | G7 | Cmaj7 |");
    expect(deriveSeed(flat, "swing", 120)).toBe(deriveSeed(flat, "swing", 120));
    expect(deriveSeed(flat, "swing", 120)).not.toBe(deriveSeed(flat, "bossa", 120));
    expect(deriveSeed(flat, "swing", 120)).not.toBe(deriveSeed(flatOf("Dm7 | G7 |"), "swing", 120));
  });
});

describe("jmove provider (real library, pure compute)", () => {
  it("swing take: sorted, clipped to the chorus, roots on downbeats", async () => {
    const flat = flatOf("Dm7 | G7 | Cmaj7 |");
    const events = await createJmoveBandProvider().generateBand(flat, "swing", partAll, 120, { seed: 42 });
    expect(events.length).toBeGreaterThan(0);
    for (let i = 1; i < events.length; i++) expect(events[i]!.timeBeats).toBeGreaterThanOrEqual(events[i - 1]!.timeBeats);
    for (const e of events) {
      expect(e.timeBeats).toBeGreaterThanOrEqual(0);
      expect(e.timeBeats).toBeLessThan(12);
      expect(e.midi).toBeDefined();
    }
    const bassAt = (beat: number) => events.find((e) => e.voice === "bass" && Math.abs(e.timeBeats - beat) < 0.05);
    expect((bassAt(0)!.midi as number) % 12).toBe(2); // D
    expect((bassAt(4)!.midi as number) % 12).toBe(7); // G
    expect((bassAt(8)!.midi as number) % 12).toBe(0); // C
  });
  it("parts gate voices; all styles generate", async () => {
    const flat = flatOf("Dm7 G7 | Cmaj7 |");
    for (const style of ["swing", "ballad", "bossa"] as const) {
      const full = await createJmoveBandProvider().generateBand(flat, style, partAll, 140, { seed: 7 });
      expect(full.length).toBeGreaterThan(0);
      const drumsOnly = await createJmoveBandProvider().generateBand(
        flat,
        style,
        { bass: false, piano: false, drums: true, tempoBpm: 140 },
        140,
        { seed: 7 },
      );
      expect(drumsOnly.length).toBeGreaterThan(0);
      expect(drumsOnly.every((e) => e.voice === "drums")).toBe(true);
    }
  });
  it("same seed replays the identical take", async () => {
    const flat = flatOf("Dm7 | G7 | Cmaj7 |");
    const provider = createJmoveBandProvider();
    const a = await provider.generateBand(flat, "swing", partAll, 120, { seed: 99 });
    const b = await provider.generateBand(flat, "swing", partAll, 120, { seed: 99 });
    expect(a).toEqual(b);
  });
  it("unsupported styles throw (composition falls back to local)", async () => {
    await expect(createJmoveBandProvider().generateBand(flatOf("Cmaj7 |"), "straight", partAll, 120)).rejects.toThrow();
  });
});
