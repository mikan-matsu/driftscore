import type { Melody, Note } from "./types";

/**
 * Applies light, probabilistic embellishment to a melody based on the
 * 0-100 distortion amount: splits some notes into a passing-tone pair,
 * and turns a few short notes into rests for breathing room ("tame").
 * Deterministic per call is not guaranteed (uses Math.random) — this is
 * meant to feel different each time you generate, like a real player
 * improvising slightly differently.
 */
export function embellishMelody(melody: Melody, distortion: number): Melody {
  const p = Math.max(0, Math.min(100, distortion)) / 100;
  const notes: Note[] = [];
  let id = 0;

  for (let i = 0; i < melody.notes.length; i++) {
    const note = melody.notes[i];
    const next = melody.notes[i + 1];

    if (note.duration >= 1 && Math.random() < p * 0.35) {
      const half = note.duration / 2;
      const direction = next && next.pitch < note.pitch ? -1 : 1;
      const passingPitch = note.pitch + direction;
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
