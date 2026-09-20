import type { ChordQuality, ChordSymbol, Melody } from "./types";
import type { EstimatedKey } from "./keyEstimation";

const MAJOR_DEGREES = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_QUALITIES: ChordQuality[] = ["maj", "min", "min", "maj", "maj", "min", "dim"];
const MINOR_DEGREES = [0, 2, 3, 5, 7, 8, 10];
const MINOR_QUALITIES: ChordQuality[] = ["min", "dim", "maj", "min", "min", "maj", "maj"];

export function triadPitchClasses(rootPitchClass: number, quality: ChordQuality): number[] {
  const third = quality === "maj" ? 4 : 3;
  const fifth = quality === "dim" ? 6 : 7;
  return [rootPitchClass, (rootPitchClass + third) % 12, (rootPitchClass + fifth) % 12];
}

/**
 * Picks one diatonic triad per bar: the triad whose chord tones cover the
 * most (duration-weighted) melody notes sounding in that bar.
 */
export function estimateChordProgression(melody: Melody, key: EstimatedKey): ChordSymbol[] {
  const degrees = key.isMinor ? MINOR_DEGREES : MAJOR_DEGREES;
  const qualities = key.isMinor ? MINOR_QUALITIES : MAJOR_QUALITIES;

  const lastEnd = melody.notes.reduce((max, n) => Math.max(max, n.start + n.duration), 0);
  const barCount = Math.max(1, Math.ceil(lastEnd / melody.beatsPerBar));

  const chords: ChordSymbol[] = [];
  for (let bar = 0; bar < barCount; bar++) {
    const barStart = bar * melody.beatsPerBar;
    const barEnd = barStart + melody.beatsPerBar;
    const weights = new Array(12).fill(0);
    for (const note of melody.notes) {
      const overlap = Math.min(note.start + note.duration, barEnd) - Math.max(note.start, barStart);
      if (overlap > 0) {
        weights[((note.pitch % 12) + 12) % 12] += overlap;
      }
    }

    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < 7; i++) {
      const rootPc = (key.root + degrees[i]) % 12;
      const tones = triadPitchClasses(rootPc, qualities[i]);
      const score = tones.reduce((sum, pc) => sum + weights[pc], 0);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    chords.push({
      root: (key.root + degrees[bestIndex]) % 12,
      quality: qualities[bestIndex],
      bar,
    });
  }
  return chords;
}
