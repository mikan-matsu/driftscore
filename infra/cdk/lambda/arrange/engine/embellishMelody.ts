import type { EstimatedKey } from "./keyEstimation";
import { scalePitchClasses } from "./keyEstimation";
import type { Melody, Note } from "./types";

/** Steps by semitone from `pitch` in `direction` until it lands on a pitch class in `scale`. */
function nearestScaleTone(pitch: number, direction: 1 | -1, scale: Set<number>): number {
  let p = pitch;
  for (let i = 0; i < 12; i++) {
    p += direction;
    if (scale.has(((p % 12) + 12) % 12)) return p;
  }
  return pitch + direction;
}

/**
 * Applies light, probabilistic embellishment to a melody based on the
 * 0-100 distortion amount: splits some notes into a passing-tone pair,
 * and turns a few short notes into rests for breathing room ("tame").
 * Passing tones stay diatonic to the estimated key, so they don't clash
 * against the underlying chord as a stray chromatic note would.
 * Deterministic per call is not guaranteed (uses Math.random) — this is
 * meant to feel different each time you generate, like a real player
 * improvising slightly differently.
 */
export function embellishMelody(melody: Melody, distortion: number, key: EstimatedKey): Melody {
  const p = Math.max(0, Math.min(100, distortion)) / 100;
  const scale = scalePitchClasses(key);
  const notes: Note[] = [];
  let id = 0;

  for (let i = 0; i < melody.notes.length; i++) {
    const note = melody.notes[i];
    const next = melody.notes[i + 1];

    if (note.duration >= 1 && Math.random() < p * 0.35) {
      const half = note.duration / 2;
      const direction = next && next.pitch < note.pitch ? -1 : 1;
      const passingPitch = nearestScaleTone(note.pitch, direction, scale);
      notes.push({ id: `n${id++}`, pitch: note.pitch, start: note.start, duration: half, velocity: note.velocity });
      notes.push({
        id: `n${id++}`,
        pitch: passingPitch,
        start: note.start + half,
        duration: half,
        velocity: note.velocity,
      });
      continue;
    }

    if (note.duration === 1 && Math.random() < p * 0.15) {
      // rest instead of a note — creates a small "break"
      continue;
    }

    notes.push({ ...note, id: `n${id++}` });
  }

  return { beatsPerBar: melody.beatsPerBar, notes };
}
