"use client";

import { useEffect, useRef, useState } from "react";

/** Minimal surface of OSMD's cursor we need to drive playback sync, kept local so callers don't need the full OSMD type. */
export interface ScoreCursor {
  show(): void;
  hide(): void;
  reset(): void;
  next(): void;
  iterator: {
    EndReached: boolean;
    currentTimeStamp: { RealValue: number };
  };
}

export function ScoreViewer({
  musicXml,
  title,
  onCursorReady,
}: {
  musicXml: string;
  title?: string;
  onCursorReady?: (cursor: ScoreCursor | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!containerRef.current) return;
      try {
        const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = "";
        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          backend: "svg",
          drawTitle: Boolean(title),
          cursorsOptions: [{ type: 1, color: "#60a5fa", alpha: 1, follow: true }],
          // Real A4 pages with page breaks (not one endless horizontal
          // strip) — "フル版" score look, pages laid out in a single
          // horizontally-scrolling row (see the container below), like
          // spreading printed pages out side by side on a desk.
          pageFormat: "A4_P",
          pageBackgroundColor: "#FFFFFF",
        });
        // Smaller notation so more of a page (and more pages at once) fits
        // on screen without scrolling — full ensemble scores read fine
        // small since the user mainly scans it, doesn't need engraving-size notation.
        osmd.zoom = 0.6;
        // Cap measures per system so a line never grows wide enough to
        // become hard to scan — 4 bars/line is the readable default for a
        // full ensemble score; OSMD's own fit-to-page logic can still use
        // fewer per line when a page is narrow.
        osmd.EngravingRules.RenderXMeasuresPerLineAkaSystem = 4;
        await osmd.load(musicXml);
        if (cancelled) return;
        osmd.render();
        setError(null);
        onCursorReady?.(osmd.cursor as ScoreCursor);
      } catch (e) {
        if (cancelled) return;
        console.error("ScoreViewer: failed to render score", e, musicXml);
        setError("楽譜の表示に失敗しました。もう一度生成し直してください。");
        onCursorReady?.(null);
      }
    }

    render();

    return () => {
      cancelled = true;
      onCursorReady?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicXml, title]);

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      {error ? (
        <p className="p-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : (
        // OSMD (in paged mode) renders one <svg> per A4 page as a sibling
        // inside this div — a single non-wrapping flex row lays every page
        // out side by side left-to-right, scrolled horizontally via the
        // outer div's overflow-x-auto, like flipping through a real score.
        <div ref={containerRef} className="flex flex-row flex-nowrap gap-4" />
      )}
    </div>
  );
}
