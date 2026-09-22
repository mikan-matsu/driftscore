import type { EstimatedKey } from "./keyEstimation";
import type { Melody, Note } from "./types";

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

/**
 * The diatonic interval (in semitones, negative) from the scale degree
 * nearest to `pitch` down to the scale degree two steps below it — i.e. a
 * diatonic third, sized major or minor depending on where in the scale it
 * falls, the way a real harmony singer/player would pick it rather than a
 * fixed chromatic interval. Chromatic passing tones (from embellishMelody)
 * get the interval of their nearest diatonic neighbor, which keeps the
 * harmony line moving in parallel rather than snapping oddly.
 */
function diatonicThirdBelowOffset(pitch: number, key: EstimatedKey): number {
  const intervals = key.isMinor ? MINOR_INTERVALS : MAJOR_INTERVALS;
  const pc = ((pitch % 12) + 12) % 12;

  let nearestIdx = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < intervals.length; i++) {
    const degreePc = (key.root + intervals[i]) % 12;
    const dist = Math.min((pc - degreePc + 12) % 12, (degreePc - pc + 12) % 12);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIdx = i;
    }
  }

  const targetIdx = nearestIdx - 2 >= 0 ? nearestIdx - 2 : nearestIdx - 2 + 7;
  const octaveAdjust = nearestIdx - 2 >= 0 ? 0 : -12;
  return intervals[targetIdx] + octaveAdjust - intervals[nearestIdx];
}

/**
 * A parallel harmony line a diatonic third below the melody, following its
 * exact rhythm — the simplest, most common form of "ハモリ" (close two-part
 * harmony, as in hymn alto lines or bluegrass duets). Independent
 * countermelody (its own rhythm/contour) is a separate, not-yet-built
 * feature; this only shadows the given melody.
 */
export function renderParallelHarmony(melody: Melody, key: EstimatedKey): Melody {
  const notes: Note[] = melody.notes.map((n, i) => ({
    id: `ph${i}`,
    pitch: n.pitch + diatonicThirdBelowOffset(n.pitch, key),
    start: n.start,
    duration: n.duration,
    velocity: Math.round(n.velocity * 0.85),
  }));
  return { beatsPerBar: melody.beatsPerBar, notes };
}
