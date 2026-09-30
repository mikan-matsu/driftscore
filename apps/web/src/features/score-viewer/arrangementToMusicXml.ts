import type { Melody, Note } from "@/features/piano-roll";
import type { Arrangement, ArrangementPart, ChordQuality, ChordSymbol, Section, SectionKind } from "./arrangementTypes";
import { assignGuitarTab, type FretPlacement } from "./guitarTab";
import { DRUM_DISPLAY } from "./percussionMap";
import { buildKeySpellingTable, fifthsForKey, type Spelling } from "./keySpelling";

/** Parts notated on a 6-line TAB staff (string/fret) instead of standard notation — currently just the guitar. */
function isTabPart(partId: string): boolean {
  return partId === "guitar";
}

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

/** Plain italic performance-direction text (e.g. "Swing"), as opposed to
 * rehearsalXml's boxed section-marker letters — the real-world convention
 * for telling a player how to interpret notation that's written straight
 * but meant to be played unevenly. */
function wordsXml(text: string): string {
  return `<direction placement="above"><direction-type><words font-style="italic">${text}</words></direction-type></direction>`;
}

const DIVISIONS = 4;

const DURATION_TYPES: [beats: number, type: string][] = [
  [0.25, "16th"],
  [0.5, "eighth"],
  [1, "quarter"],
  [2, "half"],
  [4, "whole"],
];

function pitchToStepOctaveAlter(pitch: number, spelling: Record<number, Spelling>) {
  const pc = ((pitch % 12) + 12) % 12;
  const { step, alter } = spelling[pc];
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

function pitchXml(pitch: number, spelling: Record<number, Spelling>): string {
  const { step, alter, octave } = pitchToStepOctaveAlter(pitch, spelling);
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
  /** Namespaces the emitted note id (see idAttr below) — Note.id counters
   * reset per generation function, so different parts can produce the same
   * raw id (e.g. two parts both starting at "n0"); the XML `id` attribute
   * must be unique across the whole document. */
  partId?: string;
  /** String/fret placements for a TAB-notated part (see isTabPart), keyed by
   * Note.id — precomputed once per part (assignGuitarTab) rather than per
   * note, since idiomatic fret choice depends on the *previous* note's hand
   * position, not just the current one. */
  tab?: Map<string, FretPlacement[]>;
  /** Per-pitch-class step/alter spelling for the arrangement's key (see
   * keySpelling.ts) — every pitched note (not TAB, not percussion, which
   * have their own spelling-independent notation) uses this instead of a
   * fixed sharps-only table, so the key signature and note spelling agree
   * and diatonic notes don't need a redundant accidental. */
  spelling?: Record<number, Spelling>;
  /** MusicXML note `color` attribute — used to grey out a muted part's
   * noteheads/stems/rests (see MUTED_COLOR) without removing the part from
   * the rendered score, so the reader can still see what a muted instrument
   * WOULD have played. */
  color?: string;
}

/** Muted-part grey — matches Tailwind's slate-400, distinct enough from
 * normal black noteheads to read as "off" at a glance but not so light it
 * disappears against the page background. */
const MUTED_COLOR = "#94a3b8";

interface TieInfo {
  /** This chunk is tied INTO the next one (i.e. not the last fragment of a split note). */
  start: boolean;
  /** This chunk is tied FROM the previous one (i.e. not the first fragment of a split note). */
  stop: boolean;
}

function noteXml(
  durationBeats: number,
  note: Note | null,
  transposeSemitones: number,
  options: NoteXmlOptions = {},
  beamXml = "",
  tie?: TieInfo,
): string {
  const { isPercussion = false, voice, stem, partId, tab, color, spelling } = options;
  const duration = Math.round(durationBeats * DIVISIONS);
  const { type, dotted } = noteTypeAndDots(durationBeats);
  const dotXml = dotted ? "<dot/>" : "";
  const voiceXml = voice ? `<voice>${voice}</voice>` : "";
  const stemXml = stem ? `<stem>${stem}</stem>` : "";
  const colorAttr = color ? ` color="${color}"` : "";
  const pitches = note ? (note.pitches && note.pitches.length > 0 ? note.pitches : [note.pitch]) : [];
  // Carries the underlying Note.id through to the rendered SVG (OSMD copies
  // this MusicXML `id` attribute onto its GraphicalNote), so a click/drag on
  // the rendered staff can be traced back to the piano-roll Note it came
  // from. A note split across a measure boundary emits this id on each
  // resulting <note> chunk, since they're still the same logical note.
  const idAttr = note ? ` id="note-${partId ?? "p"}-${note.id}"` : "";
  // A note whose duration overruns the room left in its measure (see
  // melodyToChunks' bar-splitting) is written as multiple <note> elements —
  // without a tie, that reads as several separately-attacked notes instead
  // of one sustained note crossing the barline. <tie> (sound-only) and
  // <notations><tied> (the engraved curve) both use the same start/stop
  // vocabulary and are emitted together on every fragment (matching
  // melodyToMusicXml.ts's melody-preview path, which already does this).
  const tieSoundXml = note ? `${tie?.stop ? '<tie type="stop"/>' : ""}${tie?.start ? '<tie type="start"/>' : ""}` : "";
  const tiedNotationXml =
    note && (tie?.stop || tie?.start)
      ? `<notations>${tie.stop ? '<tied type="stop"/>' : ""}${tie.start ? '<tied type="start"/>' : ""}</notations>`
      : "";

  if (pitches.length === 0) {
    return `<note${colorAttr}><rest/><duration>${duration}</duration>${voiceXml}<type>${type}</type>${dotXml}</note>`;
  }
  if (isPercussion) {
    return pitches
      .map((gmKey, i) => {
        const { positionXml, noteheadXml } = unpitchedXml(gmKey);
        return `<note${i === 0 ? idAttr : ""}${colorAttr}>${i > 0 ? "<chord/>" : ""}${positionXml}<duration>${duration}</duration>${tieSoundXml}${voiceXml}<type>${type}</type>${dotXml}${stemXml}${noteheadXml}${beamXml}${tiedNotationXml}</note>`;
      })
      .join("");
  }
  // TAB notation: still carries the real <pitch> (so anything reading pitch
  // elsewhere is unaffected) alongside <technical><string>/<fret>, which is
  // what actually tells OSMD which string/fret to draw — a plain <pitch>
  // alone on a TAB staff renders as a floating, unplaced notehead. Never
  // applies transposeSemitones here: that's standard notation's "written an
  // octave above sounding" convention for guitar (see instruments.ts), which
  // doesn't apply to TAB — a fret number already unambiguously encodes the
  // exact sounding pitch, so writing it an octave off would just be wrong.
  if (tab && note) {
    const placements = tab.get(note.id) ?? [];
    return pitches
      .map((pitch, i) => {
        const placement = placements[i];
        const technicalXml = placement
          ? `<technical><string>${placement.string}</string><fret>${placement.fret}</fret></technical>`
          : "";
        const notationsXml =
          technicalXml || tiedNotationXml
            ? `<notations>${tie?.stop ? '<tied type="stop"/>' : ""}${tie?.start ? '<tied type="start"/>' : ""}${technicalXml}</notations>`
            : "";
        return `<note${i === 0 ? idAttr : ""}${colorAttr}>${i > 0 ? "<chord/>" : ""}${pitchXml(pitch, spelling!)}<duration>${duration}</duration>${tieSoundXml}${voiceXml}<type>${type}</type>${dotXml}${beamXml}${notationsXml}</note>`;
      })
      .join("");
  }
  return pitches
    .map(
      (pitch, i) =>
        `<note${i === 0 ? idAttr : ""}${colorAttr}>${i > 0 ? "<chord/>" : ""}${pitchXml(pitch + transposeSemitones, spelling!)}<duration>${duration}</duration>${tieSoundXml}${voiceXml}<type>${type}</type>${dotXml}${beamXml}${tiedNotationXml}</note>`,
    )
    .join("");
}

const BEAMABLE_EPSILON = 1e-6;
/**
 * A note's beam eligibility depends on its written TYPE (eighth/16th),
 * never its raw duration — a dotted eighth (0.75 beats) is still an
 * eighth for beaming purposes, just as beamable as a plain one. Comparing
 * raw duration against a 0.5-beat cutoff (an earlier version of this
 * function did exactly that) silently excludes every dotted-eighth note
 * from beaming entirely, which for a dotted-eighth+16th pair (the classic
 * shuffle/swing figure, and genuinely still emitted elsewhere by patterns
 * with real dotted rhythms, not just the old baked-in swing notation)
 * left the 16th note beamed to nothing — rendered as an isolated flagged
 * note instead of connected to the eighth it belongs with.
 */
function beamType(durationBeats: number): "eighth" | "16th" | null {
  const { type } = noteTypeAndDots(durationBeats);
  return type === "eighth" || type === "16th" ? type : null;
}

interface Chunk {
  note: Note | null;
  duration: number;
  tie?: TieInfo;
  /** Position within the measure, in beats — used to group chunks by beat for beaming (MusicXML has no auto-beaming; every beam has to be spelled out explicitly, per beat, or OSMD renders each note with its own flag instead of a connected beam). */
  startInMeasure: number;
}

/**
 * Assigns MusicXML <beam> begin/continue/end tags to a run of chunks that
 * share the same integer beat (so a beam never crosses a beat boundary —
 * standard engraving practice, and what "group by 4" for a 16th-note beat
 * means concretely). A rest or a note longer than an eighth (by written
 * type, see beamType) breaks a run; a lone beamable note with no beamable
 * neighbor in the same beat doesn't get a beam (MusicXML requires at least
 * two notes to form one).
 *
 * Level 2 (the second, inner beam connecting only 16th notes) is layered
 * on top of the level-1 run wherever 2+ consecutive chunks within it are
 * 16ths. A single 16th with no 16th neighbor on either side (e.g. the
 * second note of a dotted-eighth+16th pair) still needs a level-2 mark —
 * a "hook" (a short stub, not a full beam to a nonexistent partner):
 * pointing back toward the previous note when one exists in this beat
 * group (the dotted-8th+16th case), or forward when this 16th is itself
 * the first note in the group (the reverse, "Scotch snap" case).
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

/** Groups a measure's chunks by integer beat (assumes an integer beatsPerBar, true for every meter this engine generates) and beams each beat's group independently, so beams never cross a beat. */
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

const KIND_XML: Record<ChordQuality, string> = {
  maj: '<kind text="">major</kind>',
  min: '<kind text="m">minor</kind>',
  dim: '<kind text="dim">diminished</kind>',
};

function harmonyXml(chord: ChordSymbol, spelling: Record<number, Spelling>): string {
  const { step, alter } = spelling[((chord.root % 12) + 12) % 12];
  const rootXml = `<root-step>${step}</root-step>${alter ? `<root-alter>${alter}</root-alter>` : ""}`;
  return `<harmony><root>${rootXml}</root>${KIND_XML[chord.quality]}</harmony>`;
}

function clefXml(clef: "treble" | "bass" | "percussion", isTab: boolean): string {
  if (isTab) return "<staff-details><staff-lines>6</staff-lines></staff-details><clef><sign>TAB</sign><line>5</line></clef>";
  if (clef === "percussion") return "<clef><sign>percussion</sign><line>2</line></clef>";
  return clef === "bass" ? "<clef><sign>F</sign><line>4</line></clef>" : "<clef><sign>G</sign><line>2</line></clef>";
}

function transposeXml(transposeSemitones: number): string {
  if (!transposeSemitones) return "";
  // MusicXML <chromatic> is semitones from written to sounding pitch — the inverse of our convention.
  return `<transpose><chromatic>${-transposeSemitones}</chromatic></transpose>`;
}

// Epsilon-based rather than `> 0`: floating-point leftovers (e.g. from a
// triplet's inexact 1/3 beat) can leave `remaining` at something like
// -1e-16 instead of exactly 0, which is still "done", not another
// (zero-ish-duration, spuriously tied) chunk to push.
const REMAINDER_EPSILON = 1e-9;

function melodyToChunks(melody: Melody): Chunk[][] {
  const beatsPerBar = melody.beatsPerBar;
  const sorted = [...melody.notes].sort((a, b) => a.start - b.start);
  const measures: Chunk[][] = [[]];
  let measureBeats = 0;

  function pushChunk(note: Note | null, durationBeats: number) {
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
      // the tie/tied elements entirely.
      const tie = note && !(isFirstChunk && isLastChunk) ? { start: !isLastChunk, stop: !isFirstChunk } : undefined;
      measures[measures.length - 1].push({ note, duration: chunk, tie, startInMeasure: measureBeats });
      measureBeats += chunk;
      remaining = remainingAfter;
      isFirstChunk = false;
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
    measures.push([{ note: null, duration: beatsPerBar, startInMeasure: 0 }]);
  }
  return measures;
}

function melodyToMeasures(melody: Melody, transposeSemitones = 0, options: NoteXmlOptions = {}): string[][] {
  return melodyToChunks(melody).map((chunks) => {
    const beams = computeMeasureBeams(chunks);
    return chunks.map((chunk, i) => noteXml(chunk.duration, chunk.note, transposeSemitones, options, beams[i], chunk.tie));
  });
}

function partMeasuresXml(
  part: ArrangementPart,
  beatsPerBar: number,
  measureCount: number,
  fifths: number,
  spelling: Record<number, Spelling>,
  chordsPerMeasure?: ChordSymbol[],
  sectionLabelForMeasure?: Map<number, string>,
  systemBreaks?: Set<number>,
  pageBreaks?: Set<number>,
  showSwingLabel?: boolean,
  isMuted?: boolean,
): string {
  const isPercussion = part.clef === "percussion";
  const isTab = isTabPart(part.id);
  const hasSecondVoice = !!part.secondaryVoice;
  const color = isMuted ? MUTED_COLOR : undefined;
  const primaryOptions: NoteXmlOptions = isPercussion
    ? { isPercussion: true, voice: 1, stem: "up", partId: part.id, color }
    : isTab
      ? { partId: part.id, tab: assignGuitarTab(part.melody.notes), color, spelling }
      : { partId: part.id, color, spelling };
  const measures = melodyToMeasures(part.melody, part.transposeSemitones, primaryOptions);
  while (measures.length < measureCount) {
    measures.push([noteXml(beatsPerBar, null, part.transposeSemitones, primaryOptions)]);
  }

  let secondMeasures: string[][] = [];
  if (part.secondaryVoice) {
    const secondaryOptions: NoteXmlOptions = { isPercussion: true, voice: 2, stem: "down", partId: part.id, color };
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
          ? `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>${fifths}</fifths></key><time><beats>${beatsPerBar}</beats><beat-type>4</beat-type></time>${clefXml(part.clef, isTab)}${isTab ? "" : transposeXml(part.transposeSemitones)}</attributes>`
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
      const harmony = chordsPerMeasure?.[i] ? harmonyXml(chordsPerMeasure[i], spelling) : "";
      const rehearsal = sectionLabelForMeasure?.has(i) ? rehearsalXml(sectionLabelForMeasure.get(i)!) : "";
      // "Swing" at measure 1 of the top staff only, like a real jazz chart —
      // the notation underneath is plain straight eighths (see JAZZ_BAR's
      // own comment in drums.ts); this is the marking that tells the player
      // (and, on this app's side, playArrangement.ts's swingTime()) to
      // interpret them unevenly rather than spelling that out note-by-note.
      const swing = showSwingLabel && i === 0 ? wordsXml("Swing") : "";
      const secondVoiceXml = hasSecondVoice ? backupXml + (secondMeasures[i]?.join("") ?? "") : "";
      return `<measure number="${i + 1}">${attrs}${printXml}${rehearsal}${swing}${harmony}${notesXml.join("")}${secondVoiceXml}</measure>`;
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

/** Converts a generated Arrangement (multiple parts) into multi-staff MusicXML for OSMD.
 * `mutedPartIds`: parts to render greyed-out (see MUTED_COLOR) rather than
 * omitted entirely — a muted part still shows what it would have played,
 * matching playArrangement.ts's own mutedPartIds (which actually silences
 * it), so the score and the audio agree on which parts are "off". */
export function arrangementToMusicXml(
  arrangement: Arrangement,
  title = "DriftScore",
  singlePartId?: string,
  mutedPartIds?: Set<string>,
): string {
  const measureCounts = arrangement.parts.map((p) => melodyToChunks(p.melody).length);
  const measureCount = Math.max(1, ...measureCounts);

  // `key` is absent only for a frontend-only synthetic Arrangement (the raw
  // melody preview, which renders through melodyToMusicXml instead — see
  // arrangementTypes.ts) that never goes through the /arrange engine;
  // defaulting to C major/no-sharps-or-flats there is a safe fallback, not a
  // real-arrangement code path.
  const fifths = fifthsForKey(arrangement.key ?? { root: 0, isMinor: false });
  const spelling = buildKeySpellingTable(fifths);

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
      const showSwingLabel = i === 0 && arrangement.genre === "jazz";
      const isMuted = mutedPartIds?.has(p.id) ?? false;
      return `<part id="${p.id}">${partMeasuresXml(p, arrangement.beatsPerBar, measureCount, fifths, spelling, chordsPerMeasure, labels, systemBreaks, pageBreaks, showSwingLabel, isMuted)}</part>`;
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
