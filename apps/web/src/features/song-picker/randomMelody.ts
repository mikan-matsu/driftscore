import type { Melody, Note } from "@/features/piano-roll";

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
// Natural minor (Aeolian) — see presetSongs.ts's own NATURAL_MINOR_SCALE for
// the same interval set; duplicated here rather than imported since
// song-picker and its random-melody generator have no existing dependency on
// presetSongs.ts's internals.
const NATURAL_MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
const PITCH_CLASS_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Small steps most of the time (like a real singable tune), an occasional
// bigger leap, weighted by repetition rather than an explicit probability
// table — simplest way to express "mostly stepwise, rarely a big jump."
const STEP_CHOICES = [-2, -1, -1, 0, 1, 1, 2, 2, 3, -3];
const BEATS_PER_BAR = 4;
// Keeps the random walk within about 1.5 octaves either side of the root —
// wide enough for a real melodic contour, narrow enough to stay singable.
const MIN_DEGREE = -3;
const MAX_DEGREE = 10;

// Whole-number ticks per beat, not fractional beats directly — a triplet
// eighth note is 1/3 of a beat, which JS floats can't represent exactly, so
// accumulating many of them via repeated float addition (the old `t += duration`
// loop) would drift further off-grid with every triplet used. 12 is the
// smallest number divisible by both 4 (sixteenth notes) and 3 (triplet
// eighths), so every duration below is an exact integer number of ticks;
// only the final conversion to beats (ticks / TICKS_PER_BEAT, done once per
// note, never accumulated) carries any float imprecision, matching
// melodyToMusicXml.ts's own TRIPLET_EIGHTH_BEATS = 1/3 exactly.
const TICKS_PER_BEAT = 12;
const SIXTEENTH = TICKS_PER_BEAT / 4;
const TRIPLET_EIGHTH = TICKS_PER_BEAT / 3;
const EIGHTH = TICKS_PER_BEAT / 2;
const QUARTER = TICKS_PER_BEAT;
const HALF = TICKS_PER_BEAT * 2;

// Each entry is a short rhythmic "cell" — one or more consecutive note
// durations (in ticks) placed back to back, each getting its own fresh
// random-walk pitch. Picking whole cells (not single durations) is what
// makes a sixteenth or triplet actually read as a recognizable rhythmic
// figure instead of a single oddly-short note stranded among quarters.
// Weighted by repetition: quarter-heavy like before, with eighths/sixteenths/
// triplets now genuinely in the mix rather than absent entirely.
const RHYTHM_CELLS: number[][] = [
  [QUARTER],
  [QUARTER],
  [QUARTER],
  [HALF],
  [EIGHTH, EIGHTH],
  [EIGHTH, EIGHTH],
  [SIXTEENTH, SIXTEENTH, EIGHTH],
  [EIGHTH, SIXTEENTH, SIXTEENTH],
  [SIXTEENTH, SIXTEENTH, SIXTEENTH, SIXTEENTH],
  [TRIPLET_EIGHTH, TRIPLET_EIGHTH, TRIPLET_EIGHTH],
];

function pick<T>(choices: T[]): T {
  return choices[Math.floor(Math.random() * choices.length)];
}

export interface RandomMelodyResult {
  melody: Melody;
  /** e.g. "Cdur" / "Amoll" — the dur/moll (major/minor) convention this
   * project's Japanese music-education background uses, not English
   * "major"/"minor" — so the generated theme's key is actually visible
   * instead of silently always being an unlabeled C major. */
  keyLabel: string;
}

/**
 * Generates a plausible, always-available melody (default 8 bars) via a
 * weighted random walk over a diatonic scale, for a user who doesn't want to
 * pick a preset song or (eventually) hum/input their own — not meant to be
 * "good" composition, just a quick, no-decision-required starting point to
 * arrange. Root pitch class and major/minor are both randomized per call (a
 * fixed "always C major" would make the key label above pointless); the
 * /arrange API's own key transposition option (see ArrangeOptions.keyRoot)
 * covers changing the key again afterward regardless of what's picked here.
 */
export function generateRandomMelody(barCount = 8): RandomMelodyResult {
  const rootPitchClass = Math.floor(Math.random() * 12);
  const isMinor = Math.random() < 0.5;
  const scale = isMinor ? NATURAL_MINOR_SCALE : MAJOR_SCALE;
  const root = 60 + rootPitchClass; // C4-B4, i.e. one octave from the walk's own root
  const totalTicks = BEATS_PER_BAR * barCount * TICKS_PER_BEAT;
  const notes: Note[] = [];
  let degree = 0;
  let t = 0; // ticks
  let id = 0;

  while (t < totalTicks) {
    const remaining = totalTicks - t;
    let cell = pick(RHYTHM_CELLS);
    const cellTotal = cell.reduce((sum, ticks) => sum + ticks, 0);
    // Every cell's total is a multiple of EIGHTH ticks, so `remaining` always
    // is too — filling any leftover room with plain eighths, rather than
    // dropping/clamping the picked cell, guarantees the bar comes out exactly
    // right without ever truncating a triplet group mid-way (which would
    // break its 3-in-the-space-of-2 ratio and misrender the tuplet bracket).
    if (cellTotal > remaining) {
      cell = new Array(remaining / EIGHTH).fill(EIGHTH);
    }
    for (const ticks of cell) {
      degree = Math.max(MIN_DEGREE, Math.min(MAX_DEGREE, degree + pick(STEP_CHOICES)));
      const octave = Math.floor(degree / 7);
      const idx = ((degree % 7) + 7) % 7;
      const pitch = root + octave * 12 + scale[idx];
      notes.push({ id: `n${id++}`, pitch, start: t / TICKS_PER_BEAT, duration: ticks / TICKS_PER_BEAT, velocity: 100 });
      t += ticks;
    }
  }

  // An unconstrained random walk can end on any scale degree, which reads as
  // unresolved/unfinished — a real short theme almost always cadences back to
  // the tonic at the end. Overriding just the LAST note's pitch to the
  // nearest-octave tonic (scale degree 0, i.e. whichever of degree 0 or 7 is
  // closer to where the walk actually ended up) gives that resolved feel
  // without needing to constrain the whole walk. Both 0 and 7 are always
  // within [MIN_DEGREE, MAX_DEGREE] (-3..10), so this never needs clamping.
  const lastNote = notes[notes.length - 1];
  if (lastNote) {
    const tonicDegree = Math.abs(degree - 0) <= Math.abs(degree - 7) ? 0 : 7;
    lastNote.pitch = root + Math.floor(tonicDegree / 7) * 12 + scale[0];
  }

  const keyLabel = `${PITCH_CLASS_NAMES[rootPitchClass]}${isMinor ? "moll" : "dur"}`;
  return { melody: { beatsPerBar: BEATS_PER_BAR, notes }, keyLabel };
}
