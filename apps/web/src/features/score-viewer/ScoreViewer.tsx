"use client";

import { useEffect, useRef, useState } from "react";
import type { Note } from "@/features/piano-roll";
import type { Arrangement } from "./arrangementTypes";

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
  // Chain used to trace a clicked GraphicalNote back to which of our own
  // ArrangementParts it belongs to — see resolveClickedNote() below.
  parentVoiceEntry: {
    parentStaffEntry: {
      parentMeasure: {
        ParentStaff: {
          ParentInstrument: { IdString: string };
        };
      };
    };
  };
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

/**
 * Traces a clicked GraphicalNote back to the underlying (partId, Note) it
 * came from. OSMD's parsed model has no reference to the MusicXML note `id`
 * (see project memory `project_osmd_note_id_finding`), so this instead
 * addresses by (part, pitch, absolute beat) — the instrument's MusicXML
 * part-id (`ParentInstrument.IdString`, which arrangementToMusicXml.ts sets
 * to our own ArrangementPart.id) plus a pitch+timestamp match within that
 * part's Melody, which is self-verifying (a mismatch means "not found"
 * rather than silently resolving the wrong note).
 *
 * OSMD's `Pitch.halfTone` is a full octave (12 semitones) below the
 * equivalent MIDI note number (OSMD's octave 0 = MIDI octave -1) — confirmed
 * empirically in-browser: the tonic note of a C-major melody resolved to
 * halfTone 48, i.e. MIDI 60 (C4) minus 12.
 */
function resolveClickedNote(graphicalNote: OsmdGraphicalNote, arrangement: Arrangement): { partId: string; note: Note } | null {
  const halfTone = graphicalNote.sourceNote.Pitch?.halfTone;
  if (halfTone === undefined) return null; // unpitched (percussion) — not resolvable this way yet
  const midiPitch = halfTone + 12;
  // getAbsoluteTimestamp() is a whole-note fraction (1.0 = one whole note)
  // regardless of time signature — *4 converts to quarter-note beats, which
  // is the unit our own Note.start/duration are always in.
  const beats = graphicalNote.sourceNote.getAbsoluteTimestamp().RealValue * 4;
  const partId = graphicalNote.parentVoiceEntry.parentStaffEntry.parentMeasure.ParentStaff.ParentInstrument.IdString;
  const part = arrangement.parts.find((p) => p.id === partId);
  if (!part) return null;
  const note = part.melody.notes.find((n) => Math.abs(n.pitch - midiPitch) < 0.5 && Math.abs(n.start - beats) < 0.01);
  return note ? { partId, note } : null;
}

const PITCH_CLASS_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** MIDI pitch number to a display name like "C#4", for the drag-preview label. */
function pitchName(midiPitch: number): string {
  const pitchClass = PITCH_CLASS_NAMES[((midiPitch % 12) + 12) % 12];
  const octave = Math.floor(midiPitch / 12) - 1;
  return `${pitchClass}${octave}`;
}

/** Pixels of vertical mouse movement per semitone of pitch change while dragging a note.
 * Tuned by feel against the current rendering scale (OSMD zoom 0.7 * container CSS zoom 0.5) —
 * not derived from OSMD's own unit system, since a chromatic semitone isn't a fixed number of
 * staff units (that depends on the note's diatonic position/accidentals). Re-tune if either zoom changes. */
const PX_PER_SEMITONE = 6;

interface DragState {
  partId: string;
  note: Note;
  startClientY: number;
  currentPitch: number;
}

export function ScoreViewer({
  musicXml,
  title,
  arrangement,
  onCursorReady,
  onNoteClick,
  onNoteEdit,
}: {
  musicXml: string;
  title?: string;
  /** When given, enables click-to-select and drag-to-edit-pitch: resolved via resolveClickedNote(). */
  arrangement?: Arrangement;
  onNoteClick?: (partId: string, note: Note) => void;
  /** Called once, on mouse-up, if a drag actually changed the note's pitch. */
  onNoteEdit?: (partId: string, note: Note, newPitch: number) => void;
  onCursorReady?: (cursor: ScoreCursor | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const osmdRef = useRef<OsmdInstance | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<{ partId: string; pitch: number } | null>(null);

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

  // Click resolution shared by both plain click-to-select and the start of a
  // drag (see project memory `project_osmd_note_id_finding`): OSMD never
  // carries the MusicXML <note id> into its internal model, so a click is
  // resolved through OSMD's own coordinate-conversion (domToSvg/svgToOsmd,
  // page-relative — handles our multi-page CSS grid layout automatically
  // since each page is its own backend) and GetNearestNote(), then traced
  // back to our own Note via resolveClickedNote() (pitch+timestamp match,
  // not a DOM id).
  function resolveAtClientPoint(clientX: number, clientY: number): { graphicalNote: OsmdGraphicalNote; partId: string; note: Note } | null {
    const osmd = osmdRef.current;
    if (!osmd || !arrangement) return null;
    const svgPoint = osmd.GraphicSheet.domToSvg({ x: clientX, y: clientY });
    const osmdPoint = osmd.GraphicSheet.svgToOsmd(svgPoint);
    const graphicalNote = osmd.GraphicSheet.GetNearestNote(osmdPoint, { x: 2, y: 2 });
    if (!graphicalNote) return null;
    const resolved = resolveClickedNote(graphicalNote, arrangement);
    return resolved ? { graphicalNote, ...resolved } : null;
  }

  function handlePointerDown(e: React.MouseEvent<HTMLDivElement>) {
    const resolved = resolveAtClientPoint(e.clientX, e.clientY);
    if (!resolved) return;
    resolved.graphicalNote.setColor("#e11d48", {});
    onNoteClick?.(resolved.partId, resolved.note);
    // Percussion notes never reach here — resolveClickedNote() already
    // returns null for them (no OSMD Pitch to compute a MIDI pitch from),
    // so click-to-select works for percussion but dragging never starts.
    dragRef.current = {
      partId: resolved.partId,
      note: resolved.note,
      startClientY: e.clientY,
      currentPitch: resolved.note.pitch,
    };
    setDragPreview({ partId: resolved.partId, pitch: resolved.note.pitch });
  }

  function handlePointerMove(e: React.MouseEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    // Screen y grows downward; moving the mouse up should raise the pitch.
    const semitoneDelta = Math.round((drag.startClientY - e.clientY) / PX_PER_SEMITONE);
    const newPitch = drag.note.pitch + semitoneDelta;
    if (newPitch === drag.currentPitch) return;
    drag.currentPitch = newPitch;
    setDragPreview({ partId: drag.partId, pitch: newPitch });
  }

  function handlePointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragPreview(null);
    if (!drag) return;
    if (drag.currentPitch !== drag.note.pitch) {
      onNoteEdit?.(drag.partId, drag.note, drag.currentPitch);
    }
  }

  // Drag can end (mouseup) or continue (mousemove) after the cursor has left
  // the score container — e.g. a fast upward drag off the top edge — so
  // these listen on the whole window rather than just the container div,
  // which would otherwise silently drop the rest of the drag.
  useEffect(() => {
    function onMove(e: MouseEvent) {
      handlePointerMove(e as unknown as React.MouseEvent<HTMLDivElement>);
    }
    function onUp() {
      handlePointerUp();
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  });

  const dragPreviewPart = dragPreview && arrangement?.parts.find((p) => p.id === dragPreview.partId);

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      {error ? (
        <p className="p-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <>
          {dragPreviewPart && (
            <p className="mb-2 text-xs font-medium text-rose-600 dark:text-rose-400">
              {dragPreviewPart.name}: {pitchName(dragPreview.pitch)} にドラッグ中(離して確定)
            </p>
          )}
          {/* OSMD (in paged mode) renders one <svg> per A4 page as a sibling
              inside this div — a fixed 2-column grid lays pages 1-2 side by
              side, then wraps page 3 onward to the next row underneath (a book
              spread, not an ever-widening single row). `max-content` columns
              keep each column sized to the page's own (CSS-zoomed) width
              instead of stretching pages to fill the row. CSS `zoom` (not
              OSMD's own zoom option, which only scales the notation inside a
              fixed-size page) shrinks each page's actual on-screen footprint,
              so more pages are visible at once without scrolling. */}
          <div
            ref={containerRef}
            onMouseDown={handlePointerDown}
            className="grid gap-4 justify-center"
            style={{ zoom: 0.5, gridTemplateColumns: "repeat(2, max-content)" }}
          />
        </>
      )}
    </div>
  );
}
