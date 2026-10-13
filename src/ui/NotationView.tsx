import React from "react";
import { lickLab } from "./composition.js";

export function NotationView({ abc, title }: { abc: string; title: string }): React.JSX.Element {
  const [svg, setSvg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);
    lickLab
      .renderNotation(abc, { title })
      .then((s) => {
        if (!cancelled) setSvg(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [abc, title]);
  if (error)
    return (
      <p className="rounded-lg border border-danger-line bg-danger-bg px-3.5 py-2.5 text-danger" role="alert">
        Notation failed: {error}
      </p>
    );
  if (!svg) return <p className="py-5 italic text-dim" aria-label="notation loading">Engraving… (first view loads the notation engine)</p>;
  return <div className="rounded-xl bg-paper overflow-x-auto p-3 max-w-full [&_svg]:max-w-full [&_svg]:h-auto" aria-label="notation" dangerouslySetInnerHTML={{ __html: svg }} />;
}
