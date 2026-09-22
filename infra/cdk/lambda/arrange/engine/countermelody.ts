import { triadPitchClasses } from "./chordProgression";
import type { ChordSymbol, Note } from "./types";

/**
 * A simple call-and-response countermelody: a short answering figure (chord
 * third then fifth, voice-led from the previous answer) that fills the
 * melody's rests, rather than an independently-composed line running
 * alongside it. Deliberately scoped down from a full independent
 * countermelody (its own rhythm/harmonic logic irrespective of the main
 * line) — this only speaks when the melody doesn't, which is also what
 * keeps it from being present constantly: real rests are intermittent by
 * nature, so this texture comes and goes with the melody's own phrasing.
 * Only fills rests within [activeFromBeat, activeUntilBeat), since the
 * caller reserves this texture for one section of the piece (see
 * assignRoles.ts) rather than running it the whole way through — a long
 * rest before activeFromBeat (e.g. a song-form intro with no melody at all)
 * must not be read as one giant gap to fill.
 */
export function renderCountermelody(
  melodyNotes: Note[],
  chords: ChordSymbol[],
  beatsPerBar: number,
  activeUntilBeat: number,
  startingPitch: number,
  activeFromBeat = 0,
): Note[] {
  const sorted = [...melodyNotes].sort((a, b) => a.start - b.start);
  const notes: Note[] = [];
  let id = 0;
  let cursor = activeFromBeat;
  let prev = startingPitch;

  const fillGap = (gapStart: number, gapEnd: number) => {
    // Too short for a legible answering figure — a fragment shorter than
    // this reads as clutter, not a phrase.
    if (gapEnd - gapStart < 1.5 || chords.length === 0) return;
    const chord = chords[Math.min(chords.length - 1, Math.floor(gapStart / beatsPerBar))];
    const triad = triadPitchClasses(chord.root, chord.quality); // [root, third, fifth]
    const motif = [triad[1], triad[2]]; // a simple rising third-then-fifth answer
    const noteDur = Math.min(0.5, (gapEnd - gapStart - 0.5) / motif.length);
    if (noteDur <= 0) return;
    let t = gapStart + 0.25; // a breath after the melody note ends, before answering
    for (const pc of motif) {
      if (t + noteDur > gapEnd) break;
      const pitch = pc + 12 * Math.round((prev - pc) / 12);
      notes.push({ id: `cm${id++}`, pitch, start: t, duration: noteDur, velocity: 75 });
      prev = pitch;
      t += noteDur;
    }
  };

  for (const n of sorted) {
    if (n.start >= activeUntilBeat) break;
    fillGap(cursor, Math.min(n.start, activeUntilBeat));
    cursor = Math.max(cursor, n.start + n.duration);
  }
  // The rest between the last melody note before the boundary and the
  // boundary itself — otherwise dropped, since the loop above stops as soon
  // as it sees the next note starting at/past activeUntilBeat, without ever
  // filling the gap that leads up to it.
  fillGap(cursor, activeUntilBeat);
  return notes;
}
