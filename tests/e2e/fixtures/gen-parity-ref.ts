// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// Regenerates tests/e2e/fixtures/jmove-parity-ref.json (the golden reference
// for the browser event-for-event parity test) with the PINNED
// @jmove/generator. Run after any adapter change:
//   PARITY_REF=tests/e2e/fixtures/jmove-parity-ref.json npx vite-node tests/e2e/fixtures/gen-parity-ref.ts

import { writeFileSync } from "node:fs";
import { flattenProgression, parseProgressionInput } from "../../../src/domain/progression.js";
import { createJmoveBandProvider } from "../../../src/adapters/jmove/generator.js";

const provider = createJmoveBandProvider();
const part = { bass: true, piano: true, drums: true, tempoBpm: 120 };
const zeros = {
  seed: 7, creativity: 0, conversation: 0, airGaps: 0, harmonicFreedom: 0,
  density: 50, swingAmount: 70, strumMs: 20, drumComplexity: 50, pianoComplexity: 50, bassComplexity: 50,
};
const defaults = {
  seed: 7, creativity: 30, conversation: 35, airGaps: 15, harmonicFreedom: 20,
  density: 50, swingAmount: 70, strumMs: 20, drumComplexity: 50, pianoComplexity: 50, bassComplexity: 50,
};

const charts = [
  { name: "bb-blues", input: "Bb7 | Eb7 | Bb7 | Bb7 | Eb7 | Eb7 | Bb7 | Bb7 | F7 | Eb7 | Bb7 | F7" },
  {
    name: "parity",
    input:
      "Dm7 | G7 | Cmaj7 | Cmaj7 | Dm7b5 | G7alt | Cm7 | Cm7 | Bb7#9 | Bb7b9 | Bb13 | Bbmaj7 | Bbm7 | Bbdim7 | Bb6 | Bb7/D",
  },
];

const out: Record<string, unknown> = {};
for (const c of charts) {
  const flat = flattenProgression(parseProgressionInput(c.input));
  for (const [label, opts] of [["zeros", zeros], ["defaults", defaults]] as const) {
    const events = await provider.generateBand(flat, "swing", part, 120, { ...opts });
    out[`${c.name}:${label}`] = { input: c.input, opts, events };
  }
}
const path = process.env.PARITY_REF ?? "tests/e2e/fixtures/jmove-parity-ref.json";
writeFileSync(path, JSON.stringify(out));
console.log(`wrote ${path}: ${Object.keys(out).join(", ")}`);
