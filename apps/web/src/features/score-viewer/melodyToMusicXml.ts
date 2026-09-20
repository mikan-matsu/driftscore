import type { Melody, Note } from "@/features/piano-roll";

const STEP_NAMES = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
const ALTERS = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
const DIVISIONS = 4;

const DURATION_TYPES: Record<number, string> = {
  0.25: "16th",
  0.5: "eighth",
  1: "quarter",
  2: "half",
  4: "whole",
};

function pitchToStepOctaveAlter(pitch: number) {
  const step = STEP_NAMES[pitch % 12];
  const alter = ALTERS[pitch % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return { step, alter, octave };
}

function noteTypeFor(beats: number): string {
  return DURATION_TYPES[beats] ?? "quarter";
}

function pitchXml(pitch: number): string {
  const { step, alter, octave } = pitchToStepOctaveAlter(pitch);
  return `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${octave}</octave></pitch>`;
}

function noteXml(durationBeats: number, pitch?: number): string {
  const duration = Math.round(durationBeats * DIVISIONS);
  const type = noteTypeFor(durationBeats);
  const body = pitch === undefined ? "<rest/>" : pitchXml(pitch);
  return `<note>${body}<duration>${duration}</duration><type>${type}</type></note>`;
}

const ATTRIBUTES_XML = (beatsPerBar: number) =>
  `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>0</fifths></key><time><beats>${beatsPerBar}</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;

/**
 * Converts a Melody (as used by the piano-roll editor) into a single-part,
 * single-staff MusicXML document for display with OpenSheetMusicDisplay.
 * Assumes a fixed treble clef and no key signature (C major / A minor).
 */
export function melodyToMusicXml(melody: Melody, title = "DriftScore"): string {
  const beatsPerBar = melody.beatsPerBar;
  const sorted = [...melody.notes].sort((a, b) => a.start - b.start);

  const measures: string[][] = [[]];
  let measureBeats = 0;

  function pushChunk(note: Note | null, durationBeats: number) {
    let remaining = durationBeats;
    while (remaining > 0) {
      const roomLeft = beatsPerBar - measureBeats;
      const chunk = Math.min(remaining, roomLeft);
      measures[measures.length - 1].push(noteXml(chunk, note?.pitch));
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
    measures.push([noteXml(beatsPerBar)]);
  }

  const measuresXml = measures
    .map((notesXml, i) => {
      const attrs = i === 0 ? ATTRIBUTES_XML(beatsPerBar) : "";
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
