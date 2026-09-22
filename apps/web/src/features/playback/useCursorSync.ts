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

interface LineSegment {
  tStart: number;
  tEnd: number;
  xStart: number;
  xEnd: number;
  top: number;
  /** id of the page container (e.g. "osmdCanvasPage2") the cursor element must be a child of for xStart/xEnd/top to mean anything — OSMD reparents the cursor <img> to each page's own container as it crosses page boundaries (paged/A4 mode renders one <svg> + container per page), and offsetLeft/offsetTop are relative to that container. Manually setting style.left/top during our own interpolation must reparent the element to match, or the coordinates are read against the wrong page and the cursor renders in the wrong place. */
  containerId: string | null;
}

/** Silently walks the whole score once to record each line's time/x span (and which page container it belongs to), then resets the cursor to the start. */
function buildLineSegments(cursor: ScoreCursor): LineSegment[] {
  const el = getCursorElement(cursor);
  if (!el) return [];

  cursor.reset();
  const points: { t: number; x: number; y: number; containerId: string | null }[] = [];
  while (true) {
    points.push({
      t: cursor.iterator.currentTimeStamp.RealValue,
      x: el.offsetLeft,
      y: el.offsetTop,
      containerId: el.parentElement?.id ?? null,
    });
    if (cursor.iterator.EndReached) break;
    cursor.next();
  }
  cursor.reset();

  const segments: LineSegment[] = [];
  let runStart = 0;
  for (let i = 1; i <= points.length; i++) {
    const brokeLine =
      i === points.length ||
      points[i].y !== points[runStart].y ||
      points[i].containerId !== points[runStart].containerId;
    if (brokeLine) {
      const first = points[runStart];
      const last = points[i - 1];
      segments.push({ tStart: first.t, tEnd: last.t, xStart: first.x, xEnd: last.x, top: first.y, containerId: first.containerId });
      runStart = i;
    }
  }
  return segments;
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
    const segments = buildLineSegments(cursor);
    el.style.transition = "none";

    let segmentIndex = 0;

    async function loop() {
      if (cancelled) return;
      const Tone = await import("tone");
      if (cancelled) return;

      const tick = () => {
        if (cancelled) return;
        const elapsedBeats = Tone.getTransport().seconds * (bpm / 60);
        const elapsedWholeNotes = elapsedBeats / 4;

        while (segmentIndex < segments.length - 1 && elapsedWholeNotes >= segments[segmentIndex].tEnd) {
          segmentIndex += 1;
        }
        const seg = segments[segmentIndex];
        if (seg) {
          // Reparent to the segment's own page container before positioning
          // — see the LineSegment.containerId comment above. Skipped when
          // already correct (the common case, since most consecutive
          // segments share a page) to avoid needless DOM churn every frame.
          if (seg.containerId && el.parentElement?.id !== seg.containerId) {
            const target = document.getElementById(seg.containerId);
            if (target) target.appendChild(el);
          }
          const span = seg.tEnd - seg.tStart;
          const fraction = span > 0 ? Math.min(1, Math.max(0, (elapsedWholeNotes - seg.tStart) / span)) : 1;
          const x = seg.xStart + (seg.xEnd - seg.xStart) * fraction;
          el.style.left = `${x}px`;
          el.style.top = `${seg.top}px`;
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
