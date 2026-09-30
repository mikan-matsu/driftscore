import type { Melody, Note } from "@/features/piano-roll";
import { buildKeySpellingTable, estimateKey, fifthsForKey } from "./keySpelling";
// 12 (not 4) so a triplet eighth note (1/3 beat) is also an exact integer
// division (12/3 = 4) alongside the plain binary durations below (quarter=12,
// eighth=6, 16th=3, whole=48) — needed for TRIPLET_EIGHTH_BEATS support.
const DIVISIONS = 12;

const DURATION_TYPES: [beats: number, type: string][] = [
  [0.25, "16th"],
  [0.5, "eighth"],
  [1, "quarter"],
  [2, "half"],
  [4, "whole"],
];

// A triplet eighth note: 3 of these fill exactly 1 beat (2 plain eighths'
// worth), the standard "3連符" shape. JS can't represent 1/3 exactly, but
// since every triplet note is always created via this same expression (both
// here and in randomMelody.ts), comparing against it directly (rather than a
// hand-typed decimal literal) avoids any mismatch from independently-rounded
// approximations.
const TRIPLET_EIGHTH_BEATS = 1 / 3;
const TRIPLET_EPSILON = 1e-6;

function isTripletEighth(beats: number): boolean {
  return Math.abs(beats - TRIPLET_EIGHTH_BEATS) < TRIPLET_EPSILON;
}

interface TupletInfo {
  position: "start" | "middle" | "stop";
}

/**
 * Scans chronologically-sorted notes for runs of triplet-eighth notes with no
 * gap between them, and assigns each one's position within its group of 3 (a
 * lone/partial run — which our own generator never produces, always emitting
 * complete groups of 3 — still gets a best-effort start/stop so the XML is
 * never left with a dangling <tuplet> start and no matching stop).
 */
function computeTupletPositions(sorted: Note[]): (TupletInfo | undefined)[] {
  const positions: (TupletInfo | undefined)[] = new Array(sorted.length).fill(undefined);
  let i = 0;
  while (i < sorted.length) {
    if (!isTripletEighth(sorted[i].duration)) {
      i += 1;
      continue;
    }
    let j = i;
    while (
      j + 1 < sorted.length &&
      isTripletEighth(sorted[j + 1].duration) &&
      Math.abs(sorted[j].start + sorted[j].duration - sorted[j + 1].start) < TRIPLET_EPSILON
    ) {
      j += 1;
    }
    for (let k = i; k <= j; k++) {
      const withinGroup = (k - i) % 3;
      if (withinGroup === 0) positions[k] = { position: "start" };
      else if (withinGroup === 2 || k === j) positions[k] = { position: "stop" };
      else positions[k] = { position: "middle" };
    }
    i = j + 1;
  }
  return positions;
}

function pitchToStepOctaveAlter(pitch: number, spelling: Record<number, { step: string; alter: number }>) {
  const pc = ((pitch % 12) + 12) % 12;
  const { step, alter } = spelling[pc];
  const octave = Math.floor(pitch / 12) - 1;
  return { step, alter, octave };
}

/**
 * Derives a note's written type (and whether it needs a dot) from its beat
 * duration — checking both a duration table entry directly AND that entry's
 * dotted (x1.5) variant, since e.g. 0.75 beats (a dotted eighth) is a
 * perfectly ordinary rhythm (ragtime syncopation, a shuffle figure) that a
 * plain lookup table would otherwise fall through to a wrong "quarter"
 * default for. A triplet eighth (1/3 beat, see isTripletEighth) is checked
 * first since it wouldn't match any of these binary-duration entries at all.
 */
function noteTypeAndDots(beats: number): { type: string; dotted: boolean } {
  if (isTripletEighth(beats)) return { type: "eighth", dotted: false };
  for (const [base, type] of DURATION_TYPES) {
    if (Math.abs(beats - base) < 1e-6) return { type, dotted: false };
    if (Math.abs(beats - base * 1.5) < 1e-6) return { type, dotted: true };
  }
  return { type: "quarter", dotted: false };
}

function pitchXml(pitch: number, spelling: Record<number, { step: string; alter: number }>): string {
  const { step, alter, octave } = pitchToStepOctaveAlter(pitch, spelling);
  return `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${octave}</octave></pitch>`;
}

interface TieInfo {
  /** This fragment is tied INTO the next one (i.e. it's not the last fragment of a split note). */
  start: boolean;
  /** This fragment is tied FROM the previous one (i.e. it's not the first fragment of a split note). */
  stop: boolean;
}

/**
 * A note whose duration doesn't fit in the remaining room of its measure
 * (pushChunk's bar-splitting below) is written as multiple `<note>` elements
 * — without a tie, that reads as several separate, re-attacked notes rather
 * than one sustained note crossing the barline, which is wrong notation, not
 * just visually incomplete. `<tie>` (sound-only — how playback/OSMD's own
 * duration math treats it) and `<notations><tied>` (the actual curved line
 * engraved on the page) both use the same start/stop vocabulary and are
 * needed together; a rest has neither (rests are never tied).
 */
function noteXml(
  durationBeats: number,
  pitch: number | undefined,
  spelling: Record<number, { step: string; alter: number }>,
  tuplet?: TupletInfo,
  tie?: TieInfo,
  beamXml = "",
): string {
  const duration = Math.round(durationBeats * DIVISIONS);
  const { type, dotted } = noteTypeAndDots(durationBeats);
  const dotXml = dotted ? "<dot/>" : "";
  const body = pitch === undefined ? "<rest/>" : pitchXml(pitch, spelling);
  const tieSoundXml = pitch === undefined ? "" : `${tie?.stop ? '<tie type="stop"/>' : ""}${tie?.start ? '<tie type="start"/>' : ""}`;
  const timeModXml = tuplet
    ? "<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>"
    : "";
  const notationParts: string[] = [];
  if (pitch !== undefined && tie?.stop) notationParts.push('<tied type="stop"/>');
  if (pitch !== undefined && tie?.start) notationParts.push('<tied type="start"/>');
  if (tuplet && tuplet.position !== "middle") notationParts.push(`<tuplet type="${tuplet.position === "start" ? "start" : "stop"}"/>`);
  const notationsXml = notationParts.length > 0 ? `<notations>${notationParts.join("")}</notations>` : "";
  return `<note>${body}<duration>${duration}</duration>${tieSoundXml}<type>${type}</type>${dotXml}${timeModXml}${beamXml}${notationsXml}</note>`;
}

const BEAMABLE_EPSILON = 1e-6;
/**
 * A note's beam eligibility depends on its written TYPE (eighth/16th), never
 * its raw duration — a dotted eighth (0.75 beats) or a triplet eighth (1/3
 * beat) are both still "eighth" for beaming purposes, just as beamable as a
 * plain one (see noteTypeAndDots/isTripletEighth).
 */
function beamType(durationBeats: number): "eighth" | "16th" | null {
  const { type } = noteTypeAndDots(durationBeats);
  return type === "eighth" || type === "16th" ? type : null;
}

interface Chunk {
  note: Note | null;
  duration: number;
  tuplet?: TupletInfo;
  tie?: TieInfo;
  /** Position within the measure, in beats — used to group chunks by beat for beaming (MusicXML has no auto-beaming; every beam has to be spelled out explicitly, per beat, or OSMD renders each note with its own flag instead of a connected beam). */
  startInMeasure: number;
}

/**
 * Assigns MusicXML <beam> begin/continue/end tags to a run of chunks that
 * share the same integer beat (so a beam never crosses a beat boundary —
 * standard engraving practice). A rest or a note longer than an eighth (by
 * written type, see beamType) breaks a run; a lone beamable note with no
 * beamable neighbor in the same beat doesn't get a beam (MusicXML requires
 * at least two notes to form one).
 *
 * Level 2 (the second, inner beam connecting only 16th notes) is layered on
 * top of the level-1 run wherever 2+ consecutive chunks within it are 16ths.
 * A single 16th with no 16th neighbor on either side (e.g. the second note
 * of a dotted-eighth+16th pair) still needs a level-2 mark — a "hook" (a
 * short stub, not a full beam to a nonexistent partner): pointing back
 * toward the previous note when one exists in this beat group, or forward
 * when this 16th is itself the first note in the group.
 */
function computeBeatBeams(group: Chunk[]): string[] {
  const beams = new Array<string>(group.length).fill("");
  let start = 0;
  while (start < group.length) {
    if (!group[start].note || !beamType(group[start].duration)) {
      start++;
      continue;
    }
    let end = start;
    while (end < group.length && group[end].note && beamType(group[end].duration)) end++;
    if (end - start >= 2) {
      for (let k = start; k < end; k++) {
        const level1 = k === start ? "begin" : k === end - 1 ? "end" : "continue";
        let xml = `<beam number="1">${level1}</beam>`;
        if (beamType(group[k].duration) === "16th") {
          const prevIsSixteenth = k > start && beamType(group[k - 1].duration) === "16th";
          const nextIsSixteenth = k < end - 1 && beamType(group[k + 1].duration) === "16th";
          if (prevIsSixteenth || nextIsSixteenth) {
            let s2 = k;
            while (s2 > start && beamType(group[s2 - 1].duration) === "16th") s2--;
            let e2 = k;
            while (e2 < end - 1 && beamType(group[e2 + 1].duration) === "16th") e2++;
            const level2 = k === s2 ? "begin" : k === e2 ? "end" : "continue";
            xml += `<beam number="2">${level2}</beam>`;
          } else {
            const hook = k > start ? "backward hook" : "forward hook";
            xml += `<beam number="2">${hook}</beam>`;
          }
        }
        beams[k] = xml;
      }
    }
    start = end;
  }
  return beams;
}

/** Groups a measure's chunks by integer beat (assumes an integer beatsPerBar) and beams each beat's group independently, so beams never cross a beat. */
function computeMeasureBeams(chunks: Chunk[]): string[] {
  const beams = new Array<string>(chunks.length).fill("");
  let i = 0;
  while (i < chunks.length) {
    const beatIndex = Math.floor(chunks[i].startInMeasure + BEAMABLE_EPSILON);
    let j = i;
    while (j < chunks.length && Math.floor(chunks[j].startInMeasure + BEAMABLE_EPSILON) === beatIndex) j++;
    const groupBeams = computeBeatBeams(chunks.slice(i, j));
    for (let k = 0; k < groupBeams.length; k++) beams[i + k] = groupBeams[k];
    i = j;
  }
  return beams;
}

const ATTRIBUTES_XML = (beatsPerBar: number, fifths: number) =>
  `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>${fifths}</fifths></key><time><beats>${beatsPerBar}</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;

/**
 * Converts a Melody (as used by the piano-roll editor) into a single-part,
 * single-staff MusicXML document for display with OpenSheetMusicDisplay.
 * Assumes a fixed treble clef. The key signature (and every note's
 * step/alter spelling) is derived from the melody's own estimated key
 * (see keySpelling.ts) rather than always being C major/A minor — a melody
 * in, say, C minor gets a real 3-flat key signature and its scale notes need
 * no per-note accidental, instead of every non-C-major note being spelled
 * with a bare sharp against a declared key of no sharps/flats.
 */
export function melodyToMusicXml(melody: Melody, title = "DriftScore"): string {
  const beatsPerBar = melody.beatsPerBar;
  const fifths = fifthsForKey(estimateKey(melody));
  const spelling = buildKeySpellingTable(fifths);
  const sorted = [...melody.notes].sort((a, b) => a.start - b.start);

  const measures: Chunk[][] = [[]];
  let measureBeats = 0;

  // Epsilon-based rather than `> 0`: floating-point leftovers (e.g. from
  // TRIPLET_EIGHTH_BEATS's inexact 1/3) can leave `remaining` at something
  // like -1e-16 instead of exactly 0, which is still "done", not another
  // (zero-ish-duration) chunk to push.
  const REMAINDER_EPSILON = 1e-9;

  function pushChunk(note: Note | null, durationBeats: number, tuplet?: TupletInfo) {
    let remaining = durationBeats;
    let isFirstChunk = true;
    while (remaining > REMAINDER_EPSILON) {
      const roomLeft = beatsPerBar - measureBeats;
      const chunk = Math.min(remaining, roomLeft);
      const remainingAfter = remaining - chunk;
      const isLastChunk = remainingAfter <= REMAINDER_EPSILON;
      // Only a genuinely bar-split note needs tie start/stop at all — a
      // single-chunk note (the overwhelmingly common case) is both its own
      // first and last chunk, so both flags are false and noteXml() omits
      // the tie/tied elements entirely rather than writing empty ones.
      const tie = note && !(isFirstChunk && isLastChunk) ? { start: !isLastChunk, stop: !isFirstChunk } : undefined;
      measures[measures.length - 1].push({ note, duration: chunk, tuplet, tie, startInMeasure: measureBeats });
      measureBeats += chunk;
      remaining = remainingAfter;
      isFirstChunk = false;
      if (measureBeats >= beatsPerBar) {
        measures.push([]);
        measureBeats = 0;
      }
    }
  }

  const tupletPositions = computeTupletPositions(sorted);
  let cursor = 0;
  sorted.forEach((note, i) => {
    if (note.start > cursor) {
      pushChunk(null, note.start - cursor);
    }
    pushChunk(note, note.duration, tupletPositions[i]);
    cursor = note.start + note.duration;
  });

  if (measureBeats > 0) {
    pushChunk(null, beatsPerBar - measureBeats);
  }
  if (measures[measures.length - 1].length === 0) {
    measures.pop();
  }
  if (measures.length === 0) {
    measures.push([{ note: null, duration: beatsPerBar, startInMeasure: 0 }]);
  }

  const measuresXml = measures
    .map((chunks, i) => {
      const attrs = i === 0 ? ATTRIBUTES_XML(beatsPerBar, fifths) : "";
      const beams = computeMeasureBeams(chunks);
      const notesXml = chunks.map((chunk, k) =>
        noteXml(chunk.duration, chunk.note?.pitch, spelling, chunk.tuplet, chunk.tie, beams[k]),
      );
      return `<measure number="${i + 1}">${attrs}${notesXml.join("")}</measure>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>${title}</work-title></work>
  <part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list>
  <part id="P1">${measuresXml}</part>
</score-partwise>`;
}
