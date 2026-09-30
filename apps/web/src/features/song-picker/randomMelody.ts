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
// This is a "theme" (テーマ) — something a beginner could sing back after one
// listen — not a solo/fill, so it should read as simple: mostly quarters and
// eighth-note pairs, an occasional half note to breathe, and only a rare
// sixteenth/triplet flourish rather than the two being anywhere near as
// common as a plain quarter. A first pass here weighted triplets/sixteenths
// almost as heavily as quarters, which produced a busy, non-singable line —
// clearly wrong for a "theme."
const RHYTHM_CELLS: number[][] = [
  [QUARTER],
  [QUARTER],
  [QUARTER],
  [QUARTER],
  [QUARTER],
  [HALF],
  [HALF],
  [EIGHTH, EIGHTH],
  [EIGHTH, EIGHTH],
  [EIGHTH, EIGHTH],
  [SIXTEENTH, SIXTEENTH, EIGHTH],
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
      // A theme should open on the tonic, not wherever the first random step
      // happens to land — only the walk from the SECOND note onward is
      // actually random.
      if (id > 0) {
        degree = Math.max(MIN_DEGREE, Math.min(MAX_DEGREE, degree + pick(STEP_CHOICES)));
      }
      const octave = Math.floor(degree / 7);
      const idx = ((degree % 7) + 7) % 7;
      const pitch = root + octave * 12 + scale[idx];
      notes.push({ id: `n${id++}`, pitch, start: t / TICKS_PER_BEAT, duration: ticks / TICKS_PER_BEAT, velocity: 100 });
      t += ticks;
    }
  }

  // An unconstrained random walk can end on any scale degree with whatever
  // short rhythm-cell duration happened to land last, which reads as
  // unresolved/still-going — not as a phrase actually ending. A real short
  // theme needs a clearly sustained final tonic. Replacing every note that
  // falls in the LAST bar with one single whole-bar tonic note (rather than
  // just overriding the final note's own pitch/duration, which a first pass
  // at this tried — the walk's last cell often lands on a short eighth or
  // sixteenth right at the very end, and stretching just that one note out
  // still reads oddly since it's still "one of several notes in a busy bar")
  // gives an unambiguous cadence: the whole last bar is nothing but one long
  // tonic note.
  const lastBarStart = (barCount - 1) * BEATS_PER_BAR;
  const keptNotes = notes.filter((n) => n.start < lastBarStart);
  const tonicDegree = Math.abs(degree - 0) <= Math.abs(degree - 7) ? 0 : 7;
  const finalPitch = root + Math.floor(tonicDegree / 7) * 12 + scale[0];
  keptNotes.push({
    id: `n${keptNotes.length}`,
    pitch: finalPitch,
    start: lastBarStart,
    duration: BEATS_PER_BAR,
    velocity: 100,
  });
  notes.length = 0;
  notes.push(...keptNotes);

  const keyLabel = `${PITCH_CLASS_NAMES[rootPitchClass]}${isMinor ? "moll" : "dur"}`;
  return { melody: { beatsPerBar: BEATS_PER_BAR, notes }, keyLabel };
}
