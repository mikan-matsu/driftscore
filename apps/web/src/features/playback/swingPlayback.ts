"use client";

import type { Note } from "@/features/piano-roll";

/**
 * Reshapes even eighth-note pairs (on-the-beat 8th + off-beat 8th) into a
 * swung long-short feel for PLAYBACK timing only.
 *
 * This mirrors what used to be a server-side engine transform
 * (infra/cdk/lambda/arrange/engine/swing.ts, now removed) that baked the
 * swung durations directly into the notes used for both notation and
 * audio. That made the score itself show dotted-8th+16th rhythms
 * everywhere — not how a real jazz chart is written. A real chart notates
 * straight eighths and adds a "Swing" marking (see arrangementToMusicXml's
 * wordsXml for jazz arrangements): the notation stays even, and swing is
 * purely an interpretation applied at playback time. Moving the transform
 * here (used only to compute Tone.Transport scheduling times, never fed
 * back into the notes rendered as MusicXML) reproduces that same
 * separation. Only touches pairs that start exactly on a beat and both
 * last a plain eighth — triplets, syncopated off-beat hits, and longer
 * notes are left alone, exactly as before.
 *
 * SWING_RATIO is 2:1 (a genuine swung/shuffle triplet feel — "♫ = ♩³♪",
 * the standard real-chart shuffle marking: an eighth-note pair played as
 * the first two-thirds and the last third of a triplet), not the earlier
 * 3:1 (dotted-8th + 16th) this used to use. 3:1 is a real notated rhythm in
 * its own right (a "hard shuffle"/shuffle-boogie feel) but is a more
 * exaggerated bounce than plain jazz swing calls for — confirmed against a
 * real reference chart's own "♩ = 132 Shuffle (♫ = ♩³♪)" marking, which
 * spells out the 2:1 triplet equivalence explicitly rather than leaving it
 * to a generic "Swing" label.
 */
const SWING_RATIO = 2 / 3; // first note's share of the beat; second gets the remaining 1/3

export function swingForPlayback(notes: Note[]): Note[] {
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
        result.push({ ...note, duration: SWING_RATIO });
        result.push({ ...sorted[partnerIndex], start: note.start + SWING_RATIO, duration: 1 - SWING_RATIO });
        consumed.add(partnerIndex);
        continue;
      }
    }
    result.push(note);
  }

  return result;
}
