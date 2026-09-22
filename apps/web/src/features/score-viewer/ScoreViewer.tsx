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
        // OSMD's own `zoom` only scales the notation *within* each A4 page —
        // the page (the <svg> canvas) itself stays a fixed pixel size
        // regardless, so this alone can't make more of the score fit on
        // screen. Kept at a legible engraving size; the container's CSS
        // `zoom` below is what actually shrinks each page's on-screen
        // footprint.
        osmd.zoom = 0.7;
        // A fixed measures-per-system count (the previous "4 bars/line"
        // setting) forces OSMD to draw exactly that many bars per line no
        // matter how much content is in them — a bar-dense passage (chords,
        // fast rhythms, many simultaneous voices) can then need more
        // horizontal space than the fixed A4 page width actually has, and
        // OSMD draws it past the page edge instead of shrinking to fit
        // (reported: notation cut off at the page's right edge). Leaving
        // this unset lets OSMD's own fit-to-page logic pick how many bars
        // fit per line from the actual content width, same as it already
        // does for narrow pages.
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
        // inside this div — a fixed 2-column grid lays pages 1-2 side by
        // side, then wraps page 3 onward to the next row underneath (a book
        // spread, not an ever-widening single row). `max-content` columns
        // keep each column sized to the page's own (CSS-zoomed) width
        // instead of stretching pages to fill the row. CSS `zoom` (not
        // OSMD's own zoom option, which only scales the notation inside a
        // fixed-size page) shrinks each page's actual on-screen footprint,
        // so more pages are visible at once without scrolling.
        <div
          ref={containerRef}
          className="grid gap-4 justify-center"
          style={{ zoom: 0.5, gridTemplateColumns: "repeat(2, max-content)" }}
        />
      )}
    </div>
  );
}
