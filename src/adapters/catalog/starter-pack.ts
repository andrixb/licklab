// Copyright (C) 2026 LickLab contributors
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/catalog: static starter-pack catalog (public licks shipped as a
// static asset — free, anonymous, offline; the remote D1 catalog in M4
// implements the same port shape). Loading is injectable so the contract
// test can read the real JSON without a browser fetch.

import { parseLick } from "../../domain/lick.js";
import type { CatalogLick } from "../../domain/matching.js";
import type { PublicLickCatalog } from "../../application/ports.js";

interface StarterPackFile {
  readonly schemaVersion: number;
  readonly kind: string;
  readonly licks: unknown[];
}

export function createStarterPackCatalog(load: () => Promise<unknown>): PublicLickCatalog {
  return {
    async fetchPublicLicks(): Promise<CatalogLick[]> {
      const raw = (await load()) as StarterPackFile;
      if (raw.kind !== "licklab-starter-pack" || !Array.isArray(raw.licks)) {
        throw new Error("bad starter-pack file");
      }
      return raw.licks.map((l) => ({ lick: parseLick(l), likes: 0 }));
    },
  };
}
