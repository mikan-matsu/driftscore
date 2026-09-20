import type { Melody } from "./types";

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

export interface EstimatedKey {
  /** Pitch class 0-11 */
  root: number;
  isMinor: boolean;
}

/**
 * Simplified key estimation: scores each of the 24 major/minor keys by how
 * much note duration falls on in-scale pitch classes (with a penalty for
 * out-of-scale notes), and picks the best match. Not a full
 * Krumhansl-Schmuckler implementation, but good enough for diatonic
 * melodies.
 */
export function estimateKey(melody: Melody): EstimatedKey {
  const histogram = new Array(12).fill(0);
  for (const note of melody.notes) {
    histogram[((note.pitch % 12) + 12) % 12] += note.duration;
  }

  let best: EstimatedKey & { score: number } = { root: 0, isMinor: false, score: -Infinity };
  for (let root = 0; root < 12; root++) {
    for (const isMinor of [false, true]) {
      const intervals = isMinor ? MINOR_INTERVALS : MAJOR_INTERVALS;
      const scale = new Set(intervals.map((iv) => (root + iv) % 12));
      let score = 0;
      for (let pc = 0; pc < 12; pc++) {
        score += scale.has(pc) ? histogram[pc] : -histogram[pc] * 0.5;
      }
      if (score > best.score) {
        best = { root, isMinor, score };
      }
    }
  }
  return { root: best.root, isMinor: best.isMinor };
}
