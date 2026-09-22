import type { Melody, Note } from "@/features/piano-roll";
import type { Arrangement, ArrangementPart, ChordQuality, ChordSymbol, Section, SectionKind } from "./arrangementTypes";
import { DRUM_DISPLAY } from "./percussionMap";

const SECTION_LABELS: Record<SectionKind, string> = {
  intro: "イントロ",
  theme: "Aメロ",
  solo: "ソロ",
  break: "キメ",
  reprise: "Aメロ",
  ending: "エンディング",
};

function rehearsalXml(label: string): string {
  return `<direction placement="above"><direction-type><rehearsal>${label}</rehearsal></direction-type></direction>`;
}

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

/** A drum's GM key number has no real pitch — resolve it to a fixed staff position + notehead instead. */
function unpitchedXml(gmKey: number): { positionXml: string; noteheadXml: string } {
  const display = DRUM_DISPLAY[gmKey] ?? { step: "C", octave: 5 };
  return {
    positionXml: `<unpitched><display-step>${display.step}</display-step><display-octave>${display.octave}</display-octave></unpitched>`,
    noteheadXml: display.notehead ? `<notehead>${display.notehead}</notehead>` : "",
  };
}

interface NoteXmlOptions {
  isPercussion?: boolean;
  /** MusicXML <voice> number — only meaningful when a part has more than one
   * independent voice on the same staff (percussion's up/down split). */
  voice?: number;
  /** Forces stem direction — percussion notation convention: hihat/snare/toms
   * up, kick down, independent of the notehead's vertical staff position. */
  stem?: "up" | "down";
}

function noteXml(durationBeats: number, note: Note | null, transposeSemitones: number, options: NoteXmlOptions = {}): string {
  const { isPercussion = false, voice, stem } = options;
  const duration = Math.round(durationBeats * DIVISIONS);
  const { type, dotted } = noteTypeAndDots(durationBeats);
  const dotXml = dotted ? "<dot/>" : "";
  const voiceXml = voice ? `<voice>${voice}</voice>` : "";
  const stemXml = stem ? `<stem>${stem}</stem>` : "";
  const pitches = note ? (note.pitches && note.pitches.length > 0 ? note.pitches : [note.pitch]) : [];

  if (pitches.length === 0) {
    return `<note><rest/><duration>${duration}</duration>${voiceXml}<type>${type}</type>${dotXml}</note>`;
  }
  if (isPercussion) {
    return pitches
      .map((gmKey, i) => {
        const { positionXml, noteheadXml } = unpitchedXml(gmKey);
        return `<note>${i > 0 ? "<chord/>" : ""}${positionXml}<duration>${duration}</duration>${voiceXml}<type>${type}</type>${dotXml}${stemXml}${noteheadXml}</note>`;
      })
      .join("");
  }
  return pitches
    .map(
      (pitch, i) =>
        `<note>${i > 0 ? "<chord/>" : ""}${pitchXml(pitch + transposeSemitones)}<duration>${duration}</duration>${voiceXml}<type>${type}</type>${dotXml}</note>`,
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

function clefXml(clef: "treble" | "bass" | "percussion"): string {
  if (clef === "percussion") return "<clef><sign>percussion</sign><line>2</line></clef>";
  return clef === "bass" ? "<clef><sign>F</sign><line>4</line></clef>" : "<clef><sign>G</sign><line>2</line></clef>";
}

function transposeXml(transposeSemitones: number): string {
  if (!transposeSemitones) return "";
  // MusicXML <chromatic> is semitones from written to sounding pitch — the inverse of our convention.
  return `<transpose><chromatic>${-transposeSemitones}</chromatic></transpose>`;
}

function melodyToMeasures(melody: Melody, transposeSemitones = 0, options: NoteXmlOptions = {}): string[][] {
  const beatsPerBar = melody.beatsPerBar;
  const sorted = [...melody.notes].sort((a, b) => a.start - b.start);
  const measures: string[][] = [[]];
  let measureBeats = 0;

  function pushChunk(note: Note | null, durationBeats: number) {
    let remaining = durationBeats;
    while (remaining > 0) {
      const roomLeft = beatsPerBar - measureBeats;
      const chunk = Math.min(remaining, roomLeft);
      measures[measures.length - 1].push(noteXml(chunk, note, transposeSemitones, options));
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
    measures.push([noteXml(beatsPerBar, null, transposeSemitones, options)]);
  }
  return measures;
}

function partMeasuresXml(
  part: ArrangementPart,
  beatsPerBar: number,
  measureCount: number,
  chordsPerMeasure?: ChordSymbol[],
  sectionLabelForMeasure?: Map<number, string>,
): string {
  const isPercussion = part.clef === "percussion";
  const hasSecondVoice = !!part.secondaryVoice;
  const primaryOptions: NoteXmlOptions = isPercussion
    ? { isPercussion: true, voice: 1, stem: "up" }
    : {};
  const measures = melodyToMeasures(part.melody, part.transposeSemitones, primaryOptions);
  while (measures.length < measureCount) {
    measures.push([noteXml(beatsPerBar, null, part.transposeSemitones, primaryOptions)]);
  }

  let secondMeasures: string[][] = [];
  if (part.secondaryVoice) {
    const secondaryOptions: NoteXmlOptions = { isPercussion: true, voice: 2, stem: "down" };
    secondMeasures = melodyToMeasures(part.secondaryVoice, part.transposeSemitones, secondaryOptions);
    while (secondMeasures.length < measureCount) {
      secondMeasures.push([noteXml(beatsPerBar, null, part.transposeSemitones, secondaryOptions)]);
    }
  }

  const backupXml = hasSecondVoice ? `<backup><duration>${Math.round(beatsPerBar * DIVISIONS)}</duration></backup>` : "";

  return measures
    .map((notesXml, i) => {
      const attrs =
        i === 0
          ? `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>0</fifths></key><time><beats>${beatsPerBar}</beats><beat-type>4</beat-type></time>${clefXml(part.clef)}${transposeXml(part.transposeSemitones)}</attributes>`
          : "";
      const harmony = chordsPerMeasure?.[i] ? harmonyXml(chordsPerMeasure[i]) : "";
      const rehearsal = sectionLabelForMeasure?.has(i) ? rehearsalXml(sectionLabelForMeasure.get(i)!) : "";
      const secondVoiceXml = hasSecondVoice ? backupXml + (secondMeasures[i]?.join("") ?? "") : "";
      return `<measure number="${i + 1}">${attrs}${rehearsal}${harmony}${notesXml.join("")}${secondVoiceXml}</measure>`;
    })
    .join("");
}

/** Converts a generated Arrangement (multiple parts) into multi-staff MusicXML for OSMD. */
export function arrangementToMusicXml(arrangement: Arrangement, title = "DriftScore"): string {
  const measureCounts = arrangement.parts.map((p) => melodyToMeasures(p.melody).length);
  const measureCount = Math.max(1, ...measureCounts);

  // Rehearsal marks (section labels) go on the top staff only, like a real
  // conductor's score — and only when there's more than the trivial single
  // "theme" section a theme-only-mode arrangement has, so that mode's output
  // is unchanged.
  const sectionLabelForMeasure: Map<number, string> | undefined =
    arrangement.sections.length > 1
      ? new Map(arrangement.sections.map((s: Section) => [s.startBar, SECTION_LABELS[s.kind]]))
      : undefined;

  const partList = arrangement.parts
    .map((p) => `<score-part id="${p.id}"><part-name>${p.name}</part-name></score-part>`)
    .join("");
  const parts = arrangement.parts
    .map((p, i) => {
      const chordsPerMeasure = p.id === arrangement.melodyPartId ? arrangement.chords : undefined;
      const labels = i === 0 ? sectionLabelForMeasure : undefined;
      return `<part id="${p.id}">${partMeasuresXml(p, arrangement.beatsPerBar, measureCount, chordsPerMeasure, labels)}</part>`;
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
