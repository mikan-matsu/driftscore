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

function rootMotionScore(fromRoot: number, toRoot: number): number {
  const interval = ((toRoot - fromRoot) % 12 + 12) % 12;
  // Strong root motion: down a 5th / up a 4th (7) or up a 5th / down a 4th (5)
  if (interval === 5 || interval === 7) return 2;
  if (interval === 0) return -3; // same chord as before — discourage when a real choice exists
  return 0;
}

/**
 * Picks one diatonic triad per bar: the triad whose chord tones cover the
 * most (duration-weighted, downbeat-emphasized) melody notes sounding in
 * that bar. Ties are broken by preferring strong root motion (4th/5th)
 * from the previous bar's chord instead of always collapsing to the tonic.
 */
export function estimateChordProgression(melody: Melody, key: EstimatedKey): ChordSymbol[] {
  const degrees = key.isMinor ? MINOR_DEGREES : MAJOR_DEGREES;
  const qualities = key.isMinor ? MINOR_QUALITIES : MAJOR_QUALITIES;

  const lastEnd = melody.notes.reduce((max, n) => Math.max(max, n.start + n.duration), 0);
  const barCount = Math.max(1, Math.ceil(lastEnd / melody.beatsPerBar));

  const chords: ChordSymbol[] = [];
  let prevRoot: number | null = null;

  for (let bar = 0; bar < barCount; bar++) {
    const barStart = bar * melody.beatsPerBar;
    const barEnd = barStart + melody.beatsPerBar;
    const weights = new Array(12).fill(0);
    for (const note of melody.notes) {
      const overlap = Math.min(note.start + note.duration, barEnd) - Math.max(note.start, barStart);
      if (overlap > 0) {
        const downbeatBonus = note.start <= barStart + 0.01 ? 1.5 : 1;
        weights[((note.pitch % 12) + 12) % 12] += overlap * downbeatBonus;
      }
    }

    const scored = degrees.map((degree, i) => {
      const rootPc = (key.root + degree) % 12;
      const tones = triadPitchClasses(rootPc, qualities[i]);
      const coverage = tones.reduce((sum, pc) => sum + weights[pc], 0);
      const motion = prevRoot === null ? 0 : rootMotionScore(prevRoot, rootPc);
      return { i, rootPc, coverage, total: coverage + motion * 0.1 };
    });

    scored.sort((a, b) => b.total - a.total);
    const best = scored[0];

    chords.push({ root: best.rootPc, quality: qualities[best.i], bar });
    prevRoot = best.rootPc;
  }
  return chords;
}
