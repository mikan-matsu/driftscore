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
/**
 * Places each pitch class of `tones` independently at whichever of its
 * octave-equivalent pitches falls inside [low, ceiling) and lands closest to
 * `target` (typically the previous voicing's corresponding tone, for
 * continuity, or the band's center with no previous voicing) — not
 * constrained to any fixed vertical role order (root-at-bottom, 5th-on-top,
 * etc.), since a chord's own tones can be voiced in any inversion. Fixing
 * every tone strictly *below* the one above it (the old approach) forces the
 * root to the bottom, and for some chord shapes there is genuinely no
 * placement in that fixed order that fits both bounds even though a valid
 * *inverted* voicing does — found via a concrete repro (a C-major triad
 * squeezed into ceiling=55/low=40: root-at-bottom forces the root down to
 * 36, four semitones under `low`, while the first-inversion {40,43,48} fits
 * both bounds with room to spare). Falls back to the nearest in-range
 * placement (may still violate the other bound) only when no candidate for
 * a tone exists inside the band at all — a band narrower than an octave can
 * genuinely lack a spot for a given pitch class.
 */
export function placeToneInBand(pc: number, ceiling: number, low: number, target: number): number {
  const base = pc + 12 * Math.round((target - pc) / 12);
  let best: number | null = null;
  for (let k = -3; k <= 3; k++) {
    const candidate = base + 12 * k;
    if (candidate >= low && candidate < ceiling) {
      if (best === null || Math.abs(candidate - target) < Math.abs(best - target)) best = candidate;
    }
  }
  if (best !== null) return best;
  // No octave of this pitch class fits inside [low, ceiling) at all. `low`
  // and `ceiling` here are already clamped to the caller's instrument's own
  // *technical* range (never past its real floor/ceiling — see
  // renderHarmonyVoices' bandLow/bandHigh), so of the two, staying inside
  // `low` matters more: it's the difference between "brushes the bass" and
  // "physically unplayable". Fixing `ceiling` first, then `low`, means the
  // final result honors `low` even if that then re-violates `ceiling` —
  // fixing them in the other order (as a previous version of this code did)
  // could walk back out past `low` again while chasing `ceiling`, when the
  // gap between them is narrower than an octave (found via a concrete
  // repro: a wind-band harmony group's tighter per-group ceiling squeezed
  // pitch-class 0 into a 2-semitone band with no valid octave at all —
  // clamping ceiling-first-then-low returned a candidate for `pc` a whole
  // octave below `low`, an out-of-range note; low-first would have quietly
  // undone by the ceiling pass, same failure in the other direction).
  let pitch = base;
  while (pitch >= ceiling) pitch -= 12;
  while (pitch < low) pitch += 12;
  return pitch;
}

function freshStack(tones: number[], ceiling: number, low: number, prevVoicing: number[] | null): number[] {
  const center = (low + ceiling) / 2;
  return tones.map((pc, i) => placeToneInBand(pc, ceiling, low, prevVoicing?.[i] ?? center));
}

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
    // A whole-octave shift is too coarse when [low, ceiling) is narrower
    // than an octave but still wide enough for the chord shape itself —
    // e.g. ceiling 15 semitones above low, candidate needs only +4 to fit,
    // but +12 would overshoot the ceiling and 0 leaves it under `low`
    // (found via a concrete repro: a comping voicing left a few semitones
    // below its own instrument's technical range, which downstream
    // collision-avoidance then "fixed" by jumping it a full octave into
    // unison with the melody). Voice-leading continuity is the thing to
    // give up here, not correctness — re-stack fresh, ignoring prevVoicing,
    // which always finds a snug fit as long as one exists at all.
    if (Math.min(...candidate) < low) return freshStack(tones, ceiling, low, prevVoicing);
    return candidate;
  }

  return freshStack(tones, ceiling, low, null);
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
    const measureEnd = (chord.bar + 1) * beatsPerBar;
    for (const event of pattern) {
      const pitches = event.tones.map((i) => stack[Math.min(i, stack.length - 1)]).sort((a, b) => a - b);
      const start = chord.bar * beatsPerBar + event.offset;
      let duration = event.duration;
      // Clamp duration to not exceed measure boundary (handles floating-point accumulation)
      if (start + duration > measureEnd) duration = measureEnd - start;
      notes.push({
        id: `n${id++}`,
        pitch: pitches[0],
        pitches: pitches.length > 1 ? pitches : undefined,
        start,
        duration,
        velocity: 90,
      });
    }
  });
  return notes;
}

/**
 * Guitar-specific comping patterns, mixed into (never replacing) each
 * genre's shared `STYLES[genre].chordPatterns` — see renderChordsPart. Every
 * other polyphonic harmony instrument (piano, and any custom-ensemble pick
 * routed through the same "chordal comping" role) played identically
 * voiced, identically rhythmed block chords as guitar, which doesn't read
 * as guitar at all: real guitar parts lean on idioms a piano voicing
 * doesn't — palm-muted 8th/16th-note "chugging" power chords (root+5th,
 * `tones: [0, 2]`, skipping the color-bearing 3rd the way an actual power
 * chord does), single-note/dyad riffs built from the chord's root and 5th
 * rather than full triads, a thumb-and-fingers bass-note/chord-strum split
 * (bossa/samba's characteristic alternating-bass "batida"), and fingerstyle
 * arpeggiation (single notes in sequence, not simultaneous). `tones` indexes
 * are always [root, third, fifth, (seventh)] regardless of a chord's actual
 * voiced octaves (see chordToneStack) — `[0]` is always "the root", `[0, 2]`
 * always "root+5th", independent of inversion.
 */
const GUITAR_CHORD_PATTERNS: Partial<Record<Genre, BarEvent[][]>> = {
  rock: [
    // Palm-muted chugging: straight 8th-note power-chord stabs throughout.
    [
      { offset: 0, duration: 0.5, tones: [0, 2] },
      { offset: 0.5, duration: 0.5, tones: [0, 2] },
      { offset: 1, duration: 0.5, tones: [0, 2] },
      { offset: 1.5, duration: 0.5, tones: [0, 2] },
      { offset: 2, duration: 0.5, tones: [0, 2] },
      { offset: 2.5, duration: 0.5, tones: [0, 2] },
      { offset: 3, duration: 0.5, tones: [0, 2] },
      { offset: 3.5, duration: 0.5, tones: [0, 2] },
    ],
    // Single-note riff: root/5th movement with a syncopated push, not a
    // held chord — the idiom a block-chord voicing can never produce.
    [
      { offset: 0, duration: 0.75, tones: [0] },
      { offset: 0.75, duration: 0.25, tones: [0] },
      { offset: 1.5, duration: 0.5, tones: [2] },
      { offset: 2, duration: 1, tones: [0] },
      { offset: 3, duration: 0.5, tones: [0] },
      { offset: 3.5, duration: 0.5, tones: [2] },
    ],
  ],
  jazz: [
    // Shell-voicing stabs (root+7th only, no 3rd/5th) — closer to how a
    // jazz guitarist actually comps (2-3 note voicings) than piano's fuller
    // triad/seventh stacks. Falls back to root+3rd if this genre/chord ever
    // renders without a 7th (useSeventh is true for jazz, but stay safe).
    [
      { offset: 1, duration: 0.5, tones: [0, 3] },
      { offset: 3, duration: 0.5, tones: [0, 3] },
    ],
    [
      { offset: 0.5, duration: 0.5, tones: [0, 3] },
      { offset: 2, duration: 0.5, tones: [0, 3] },
      { offset: 3.5, duration: 0.5, tones: [0, 3] },
    ],
  ],
  samba: [
    // Bossa "batida": alternating bass note (thumb) on 1/3, chord strum
    // (fingers) on the offbeats — a real fingerstyle split, not a block
    // chord repeated on every hit like the shared samba comping cell.
    [
      { offset: 0, duration: 0.5, tones: [0] },
      { offset: 0.5, duration: 0.5, tones: [1, 2, 3] },
      { offset: 1.5, duration: 0.5, tones: [1, 2, 3] },
      { offset: 2, duration: 0.5, tones: [2] },
      { offset: 2.5, duration: 0.5, tones: [1, 2, 3] },
      { offset: 3.5, duration: 0.5, tones: [1, 2, 3] },
    ],
  ],
  classical: [
    // Fingerstyle arpeggio (Alberti-bass-like): one note at a time, never
    // simultaneous — a idiom block chords can't express at all.
    [
      { offset: 0, duration: 1, tones: [0] },
      { offset: 1, duration: 1, tones: [2] },
      { offset: 2, duration: 1, tones: [1] },
      { offset: 3, duration: 1, tones: [2] },
    ],
  ],
};

export function renderChordsPart(
  chords: ChordSymbol[],
  genre: Genre,
  beatsPerBar: number,
  ceilings: number[],
  lows: number[],
  instrumentId?: string,
): Note[] {
  const style = STYLES[genre];
  const guitarPatterns = instrumentId === "guitar" ? GUITAR_CHORD_PATTERNS[genre] : undefined;
  const patterns = guitarPatterns ? [...style.chordPatterns, ...guitarPatterns] : style.chordPatterns;
  return renderPatterns(patterns, chords, beatsPerBar, style.useSeventh, ceilings, lows);
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
    const measureEnd = (chord.bar + 1) * beatsPerBar;
    for (const event of pattern) {
      const pitches = event.tones.map((i) => stack[Math.min(i, stack.length - 1)]).sort((a, b) => a - b);
      const start = chord.bar * beatsPerBar + event.offset;
      let duration = event.duration;
      // Clamp duration to not exceed measure boundary (handles floating-point accumulation)
      if (start + duration > measureEnd) duration = measureEnd - start;
      notes.push({
        id: `b${id++}`,
        pitch: pitches[0],
        pitches: pitches.length > 1 ? pitches : undefined,
        start,
        duration,
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

