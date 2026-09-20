import type { Melody, Note } from "@/features/piano-roll";
import type { Arrangement, ArrangementPart, ChordQuality, ChordSymbol } from "./arrangementTypes";

const STEP_NAMES = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
const ALTERS = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
const DIVISIONS = 4;

const DURATION_TYPES: [beats: number, type: string][] = [
  [0.25, "16th"],
  [0.5, "eighth"],
  [1, "quarter"],
  [2, "half"],
  [4, "whole"],
];

function pitchToStepOctaveAlter(pitch: number) {
  const step = STEP_NAMES[pitch % 12];
  const alter = ALTERS[pitch % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return { step, alter, octave };
}

/** Resolves a duration in beats to a MusicXML note type, detecting dotted values (1.5x a base type). */
function noteTypeAndDots(beats: number): { type: string; dotted: boolean } {
  for (const [base, type] of DURATION_TYPES) {
    if (Math.abs(beats - base) < 1e-6) return { type, dotted: false };
    if (Math.abs(beats - base * 1.5) < 1e-6) return { type, dotted: true };
  }
  return { type: "quarter", dotted: false };
}

function pitchXml(pitch: number): string {
  const { step, alter, octave } = pitchToStepOctaveAlter(pitch);
  return `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${octave}</octave></pitch>`;
}

function noteXml(durationBeats: number, note: Note | null): string {
  const duration = Math.round(durationBeats * DIVISIONS);
  const { type, dotted } = noteTypeAndDots(durationBeats);
  const dotXml = dotted ? "<dot/>" : "";
  const pitches = note ? (note.pitches && note.pitches.length > 0 ? note.pitches : [note.pitch]) : [];

  if (pitches.length === 0) {
    return `<note><rest/><duration>${duration}</duration><type>${type}</type>${dotXml}</note>`;
  }
  return pitches
    .map(
      (pitch, i) =>
        `<note>${i > 0 ? "<chord/>" : ""}${pitchXml(pitch)}<duration>${duration}</duration><type>${type}</type>${dotXml}</note>`,
    )
    .join("");
}

const KIND_XML: Record<ChordQuality, string> = {
  maj: '<kind text="">major</kind>',
  min: '<kind text="m">minor</kind>',
  dim: '<kind text="dim">diminished</kind>',
};

function harmonyXml(chord: ChordSymbol): string {
  const step = STEP_NAMES[chord.root];
  const alter = ALTERS[chord.root];
  const rootXml = `<root-step>${step}</root-step>${alter ? `<root-alter>${alter}</root-alter>` : ""}`;
  return `<harmony><root>${rootXml}</root>${KIND_XML[chord.quality]}</harmony>`;
}

function clefXml(clef: "treble" | "bass"): string {
  return clef === "bass" ? "<clef><sign>F</sign><line>4</line></clef>" : "<clef><sign>G</sign><line>2</line></clef>";
}

function melodyToMeasures(melody: Melody): string[][] {
  const beatsPerBar = melody.beatsPerBar;
  const sorted = [...melody.notes].sort((a, b) => a.start - b.start);
  const measures: string[][] = [[]];
  let measureBeats = 0;

  function pushChunk(note: Note | null, durationBeats: number) {
    let remaining = durationBeats;
    while (remaining > 0) {
      const roomLeft = beatsPerBar - measureBeats;
      const chunk = Math.min(remaining, roomLeft);
      measures[measures.length - 1].push(noteXml(chunk, note));
      measureBeats += chunk;
      remaining -= chunk;
      if (measureBeats >= beatsPerBar) {
        measures.push([]);
        measureBeats = 0;
      }
    }
  }

  let cursor = 0;
  for (const note of sorted) {
    if (note.start > cursor) {
      pushChunk(null, note.start - cursor);
    }
    pushChunk(note, note.duration);
    cursor = note.start + note.duration;
  }
  if (measureBeats > 0) {
    pushChunk(null, beatsPerBar - measureBeats);
  }
  if (measures[measures.length - 1].length === 0) {
    measures.pop();
  }
  if (measures.length === 0) {
    measures.push([noteXml(beatsPerBar, null)]);
  }
  return measures;
}

function partMeasuresXml(
  part: ArrangementPart,
  beatsPerBar: number,
  measureCount: number,
  chordsPerMeasure?: ChordSymbol[],
): string {
  const measures = melodyToMeasures(part.melody);
  while (measures.length < measureCount) {
    measures.push([noteXml(beatsPerBar, null)]);
  }

  return measures
    .map((notesXml, i) => {
      const attrs =
        i === 0
          ? `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>0</fifths></key><time><beats>${beatsPerBar}</beats><beat-type>4</beat-type></time>${clefXml(part.clef)}</attributes>`
          : "";
      const harmony = chordsPerMeasure?.[i] ? harmonyXml(chordsPerMeasure[i]) : "";
      return `<measure number="${i + 1}">${attrs}${harmony}${notesXml.join("")}</measure>`;
    })
    .join("");
}

/** Converts a generated Arrangement (multiple parts) into multi-staff MusicXML for OSMD. */
export function arrangementToMusicXml(arrangement: Arrangement, title = "DriftScore"): string {
  const measureCounts = arrangement.parts.map((p) => melodyToMeasures(p.melody).length);
  const measureCount = Math.max(1, ...measureCounts);

  const partList = arrangement.parts
    .map((p) => `<score-part id="${p.id}"><part-name>${p.name}</part-name></score-part>`)
    .join("");
  const parts = arrangement.parts
    .map((p) => {
      const chordsPerMeasure = p.id === "melody" ? arrangement.chords : undefined;
      return `<part id="${p.id}">${partMeasuresXml(p, arrangement.beatsPerBar, measureCount, chordsPerMeasure)}</part>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>${title}</work-title></work>
  <part-list>${partList}</part-list>
  ${parts}
</score-partwise>`;
}
