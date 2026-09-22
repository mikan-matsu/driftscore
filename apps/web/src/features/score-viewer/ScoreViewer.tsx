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

interface OsmdPoint {
  x: number;
  y: number;
}

interface OsmdGraphicalNote {
  sourceNote: {
    Pitch?: { halfTone: number };
    getAbsoluteTimestamp(): { RealValue: number };
  };
  setColor(color: string, options: Record<string, never>): void;
}

/** Minimal surface of OSMD's own instance we need for click-to-note hit-testing (see project memory
 * `project_osmd_note_id_finding` — OSMD drops the MusicXML note `id` entirely, so resolving a click has
 * to go through OSMD's own coordinate-conversion + nearest-object APIs instead). Not part of OSMD's
 * public TS types (GraphicSheet's hit-testing methods exist but aren't re-exported at the top level). */
interface OsmdInstance {
  GraphicSheet: {
    domToSvg(point: OsmdPoint): OsmdPoint;
    svgToOsmd(point: OsmdPoint): OsmdPoint;
    GetNearestNote(clickPosition: OsmdPoint, maxClickDist: OsmdPoint): OsmdGraphicalNote | undefined;
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
  const osmdRef = useRef<OsmdInstance | null>(null);

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
          // OSMD ignores a MusicXML <print new-system="yes"/> / <print
          // new-page="yes"/> unless explicitly told to honor them — both
          // default to false. Without this, arrangementToMusicXml's computed
          // system/page breaks (8 bars/line, 4 for dense passages, explicit
          // page breaks so a long full-song-form arrangement actually spans
          // multiple A4 pages) are silently no-ops and OSMD falls back to
          // its own auto-fit, which doesn't reliably paginate at all.
          newSystemFromXML: true,
          newPageFromXML: true,
        });
        // OSMD's own `zoom` only scales the notation *within* each A4 page —
        // the page (the <svg> canvas) itself stays a fixed pixel size
        // regardless, so this alone can't make more of the score fit on
        // screen. Kept at a legible engraving size; the container's CSS
        // `zoom` below is what actually shrinks each page's on-screen
        // footprint.
        osmd.zoom = 0.7;
        // Measures-per-system is no longer a fixed OSMD setting here — a
        // fixed count (the old "4 bars/line") could overflow a dense bar
        // past the page's right edge, while leaving it fully automatic
        // broke OSMD's own page pagination outright. arrangementToMusicXml
        // now decides system/page breaks itself (8 bars/line by default, 4
        // for a dense passage) and writes them as explicit <print> marks,
        // honored via newSystemFromXML/newPageFromXML above.
        await osmd.load(musicXml);
        if (cancelled) return;
        osmd.render();
        setError(null);
        osmdRef.current = osmd as unknown as OsmdInstance;
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

  // Click-to-select proof of concept (see project memory
  // `project_osmd_note_id_finding`): OSMD never carries the MusicXML <note
  // id> into its internal model, so a click is resolved purely through
  // OSMD's own coordinate-conversion (domToSvg/svgToOsmd, page-relative —
  // handles our multi-page CSS grid layout automatically since each page is
  // its own backend) and GetNearestNote() APIs, not by DOM id lookup.
  function handleContainerClick(e: React.MouseEvent<HTMLDivElement>) {
    const osmd = osmdRef.current;
    if (!osmd) return;
    const svgPoint = osmd.GraphicSheet.domToSvg({ x: e.clientX, y: e.clientY });
    const osmdPoint = osmd.GraphicSheet.svgToOsmd(svgPoint);
    const note = osmd.GraphicSheet.GetNearestNote(osmdPoint, { x: 2, y: 2 });
    if (!note) return;
    note.setColor("#e11d48", {});
  }

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
          onClick={handleContainerClick}
          className="grid gap-4 justify-center"
          style={{ zoom: 0.5, gridTemplateColumns: "repeat(2, max-content)" }}
        />
      )}
    </div>
  );
}
