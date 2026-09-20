import { triadPitchClasses } from "./chordProgression";
import type { ChordSymbol, Genre, Note } from "./types";

interface BarEvent {
  offset: number;
  duration: number;
  /** Index into the chord's [root, third, fifth, (seventh)] tone stack */
  tones: number[];
}

interface GenreStyle {
  bassOctaveBase: number;
  useSeventh: boolean;
  /** Multiple rhythm variants, cycled bar-by-bar so comping doesn't repeat identically */
  chordPatterns: BarEvent[][];
  bassPatterns: BarEvent[][];
}

export const STYLES: Record<Genre, GenreStyle> = {
  jazz: {
    bassOctaveBase: 33,
    useSeventh: true,
    // Off-beat "comping" idioms: backbeat stabs, Charleston push, sparse/laid-back bars
    chordPatterns: [
      [
        { offset: 1, duration: 0.5, tones: [1, 2, 3] },
        { offset: 3, duration: 0.5, tones: [1, 2, 3] },
      ],
      [
        { offset: 0.5, duration: 0.5, tones: [1, 2, 3] },
        { offset: 2, duration: 0.5, tones: [1, 2, 3] },
        { offset: 3.5, duration: 0.5, tones: [1, 2, 3] },
      ],
      [{ offset: 2.5, duration: 1, tones: [1, 2, 3] }],
      [
        { offset: 1, duration: 0.5, tones: [1, 2, 3] },
        { offset: 1.5, duration: 0.5, tones: [1, 2, 3] },
        { offset: 3, duration: 0.5, tones: [1, 2, 3] },
      ],
    ],
    bassPatterns: [
      [
        { offset: 0, duration: 1, tones: [0] },
        { offset: 1, duration: 1, tones: [2] },
        { offset: 2, duration: 1, tones: [1] },
        { offset: 3, duration: 1, tones: [2] },
      ],
      [
        { offset: 0, duration: 1, tones: [0] },
        { offset: 1.5, duration: 0.5, tones: [1] },
        { offset: 2, duration: 1, tones: [2] },
        { offset: 3, duration: 1, tones: [1] },
      ],
    ],
  },
  rock: {
    bassOctaveBase: 33,
    useSeventh: false,
    chordPatterns: [
      [
        { offset: 0, duration: 2, tones: [0, 2] },
        { offset: 2, duration: 2, tones: [0, 2] },
      ],
      [
        { offset: 0, duration: 1, tones: [0, 2] },
        { offset: 1, duration: 0.5, tones: [0, 2] },
        { offset: 1.5, duration: 0.5, tones: [0, 2] },
        { offset: 2, duration: 1, tones: [0, 2] },
        { offset: 3, duration: 1, tones: [0, 2] },
      ],
    ],
    bassPatterns: [
      [
        { offset: 0, duration: 1, tones: [0] },
        { offset: 1, duration: 1, tones: [0] },
        { offset: 2, duration: 1, tones: [0] },
        { offset: 3, duration: 1, tones: [0] },
      ],
      [
        { offset: 0, duration: 0.5, tones: [0] },
        { offset: 0.5, duration: 0.5, tones: [0] },
        { offset: 1, duration: 1, tones: [0] },
        { offset: 2, duration: 1, tones: [0] },
        { offset: 3, duration: 1, tones: [2] },
      ],
    ],
  },
  classical: {
    bassOctaveBase: 33,
    useSeventh: false,
    chordPatterns: [
      [{ offset: 0, duration: 4, tones: [0, 1, 2] }],
      [
        { offset: 0, duration: 2, tones: [0, 1, 2] },
        { offset: 2, duration: 2, tones: [0, 1, 2] },
      ],
    ],
    bassPatterns: [[{ offset: 0, duration: 4, tones: [0] }]],
  },
  samba: {
    bassOctaveBase: 33,
    useSeventh: true,
    // Bossa/samba comping cell: dotted-eighth + sixteenth, repeated every beat
    // ("ター・タ、ター・タ..."), plus a tresillo (3-3-2) variant for rotation.
    chordPatterns: [
      [
        { offset: 0, duration: 0.75, tones: [1, 2, 3] },
        { offset: 0.75, duration: 0.25, tones: [1, 2, 3] },
        { offset: 1, duration: 0.75, tones: [1, 2, 3] },
        { offset: 1.75, duration: 0.25, tones: [1, 2, 3] },
        { offset: 2, duration: 0.75, tones: [1, 2, 3] },
        { offset: 2.75, duration: 0.25, tones: [1, 2, 3] },
        { offset: 3, duration: 0.75, tones: [1, 2, 3] },
        { offset: 3.75, duration: 0.25, tones: [1, 2, 3] },
      ],
      [
        { offset: 0, duration: 1.5, tones: [1, 2, 3] },
        { offset: 1.5, duration: 1.5, tones: [1, 2, 3] },
        { offset: 3, duration: 1, tones: [1, 2, 3] },
      ],
    ],
    bassPatterns: [
      [
        { offset: 0, duration: 1, tones: [0] },
        { offset: 1, duration: 1, tones: [0] },
        { offset: 2, duration: 1, tones: [0] },
        { offset: 3, duration: 1, tones: [0] },
      ],
    ],
  },
};

/**
 * Builds the chord's stacked pitches, always strictly below `ceiling`
 * (typically the lowest melody note sounding in that bar — the standard
 * comping technique is to voice the chord in the inversion immediately
 * below the melody, not in some fixed independent register). With a
 * previous voicing, each tone role (root/3rd/5th/7th) first moves to the
 * octave nearest its own previous pitch (so comping doesn't leap around
 * registers on every chord change), then the whole voicing is transposed
 * down an octave at a time if it would land at or above the ceiling.
 */
function chordToneStack(
  chord: ChordSymbol,
  useSeventh: boolean,
  ceiling: number,
  low: number,
  prevVoicing: number[] | null,
): number[] {
  const triad = triadPitchClasses(chord.root, chord.quality);
  const seventh = (chord.root + (chord.quality === "maj" ? 11 : 10)) % 12;
  const tones = useSeventh ? [...triad, seventh] : triad;

  if (prevVoicing && prevVoicing.length === tones.length) {
    let candidate = tones.map((pc, i) => pc + 12 * Math.round((prevVoicing[i] - pc) / 12));
    // Shift the whole voicing by octaves as a unit (never per-tone) so the
    // root/3rd/5th/7th shape — and their relative order — is preserved.
    while (Math.max(...candidate) >= ceiling) candidate = candidate.map((p) => p - 12);
    while (Math.min(...candidate) < low && Math.max(...candidate) + 12 < ceiling) {
      candidate = candidate.map((p) => p + 12);
    }
    return candidate;
  }

  // No previous voicing: stack downward from just below the ceiling, highest
  // tone role first, so every tone ends up strictly below the one above it.
  const pitches: number[] = [];
  let prev = ceiling;
  for (const pc of [...tones].reverse()) {
    let pitch = pc + 12 * Math.round((prev - pc) / 12);
    while (pitch >= prev) pitch -= 12;
    pitches.unshift(pitch);
    prev = pitch;
  }
  while (Math.min(...pitches) < low && Math.max(...pitches) + 12 < ceiling) {
    for (let i = 0; i < pitches.length; i++) pitches[i] += 12;
  }
  return pitches;
}

function renderPatterns(
  patterns: BarEvent[][],
  chords: ChordSymbol[],
  beatsPerBar: number,
  useSeventh: boolean,
  ceilings: number[],
  lows: number[],
): Note[] {
  const notes: Note[] = [];
  let id = 0;
  let prevVoicing: number[] | null = null;
  chords.forEach((chord, barIndex) => {
    const stack = chordToneStack(chord, useSeventh, ceilings[barIndex], lows[barIndex], prevVoicing);
    prevVoicing = stack;
    const pattern = patterns[barIndex % patterns.length];
    for (const event of pattern) {
      const pitches = event.tones.map((i) => stack[Math.min(i, stack.length - 1)]).sort((a, b) => a - b);
      notes.push({
        id: `n${id++}`,
        pitch: pitches[0],
        pitches: pitches.length > 1 ? pitches : undefined,
        start: chord.bar * beatsPerBar + event.offset,
        duration: event.duration,
        velocity: 90,
      });
    }
  });
  return notes;
}

export function renderChordsPart(
  chords: ChordSymbol[],
  genre: Genre,
  beatsPerBar: number,
  ceilings: number[],
  lows: number[],
): Note[] {
  const style = STYLES[genre];
  return renderPatterns(style.chordPatterns, chords, beatsPerBar, style.useSeventh, ceilings, lows);
}

/** Bass has no melody-ceiling constraint — it just anchors low, around bassOctaveBase, every bar. */
function bassToneStack(chord: ChordSymbol, octaveBase: number): number[] {
  const triad = triadPitchClasses(chord.root, chord.quality);
  const pitches: number[] = [];
  let prev = octaveBase - 12;
  for (const pc of triad) {
    let pitch = pc + 12 * Math.round((octaveBase - pc) / 12);
    while (pitch <= prev) pitch += 12;
    pitches.push(pitch);
    prev = pitch;
  }
  return pitches;
}

function renderBassPatterns(patterns: BarEvent[][], chords: ChordSymbol[], beatsPerBar: number, octaveBase: number): Note[] {
  const notes: Note[] = [];
  let id = 0;
  chords.forEach((chord, barIndex) => {
    const stack = bassToneStack(chord, octaveBase);
    const pattern = patterns[barIndex % patterns.length];
    for (const event of pattern) {
      const pitches = event.tones.map((i) => stack[Math.min(i, stack.length - 1)]).sort((a, b) => a - b);
      notes.push({
        id: `b${id++}`,
        pitch: pitches[0],
        pitches: pitches.length > 1 ? pitches : undefined,
        start: chord.bar * beatsPerBar + event.offset,
        duration: event.duration,
        velocity: 90,
      });
    }
  });
  return notes;
}

/**
 * Jazz walking bass idiom: the last note of each bar becomes a chromatic
 * approach tone (a half-step above or below, whichever is the smaller leap)
 * leading into the next bar's chord root, instead of just another tone of
 * the current chord.
 */
function applyWalkingBassApproach(notes: Note[], chords: ChordSymbol[], beatsPerBar: number): Note[] {
  const byBarLastIndex = new Map<number, number>();
  notes.forEach((note, i) => {
    const bar = Math.floor(note.start / beatsPerBar);
    const current = byBarLastIndex.get(bar);
    if (current === undefined || note.start > notes[current].start) {
      byBarLastIndex.set(bar, i);
    }
  });

  const result = [...notes];
  chords.forEach((chord, i) => {
    const next = chords[i + 1];
    if (!next) return;
    const lastIndex = byBarLastIndex.get(chord.bar);
    if (lastIndex === undefined) return;
    const target = result[lastIndex];
    const below = next.root - 1;
    const above = next.root + 1;
    const distBelow = Math.abs(((below - target.pitch) % 12 + 18) % 12 - 6);
    const distAbove = Math.abs(((above - target.pitch) % 12 + 18) % 12 - 6);
    const approachPc = distBelow <= distAbove ? below : above;
    const pitch = approachPc + 12 * Math.round((target.pitch - approachPc) / 12);
    result[lastIndex] = { ...target, pitch };
  });
  return result;
}

export function renderBassPart(chords: ChordSymbol[], genre: Genre, beatsPerBar: number): Note[] {
  const style = STYLES[genre];
  const notesFromBass = renderBassPatterns(style.bassPatterns, chords, beatsPerBar, style.bassOctaveBase);
  return genre === "jazz" ? applyWalkingBassApproach(notesFromBass, chords, beatsPerBar) : notesFromBass;
}

