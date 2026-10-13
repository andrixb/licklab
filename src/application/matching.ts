// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// application/matching: FindLicksForProgression use case. All analysis,
// tiering and ranking run in the domain, client-side; this wires segments
// to catalog candidates (whatever repository supplied them).

import type { RankedMatch, CatalogLick } from "../domain/matching.js";
import { rankSegment } from "../domain/matching.js";
import { analyzeProgression, type Progression, type Segment } from "../domain/progression.js";

export interface SegmentMatches {
  readonly segment: Segment;
  readonly matches: RankedMatch[];
}

export function findLicksForProgression(progression: Progression, catalog: readonly CatalogLick[]): SegmentMatches[] {
  return analyzeProgression(progression).map((segment) => ({ segment, matches: rankSegment(segment, catalog) }));
}
