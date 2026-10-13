// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// ui/AttributionPage: CC-BY 3.0 attribution for Salamander Grand Piano samples.
// Route: /attribution

import React from "react";

export function AttributionPage(): React.JSX.Element {
  return (
    <section className="max-w-[1100px] mx-auto px-5 pb-12" aria-label="Sample attributions">
      <h1 className="font-serif text-3xl mb-6">Sample Attributions</h1>
      
      <section className="mb-8 p-[18px] rounded-xl border border-line bg-surface">
        <h2 className="font-serif text-xl mb-3">Salamander Grand Piano</h2>
        <p className="mb-2 text-cream">
          Samples from <strong>Salamander Grand Piano</strong> by <strong>Alexander Holm</strong>,
          released under <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
            Creative Commons Attribution 3.0 (CC BY 3.0)
          </a>.
        </p>
        <p className="mb-2 text-dim">
          Source: <a href="https://github.com/sgossner/VCSL" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
            https://github.com/sgossner/VCSL
          </a>
        </p>
        <p className="mb-2 text-dim">
          Sample pack: Salamander Grand Piano V3+ (subset used in LickLab).
        </p>
        <p className="text-dim">
          License: <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
            CC BY 3.0
          </a> — you are free to share and adapt, with attribution.
        </p>
      </section>

      <section className="mb-8 p-[18px] rounded-xl border border-line bg-surface">
        <h2 className="font-serif text-xl mb-3">VSCO 2 Community Edition (Contrabass)</h2>
        <p className="mb-2 text-cream">
          Contrabass samples from <strong>VSCO 2 Community Edition</strong> by Versilian Studios,
          released under <strong>CC0 (Public Domain)</strong>.
        </p>
        <p className="mb-2 text-dim">
          Source: <a href="https://github.com/sgossner/VSCO-2-CE" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
            https://github.com/sgossner/VSCO-2-CE
          </a>
        </p>
        <p className="text-dim">
          No attribution required (CC0 / Public Domain).
        </p>
      </section>

      <section className="p-[18px] rounded-xl border border-line bg-surface">
        <h2 className="font-serif text-xl mb-3">Virtuosity Drums</h2>
        <p className="mb-2 text-cream">
          Drum samples from <strong>Virtuosity Drums</strong> by Versilian Studios & Karoryfer Samples,
          released under <strong>CC0 (Public Domain)</strong>.
        </p>
        <p className="mb-2 text-dim">
          Source: <a href="https://github.com/sfzinstruments/virtuosity_drums" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
            https://github.com/sfzinstruments/virtuosity_drums
          </a>
        </p>
        <p className="text-dim">
          No attribution required (CC0 / Public Domain).
        </p>
      </section>

      <footer className="mt-12 pt-4 border-t border-line text-dim text-sm">
        <p>
          All sample packs are loaded lazily on first playback. Samples are cached by the service
          worker for offline use.
        </p>
      </footer>
    </section>
  );
}