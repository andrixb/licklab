// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// adapters/notation: Verovio WASM renderer (single-threaded build, no
// SharedArrayBuffer/COOP/COEP so the YouTube embed keeps working).
// The ~7MB module loads lazily on first render and stays out of the
// initial JS payload (see budget check + ADR-007).

import type { NotationOptions, NotationRenderer } from "../../application/ports.js";

interface Toolkit {
  setOptions(opts: Record<string, unknown>): void;
  loadData(data: string): boolean;
  renderToSVG(page: number): string;
}

type VerovioEsm = typeof import("verovio/esm");
type VerovioWasm = typeof import("verovio/wasm");

let toolkitPromise: Promise<Toolkit> | null = null;

async function loadToolkit(): Promise<Toolkit> {
  if (!toolkitPromise) {
    toolkitPromise = (async () => {
      const [{ VerovioToolkit }, { default: createModule }] = (await Promise.all([
        import("verovio/esm") as Promise<VerovioEsm>,
        import("verovio/wasm") as Promise<VerovioWasm>,
      ])) as [VerovioEsm, VerovioWasm];
      const mod = await (createModule as () => Promise<unknown>)();
      return new VerovioToolkit(mod) as Toolkit;
    })();
  }
  return toolkitPromise;
}

/** For tests: drop the cached toolkit. */
export function __resetVerovioForTests(): void {
  toolkitPromise = null;
}

export class VerovioRenderer implements NotationRenderer {
  async renderAbcToSvg(abc: string, opts: NotationOptions = {}): Promise<string> {
    const tk = await loadToolkit();
    tk.setOptions({
      scale: opts.scale ?? 40,
      adjustPageHeight: true,
      pageWidth: 1200,
      footer: "none",
      header: "none",
    });
    if (!tk.loadData(abc)) throw new Error("notation failed to load ABC input");
    const svg = tk.renderToSVG(1);
    if (!svg.includes("<svg")) throw new Error("notation rendered no SVG");
    return svg;
  }
}
