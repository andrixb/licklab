// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// domain/matching: rank community licks against an analyzed progression
// segment. Tiers (best first): 1 exact context, 2 same function, 3 chord
// quality (single-chord licks). Within a tier: likes desc, then recency desc.
// Licks never overflow a segment (chord-count bound). Pure — the catalog
// (likes) is supplied by the caller; nothing is computed about absolute keys.

import { contextKeyOf } from "./signatures.js";
import type { Lick, LickChord } from "./lick.js";
import type { Segment } from "./progression.js";

export type MatchTier = 1 | 2 | 3;

export interface CatalogLick {
  readonly lick: Lick;
  readonly likes: number;
}

export interface RankedMatch {
  readonly lick: Lick;
  readonly likes: number;
  readonly tier: MatchTier;
}

/** Does the lick's chord context appear as a contiguous window inside the segment? */
export function contextFits(lickChords: readonly LickChord[], segmentChords: readonly LickChord[]): boolean {
  const n = lickChords.length;
  if (n === 0 || n > segmentChords.length) return false;
  const key = contextKeyOf(lickChords);
  for (let i = 0; i + n <= segmentChords.length; i++) {
    if (contextKeyOf(segmentChords.slice(i, i + n)) === key) return true;
  }
  return false;
}

/** The tier a single lick earns on a segment, or null if it does not fit. */
export function tierFor(lick: Lick, segment: Segment): MatchTier | null {
  const lickChords = lick.harmonicContext.chords;
  // Tier 1: exact context (the lick's whole progression occurs in the segment).
  if (contextFits(lickChords, segment.chords)) return 1;
  // Tier 2: same harmonic function, lick no longer than the segment.
  if (lick.functionKey === segment.functionKey && lickChords.length <= segment.chords.length) return 2;
  // Tier 3: single-chord lick whose quality is present in the segment.
  if (lick.chordQuality != null) {
    const segQualities = segment.signature.map((s) => s.quality);
    if (segQualities.includes(lick.chordQuality)) return 3;
  }
  return null;
}

/**
 * Rank matches for one segment. Ties on (tier, likes) break by recency using
 * the lick's updatedAt (then createdAt) so the order is total and stable.
 */
export function rankSegment(segment: Segment, catalog: readonly CatalogLick[]): RankedMatch[] {
  const out: RankedMatch[] = [];
  for (const { lick, likes } of catalog) {
    if (lick.deletedAt != null) continue;
    const tier = tierFor(lick, segment);
    if (tier !== null) out.push({ lick, likes, tier });
  }
  out.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (b.likes !== a.likes) return b.likes - a.likes;
    const rec = b.lick.updatedAt.localeCompare(a.lick.updatedAt);
    if (rec !== 0) return rec;
    return b.lick.createdAt.localeCompare(a.lick.createdAt);
  });
  return out;
}

/** All segments' matches, keyed by segment index. */
export function rankProgression(segments: readonly Segment[], catalog: readonly CatalogLick[]): RankedMatch[][] {
  return segments.map((seg) => rankSegment(seg, catalog));
}
