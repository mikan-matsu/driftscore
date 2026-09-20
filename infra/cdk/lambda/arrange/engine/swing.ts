import type { Note } from "./types";

/**
 * Reshapes even eighth-note pairs (on-the-beat 8th + off-beat 8th) into a
 * swung long-short feel (dotted-8th + 16th), the way jazz eighths are
 * actually played even though they're written straight. Only touches pairs
 * that start exactly on a beat and both last a plain eighth — triplets,
 * syncopated off-beat hits, and longer notes are left alone.
 */
export function applySwing(notes: Note[]): Note[] {
  const sorted = [...notes].sort((a, b) => a.start - b.start);
  const result: Note[] = [];
  const consumed = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (consumed.has(i)) continue;
    const note = sorted[i];
    const onBeatEighth = Math.abs(note.start % 1) < 1e-6 && Math.abs(note.duration - 0.5) < 1e-6;

    if (onBeatEighth) {
      const partnerIndex = sorted.findIndex(
        (m, j) => j > i && !consumed.has(j) && Math.abs(m.start - (note.start + 0.5)) < 1e-6,
      );
      if (partnerIndex !== -1 && Math.abs(sorted[partnerIndex].duration - 0.5) < 1e-6) {
        result.push({ ...note, duration: 0.75 });
        result.push({ ...sorted[partnerIndex], start: note.start + 0.75, duration: 0.25 });
        consumed.add(partnerIndex);
        continue;
      }
    }
    result.push(note);
  }

  return result;
}
