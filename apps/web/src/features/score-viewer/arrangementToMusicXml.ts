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
  systemBreaks?: Set<number>,
  pageBreaks?: Set<number>,
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
      // A <print new-system="yes"/> at measure i tells OSMD explicitly where
      // to break to a new line, rather than leaving it to auto-fit — see
      // computeSystemBreaks() for why (a fixed measures-per-line count
      // could overflow the page width on dense bars; a fully automatic
      // count broke OSMD's own page-overflow pagination entirely).
      const printXml = pageBreaks?.has(i)
        ? `<print new-page="yes"/>`
        : systemBreaks?.has(i)
          ? `<print new-system="yes"/>`
          : "";
      const harmony = chordsPerMeasure?.[i] ? harmonyXml(chordsPerMeasure[i]) : "";
      const rehearsal = sectionLabelForMeasure?.has(i) ? rehearsalXml(sectionLabelForMeasure.get(i)!) : "";
      const secondVoiceXml = hasSecondVoice ? backupXml + (secondMeasures[i]?.join("") ?? "") : "";
      return `<measure number="${i + 1}">${attrs}${printXml}${rehearsal}${harmony}${notesXml.join("")}${secondVoiceXml}</measure>`;
    })
    .join("");
}

const DEFAULT_MEASURES_PER_SYSTEM = 8;
const DENSE_MEASURES_PER_SYSTEM = 4;
// Average note-onsets-per-part-per-measure above this reads as "busy" (fast
// rhythms, chords, many simultaneous voices) — tuned by feel, not a formal
// spec, since "dense" is inherently a judgment call. Measured against real
// output: a steady walking bass + swung comping alone already averages
// ~3.7-4.9 onsets/part/measure across jazz/rock/samba, so a threshold near
// that range would flag nearly an entire piece as "dense" regardless of
// genre — this sits above all three, so only genuinely busier passages
// (heavy embellishment, chord-dense comping beyond the genre's own norm)
// trigger the shorter 4-bar system. Classical (no drums, sparser comping)
// measured ~2.5, comfortably below.
const DENSE_ONSETS_PER_PART_THRESHOLD = 6;
// A trailing system this short or shorter reads as an orphan line — merged
// back into the previous system and re-split, per closeOutTail() below.
const ORPHAN_SYSTEM_THRESHOLD = 4;

/**
 * Counts real (non-rest) note onsets starting in each measure, summed across
 * every PITCHED part — the input to the dense-vs-normal system-length
 * decision below. Percussion is deliberately excluded: a drum pattern's hit
 * count (kick+ride+hihat can easily be 6-8 per bar) has nothing to do with
 * how visually busy the pitched staves are, and including it would flag
 * nearly every bar of any genre with a drum part as "dense" — drums are
 * repetitively busy by nature, every bar, independent of the actual
 * arrangement's ebb and flow.
 */
function computeMeasureDensity(parts: ArrangementPart[], beatsPerBar: number, measureCount: number): number[] {
  const density = new Array<number>(measureCount).fill(0);
  for (const part of parts) {
    if (part.clef === "percussion") continue;
    const voices = [part.melody.notes, ...(part.secondaryVoice ? [part.secondaryVoice.notes] : [])];
    for (const notes of voices) {
      for (const note of notes) {
        const measureIndex = Math.floor(note.start / beatsPerBar);
        if (measureIndex >= 0 && measureIndex < measureCount) density[measureIndex] += 1;
      }
    }
  }
  return density;
}

/** Splits a merged tail run of measures roughly in half, so re-closing an orphan never produces a system outside the 4-8 range this scheme otherwise sticks to. */
function splitTail(total: number): number[] {
  if (total <= DEFAULT_MEASURES_PER_SYSTEM) return [total];
  const a = Math.ceil(total / 2);
  return [a, total - a];
}

/**
 * Decides where each system (staff line) breaks, in measures — 8 measures
 * per system by default, dropping to 4 for a run of measures that reads as
 * busy (see DENSE_ONSETS_PER_PART_THRESHOLD), matching how a real arranger
 * shortens the line when there's too much ink to read comfortably at 8/line.
 * A short trailing system (1-3 measures) is folded back into the previous
 * one and re-split close to even, landing in the 6-7 range instead of
 * leaving a nearly-empty orphan line at the end of a section.
 *
 * Explicit `<print new-system="yes"/>` marks (written from this by the
 * caller) also restore OSMD's own automatic page-break-on-overflow, which
 * broke when measures-per-line was left fully automatic — OSMD's page
 * pagination apparently depends on systems having known, pre-decided
 * widths to measure overflow against, the same reason a *fixed* count used
 * to work.
 */
function computeSystemBreaks(measureCount: number, density: number[], numParts: number): Set<number> {
  const sizes: number[] = [];
  let i = 0;
  while (i < measureCount) {
    const remaining = measureCount - i;
    const lookahead = Math.min(DEFAULT_MEASURES_PER_SYSTEM, remaining);
    const windowTotal = density.slice(i, i + lookahead).reduce((sum, d) => sum + d, 0);
    const avgOnsetsPerPart = numParts > 0 ? windowTotal / lookahead / numParts : 0;
    const target = avgOnsetsPerPart > DENSE_ONSETS_PER_PART_THRESHOLD ? DENSE_MEASURES_PER_SYSTEM : DEFAULT_MEASURES_PER_SYSTEM;
    const size = Math.min(target, remaining);
    sizes.push(size);
    i += size;
  }

  if (sizes.length >= 2) {
    const last = sizes[sizes.length - 1];
    if (last > 0 && last < ORPHAN_SYSTEM_THRESHOLD) {
      const prev = sizes[sizes.length - 2];
      sizes.splice(sizes.length - 2, 2, ...splitTail(prev + last));
    }
  }

  const breaks = new Set<number>();
  let cursor = 0;
  for (const size of sizes) {
    if (cursor > 0) breaks.add(cursor);
    cursor += size;
  }
  return breaks;
}

/**
 * How many systems fit on one A4 page before the next one has to wrap to a
 * new page — OSMD doesn't figure this out on its own once page-height
 * overflow is left to its own automatic pagination (see the comment above
 * computeSystemBreaks: that stopped working reliably once measures-per-line
 * became fully automatic too), so it's decided explicitly here instead.
 * More staves per system means a taller system, so fewer fit per page —
 * approximated as inversely proportional to the part count rather than
 * modeling OSMD's actual staff-height math, then clamped to a sane range.
 */
function systemsPerPage(numParts: number): number {
  // Tuned from a measured render: a 4-part ensemble fits ~8 systems on one
  // A4 page at this zoom (system spacing ~463px, page height ~4206px) —
  // this constant (32 = 8 * 4) reproduces that data point and scales it
  // inversely for other part counts.
  return Math.max(3, Math.min(10, Math.round(32 / Math.max(1, numParts))));
}

/** Marks every Nth system break (from computeSystemBreaks) as a page break instead of a plain line break. */
function computePageBreaks(systemBreaks: Set<number>, numParts: number): Set<number> {
  const perPage = systemsPerPage(numParts);
  const starts = [...systemBreaks].sort((a, b) => a - b);
  const pageBreaks = new Set<number>();
  starts.forEach((measureIndex, systemNumber) => {
    // systemNumber is 1-based here (system 0 is measure 0, not in the set) —
    // the Nth system after the first page's worth starts a new page.
    if ((systemNumber + 1) % perPage === 0) pageBreaks.add(measureIndex);
  });
  return pageBreaks;
}

/** Converts a generated Arrangement (multiple parts) into multi-staff MusicXML for OSMD. */
export function arrangementToMusicXml(arrangement: Arrangement, title = "DriftScore", singlePartId?: string): string {
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

  const partsToRender = singlePartId
    ? arrangement.parts.filter((p) => p.id === singlePartId)
    : arrangement.parts;

  const pitchedPartCount = partsToRender.filter((p) => p.clef !== "percussion").length;
  const density = computeMeasureDensity(partsToRender, arrangement.beatsPerBar, measureCount);
  const systemBreaks = computeSystemBreaks(measureCount, density, pitchedPartCount);
  const pageBreaks = computePageBreaks(systemBreaks, partsToRender.length);

  const partList = partsToRender
    .map((p) => `<score-part id="${p.id}"><part-name>${p.name}</part-name></score-part>`)
    .join("");
  const parts = partsToRender
    .map((p, i) => {
      const chordsPerMeasure = p.id === arrangement.melodyPartId ? arrangement.chords : undefined;
      const labels = i === 0 ? sectionLabelForMeasure : undefined;
      return `<part id="${p.id}">${partMeasuresXml(p, arrangement.beatsPerBar, measureCount, chordsPerMeasure, labels, systemBreaks, pageBreaks)}</part>`;
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
