"use client";

import { useEffect, useRef } from "react";
import type { ScoreCursor } from "@/features/score-viewer";

/**
 * Drives the OSMD cursor forward in lockstep with Tone.Transport while
 * playing, using the transport's own clock (not wall-clock time) so the
 * blue line stays sample-accurate with the audio even under scheduling
 * jitter. OSMD cursor timestamps are in whole notes; our beat unit is a
 * quarter note, so 4 beats = 1 whole note regardless of time signature.
 *
 * The cursor moves at one constant speed per staff line (like Finale's
 * playback cursor), not note-by-note — individual note spacing on the page
 * isn't perfectly proportional to duration, so glide speed pinned to each
 * note's own duration would visibly speed up and slow down. Instead we
 * silently walk the whole score once before playback to record where each
 * line starts/ends (in both time and x position), then during playback
 * compute the cursor's x every frame as a straight linear interpolation
 * across the current line — one constant velocity per line, with a snap at
 * line breaks.
 */

function getCursorElement(cursor: ScoreCursor): HTMLImageElement | undefined {
  return (cursor as unknown as { cursorElement?: HTMLImageElement }).cursorElement;
}

/**
 * Tailwind's preflight sets `img { height: auto }`, which makes browsers
 * recompute the cursor image's rendered height from its *decoded pixel*
 * aspect ratio (the OSMD cursor bitmap is a 1px-tall stub) instead of from
 * its `width`/`height` HTML attributes (the actual intended size). That
 * collapses the cursor to ~1px tall. Re-pin the rendered size to the
 * attribute values every time OSMD repositions the cursor.
 */
function pinCursorElementSize(el: HTMLImageElement) {
  const attrWidth = el.getAttribute("width");
  const attrHeight = el.getAttribute("height");
  if (attrWidth) el.style.width = `${attrWidth}px`;
  if (attrHeight) el.style.height = `${attrHeight}px`;
}

interface CursorPoint {
  t: number;
  x: number;
  y: number;
}

interface Line {
  tStart: number;
  tEnd: number;
  /** Every distinct note-event position recorded within this line (not just its
   * start/end) — see buildLines()'s comment for why interpolating between just
   * two line-wide endpoints was replaced with piecewise interpolation across
   * these. */
  points: CursorPoint[];
  top: number;
  /** id of the page container (e.g. "osmdCanvasPage2") the cursor element must be a child of for these points' x/y to mean anything — OSMD reparents the cursor <img> to each page's own container as it crosses page boundaries (paged/A4 mode renders one <svg> + container per page), and offsetLeft/offsetTop are relative to that container. Manually setting style.left/top during our own interpolation must reparent the element to match, or the coordinates are read against the wrong page and the cursor renders in the wrong place. */
  containerId: string | null;
}

// OSMD's iterator reports a huge sentinel value (observed: 99999) from
// currentTimeStamp.RealValue for the final point recorded right as
// EndReached becomes true — there's no real "current timestamp" once
// iteration is past the last note, so OSMD returns a fixed placeholder
// instead of the actual end-of-piece time. Left untreated, this stretches
// the LAST line-segment's tEnd out to ~99999 whole notes, which — for a
// short "theme"-only arrangement that fits entirely on one line/system —
// means the ENTIRE piece becomes that one distorted segment, and the
// cursor crawls at a small fraction of its real speed (elapsed time /
// 99999 is ~0 for the first many real seconds of playback). A longer,
// multi-line "full" song-form arrangement mostly hid this: every segment
// except the very last one used real timestamps, so only the final line's
// glide sped up implausibly fast right at the end — a small enough
// glitch to go unnoticed next to a short piece going almost fully frozen.
const SENTINEL_TIMESTAMP_JUMP = 1000; // real pieces are nowhere near 1000 whole notes long

/**
 * Silently walks the whole score once to record each line's constituent
 * note-event points (time/x/y and which page container each belongs to),
 * then resets the cursor to the start.
 *
 * Earlier versions collapsed each line down to just its first/last point and
 * interpolated x linearly between those two — one constant velocity for the
 * entire line. That's a coarser approximation than it looks: real engraving
 * spaces notes by duration but not strictly proportionally (a half note
 * takes noticeably less than 4x an eighth note's width, extra room gets
 * added around accidentals/chord symbols, etc.), so a line's actual notehead
 * positions are NOT evenly spaced in time the way constant-velocity
 * interpolation assumes. In practice this meant the cursor would visibly
 * race ahead during long notes (which occupy more x than their time-share
 * of the line) and fall behind during a cluster of short notes (which are
 * engraved more compactly than their time-share) — exactly the "the blue
 * line doesn't line up with what's actually playing" symptom. Keeping every
 * point (not just the line's first/last) and interpolating piecewise
 * between consecutive points fixes this while keeping the same smooth,
 * continuous glide (each individual inter-note segment is still a simple
 * linear interpolation, just over a much shorter, evenly-proportional span).
 */
function buildLines(cursor: ScoreCursor): Line[] {
  const el = getCursorElement(cursor);
  if (!el) return [];

  cursor.reset();
  const points: { t: number; x: number; y: number; containerId: string | null }[] = [];
  let prevT = 0;
  while (true) {
    const rawT = cursor.iterator.currentTimeStamp.RealValue;
    // A sentinel jump keeps this point's real x/y (the cursor still needs to
    // visually reach the final position) but pins its time to just after the
    // previous real point, so it doesn't stretch the segment's duration.
    const t = rawT - prevT > SENTINEL_TIMESTAMP_JUMP ? prevT : rawT;
    points.push({
      t,
      x: el.offsetLeft,
      y: el.offsetTop,
      containerId: el.parentElement?.id ?? null,
    });
    prevT = t;
    if (cursor.iterator.EndReached) break;
    cursor.next();
  }
  cursor.reset();

  const lines: Line[] = [];
  let runStart = 0;
  for (let i = 1; i <= points.length; i++) {
    const brokeLine =
      i === points.length ||
      points[i].y !== points[runStart].y ||
      points[i].containerId !== points[runStart].containerId;
    if (brokeLine) {
      const runPoints = points.slice(runStart, i);
      const first = runPoints[0];
      const last = runPoints[runPoints.length - 1];
      lines.push({
        tStart: first.t,
        tEnd: last.t,
        points: runPoints.map((p) => ({ t: p.t, x: p.x, y: p.y })),
        top: first.y,
        containerId: first.containerId,
      });
      runStart = i;
    }
  }
  return lines;
}

export function useCursorSync(cursor: ScoreCursor | null, isPlaying: boolean, bpm: number) {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!cursor || !isPlaying) return;
    const maybeEl = getCursorElement(cursor);
    if (!maybeEl) return;
    const el: HTMLImageElement = maybeEl;

    let cancelled = false;
    // Must show() before measuring: a hidden cursor image reports 0 for
    // offsetLeft/offsetTop, which would make every recorded position 0.
    // buildLineSegments() ends with cursor.reset(), which restores position
    // 0 before playback actually starts, so this doesn't cause a visible jump.
    cursor.show();
    pinCursorElementSize(el);
    const lines = buildLines(cursor);
    el.style.transition = "none";

    let lineIndex = 0;
    // Index into lines[lineIndex].points — tracked separately from lineIndex
    // and reset to 0 whenever the line changes, so each frame's search for
    // the bracketing pair of points starts from roughly the right place
    // instead of scanning the whole line from the start every time.
    let pointIndex = 0;

    async function loop() {
      if (cancelled) return;
      const Tone = await import("tone");
      if (cancelled) return;

      const tick = () => {
        if (cancelled) return;
        const elapsedBeats = Tone.getTransport().seconds * (bpm / 60);
        const elapsedWholeNotes = elapsedBeats / 4;

        while (lineIndex < lines.length - 1 && elapsedWholeNotes >= lines[lineIndex].tEnd) {
          lineIndex += 1;
          pointIndex = 0;
        }
        const line = lines[lineIndex];
        if (line) {
          // Reparent to the line's own page container before positioning —
          // see the Line.containerId comment above. Skipped when already
          // correct (the common case, since most consecutive lines share a
          // page) to avoid needless DOM churn every frame.
          if (line.containerId && el.parentElement?.id !== line.containerId) {
            const target = document.getElementById(line.containerId);
            if (target) target.appendChild(el);
          }
          const points = line.points;
          while (pointIndex < points.length - 2 && elapsedWholeNotes >= points[pointIndex + 1].t) {
            pointIndex += 1;
          }
          const p0 = points[pointIndex];
          const p1 = points[Math.min(pointIndex + 1, points.length - 1)];
          const span = p1.t - p0.t;
          const fraction = span > 0 ? Math.min(1, Math.max(0, (elapsedWholeNotes - p0.t) / span)) : 1;
          const x = p0.x + (p1.x - p0.x) * fraction;
          el.style.left = `${x}px`;
          el.style.top = `${line.top}px`;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    loop();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      cursor.hide();
    };
  }, [cursor, isPlaying, bpm]);
}
