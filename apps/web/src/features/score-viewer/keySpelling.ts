import type { Melody } from "@/features/piano-roll";

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

export interface KeyEstimate {
  /** Pitch class 0-11 */
  root: number;
  isMinor: boolean;
}

/**
 * Same simplified key estimation as the arrangement engine's
 * keyEstimation.ts (duplicated rather than shared — apps/web and the Lambda
 * are separate build targets with no shared package): scores each of the 24
 * major/minor keys by how much note duration falls on in-scale pitch
 * classes, picks the best match.
 */
export function estimateKey(melody: Melody): KeyEstimate {
  const histogram = new Array(12).fill(0);
  for (const note of melody.notes) {
    histogram[((note.pitch % 12) + 12) % 12] += note.duration;
  }

  let bestRoot = 0;
  let bestIsMinor = false;
  let bestScore = -Infinity;
  for (let root = 0; root < 12; root++) {
    for (const isMinor of [false, true]) {
      const intervals = isMinor ? MINOR_INTERVALS : MAJOR_INTERVALS;
      const scale = new Set(intervals.map((iv) => (root + iv) % 12));
      let score = 0;
      for (let pc = 0; pc < 12; pc++) {
        score += scale.has(pc) ? histogram[pc] : -histogram[pc] * 0.5;
      }
      if (score > bestScore) {
        bestScore = score;
        bestRoot = root;
        bestIsMinor = isMinor;
      }
    }
  }
  return { root: bestRoot, isMinor: bestIsMinor };
}

// Major-key root (pitch class) -> fifths, picking whichever enharmonic
// spelling has fewer accidentals (e.g. Db major's 5 flats over C# major's 7
// sharps) — the only choice that covers all 12 pitch classes without
// ambiguity or gaps.
const MAJOR_ROOT_TO_FIFTHS: Record<number, number> = {
  0: 0, // C
  7: 1, // G
  2: 2, // D
  9: 3, // A
  4: 4, // E
  11: 5, // B
  6: 6, // F#
  1: -5, // Db
  8: -4, // Ab
  3: -3, // Eb
  10: -2, // Bb
  5: -1, // F
};

/** MusicXML `<fifths>` value for a key (positive = sharps, negative = flats). Minor keys use their relative major's fifths (e.g. A minor = C major = 0). */
export function fifthsForKey(key: KeyEstimate): number {
  const majorRoot = key.isMinor ? (key.root + 3) % 12 : key.root;
  return MAJOR_ROOT_TO_FIFTHS[majorRoot];
}

const LETTER_NATURAL_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

export interface Spelling {
  step: string;
  /** Semitone alteration from the natural letter: -1 flat, 0 natural, +1 sharp. */
  alter: number;
}

/**
 * Spells every one of the 12 chromatic pitch classes for a given key
 * signature (`fifths`, from fifthsForKey), matching how a real score
 * notates them: the 7 diatonic scale members use whichever letter+alter the
 * key signature itself implies (so they need NO accidental — OSMD compares
 * against the declared `<key><fifths>` to decide that), and the 5
 * non-diatonic chromatic pitch classes are spelled as a sharp of the
 * diatonic step below (sharp-side keys) or a flat of the diatonic step
 * above (flat-side keys) — the standard convention, simplified to not
 * depend on melodic direction.
 *
 * Building this from `fifths` (rather than hardcoding one fixed sharps-only
 * spelling table for all 12 pitch classes regardless of key, which is what
 * this codebase did before) is what actually avoids the wall of accidentals
 * a real notation program would never produce — e.g. a piece in C minor (3
 * flats: Eb, Ab, Bb) should show that 3-flat key signature once at the
 * clef, with those 3 notes needing no per-note accidental at all.
 */
export function buildKeySpellingTable(fifths: number): Record<number, Spelling> {
  const alterByLetter: Record<string, number> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  if (fifths > 0) {
    for (let i = 0; i < fifths; i++) alterByLetter[SHARP_ORDER[i]] = 1;
  } else if (fifths < 0) {
    for (let i = 0; i < -fifths; i++) alterByLetter[FLAT_ORDER[i]] = -1;
  }

  const diatonicByPc = new Map<number, Spelling>();
  for (const [letter, naturalPc] of Object.entries(LETTER_NATURAL_PC)) {
    const alter = alterByLetter[letter];
    const pc = ((naturalPc + alter) % 12 + 12) % 12;
    diatonicByPc.set(pc, { step: letter, alter });
  }

  const table: Record<number, Spelling> = {};
  for (let pc = 0; pc < 12; pc++) {
    const diatonic = diatonicByPc.get(pc);
    if (diatonic) {
      table[pc] = diatonic;
      continue;
    }
    const neighborPc = fifths >= 0 ? ((pc - 1 + 12) % 12) : (pc + 1) % 12;
    const neighbor = diatonicByPc.get(neighborPc);
    // Every non-diatonic pitch class in a real major/minor key signature is
    // adjacent to a diatonic one on exactly the side this looks at — this
    // fallback is just a safety net, never expected to fire.
    table[pc] = neighbor
      ? { step: neighbor.step, alter: neighbor.alter + (fifths >= 0 ? 1 : -1) }
      : { step: "C", alter: 0 };
  }
  return table;
}
