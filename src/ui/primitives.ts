// ui/primitives: shared Tailwind class sets. The single place component-level
// styling is reused; keep tokens in theme.css (@theme).
// NOTE: each variant carries its OWN colors exactly once (base has none) —
// stacking conflicting utilities (bg-surface + bg-gold) is order-dependent in
// v4 and silently wins for the wrong class.

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl border min-h-11 px-4 py-2.5 font-medium " +
  "transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 " +
  "disabled:opacity-50 disabled:cursor-wait";

export const btn = `${btnBase} border-line bg-surface-2 text-cream hover:bg-surface-3`;
export const btnPrimary = `${btnBase} border-gold bg-gold text-ink font-semibold hover:bg-gold-hi`;
export const btnGhost = `${btnBase} border-transparent bg-transparent text-dim hover:text-cream hover:bg-surface`;
export const btnDanger = `${btnBase} border-danger-line bg-transparent text-danger hover:bg-danger-bg`;
export const btnLink =
  "border-none bg-transparent min-h-0 min-w-0 p-0 font-[inherit] text-[inherit] cursor-pointer hover:text-gold " +
  "focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2";

export const input =
  "w-full min-h-11 rounded-lg border border-line bg-surface text-cream px-3 py-2 " +
  "focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-1";
export const textarea = `${input} min-h-[130px] font-mono text-sm resize-y`;
export const label = "block text-dim text-sm";

export const card = "rounded-xl border border-line bg-surface";
export const tag = "inline-block rounded-full border border-line bg-surface-2 text-dim text-xs px-2.5 py-0.5 mr-1 my-0.5";
export const errorText = "rounded-lg border border-danger-line bg-danger-bg text-danger px-3.5 py-2.5 m-0";

export const dialog =
  "open:flex flex-col gap-2 w-[min(440px,calc(100vw-32px))] rounded-xl border border-line bg-surface " +
  "p-[22px] shadow-[0_24px_60px_rgb(0_0_0/0.8)] mx-auto my-auto";
export const dialogTitle = "font-serif text-xl text-cream m-0";
export const dialogBody = "text-dim m-0";
export const dialogActions = "flex justify-end gap-2.5 mt-4";
