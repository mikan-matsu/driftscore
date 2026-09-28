import type { Melody, Note } from "@/features/piano-roll";

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

// Small steps most of the time (like a real singable tune), an occasional
// bigger leap, weighted by repetition rather than an explicit probability
// table — simplest way to express "mostly stepwise, rarely a big jump."
const STEP_CHOICES = [-2, -1, -1, 0, 1, 1, 2, 2, 3, -3];
// Weighted toward quarter notes, with half notes for occasional breathing room.
const DURATION_CHOICES = [1, 1, 1, 2];
const BEATS_PER_BAR = 4;
const BAR_COUNT = 8;
// Keeps the random walk within about 1.5 octaves either side of the root —
// wide enough for a real melodic contour, narrow enough to stay singable.
const MIN_DEGREE = -3;
const MAX_DEGREE = 10;

function pick<T>(choices: T[]): T {
  return choices[Math.floor(Math.random() * choices.length)];
}

/**
 * Generates a plausible, always-available 8-bar melody via a weighted
 * random walk over a diatonic major scale, for a user who doesn't want to
 * pick a preset song or (eventually) hum/input their own — not meant to be
 * "good" composition, just a quick, no-decision-required starting point to
 * arrange. Root is fixed at C4; the /arrange API's own key transposition
 * option (see ArrangeOptions.keyRoot) covers changing that afterward.
 */
export function generateRandomMelody(): Melody {
  const root = 60; // C4
  const totalBeats = BEATS_PER_BAR * BAR_COUNT;
  const notes: Note[] = [];
  let degree = 0;
  let t = 0;
  let id = 0;

  while (t < totalBeats) {
    degree = Math.max(MIN_DEGREE, Math.min(MAX_DEGREE, degree + pick(STEP_CHOICES)));
    const octave = Math.floor(degree / 7);
    const idx = ((degree % 7) + 7) % 7;
    const pitch = root + octave * 12 + MAJOR_SCALE[idx];
    const duration = Math.min(pick(DURATION_CHOICES), totalBeats - t);
    notes.push({ id: `n${id++}`, pitch, start: t, duration, velocity: 100 });
    t += duration;
  }

  return { beatsPerBar: BEATS_PER_BAR, notes };
}
