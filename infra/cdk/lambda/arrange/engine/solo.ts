import { triadPitchClasses } from "./chordProgression";
import type { ChordSymbol, Note } from "./types";

interface SoloEvent {
  offset: number;
  duration: number;
  /** Index into the chord's [root, third, fifth, (seventh)] tone stack. Ignored when `rest` is set. */
  toneIndex: number;
  /** A phrasing rest — real solos breathe between ideas rather than filling every beat. */
  rest?: boolean;
}

// Genre-agnostic chord-tone patterns, cycled bar-by-bar like genreStyles.ts's
// comping patterns — deliberately simple (a real motif-based solo generator,
// with development/passing tones, is a future upgrade). Durations are
// restricted to what arrangementToMusicXml.ts's noteTypeAndDots() can
// actually notate (16th/8th/quarter/half/whole, plain or dotted), and each
// pattern still sums to one 4-beat bar (beatsPerBar is assumed 4 here, same
// assumption genreStyles.ts's own patterns already make).
//
// A wide mix on purpose: a solo section that's all running eighth notes
// reads as one long "タラララ" blur with no phrasing. Mixing in quarter-note
// and half-note long tones (a real soloist's way of "singing" a held note
// mid-line), syncopation, and rests (breathing room) is what actually makes
// it sound improvised rather than mechanically arpeggiated.
const SOLO_PATTERNS: SoloEvent[][] = [
  // Straight eighth-note arpeggio runs (a few different tone orders/contours).
  [
    { offset: 0, duration: 0.5, toneIndex: 0 },
    { offset: 0.5, duration: 0.5, toneIndex: 1 },
    { offset: 1, duration: 0.5, toneIndex: 2 },
    { offset: 1.5, duration: 0.5, toneIndex: 1 },
    { offset: 2, duration: 0.5, toneIndex: 0 },
    { offset: 2.5, duration: 0.5, toneIndex: 2 },
    { offset: 3, duration: 1, toneIndex: 0 },
  ],
  [
    { offset: 0, duration: 1, toneIndex: 2 },
    { offset: 1, duration: 0.5, toneIndex: 1 },
    { offset: 1.5, duration: 0.5, toneIndex: 0 },
    { offset: 2, duration: 0.5, toneIndex: 1 },
    { offset: 2.5, duration: 0.5, toneIndex: 2 },
    { offset: 3, duration: 0.5, toneIndex: 3 },
    { offset: 3.5, duration: 0.5, toneIndex: 2 },
  ],
  [
    { offset: 0, duration: 0.5, toneIndex: 3 },
    { offset: 0.5, duration: 0.5, toneIndex: 2 },
    { offset: 1, duration: 0.5, toneIndex: 1 },
    { offset: 1.5, duration: 0.5, toneIndex: 0 },
    { offset: 2, duration: 0.5, toneIndex: 1 },
    { offset: 2.5, duration: 0.5, toneIndex: 2 },
    { offset: 3, duration: 0.5, toneIndex: 3 },
    { offset: 3.5, duration: 0.5, toneIndex: 0 },
  ],
  // Swung dotted-eighth/sixteenth pairs.
  [
    { offset: 0, duration: 0.75, toneIndex: 0 },
    { offset: 0.75, duration: 0.25, toneIndex: 1 },
    { offset: 1, duration: 0.75, toneIndex: 2 },
    { offset: 1.75, duration: 0.25, toneIndex: 1 },
    { offset: 2, duration: 1, toneIndex: 3 },
    { offset: 3, duration: 1, toneIndex: 0 },
  ],
  [
    { offset: 0, duration: 0.25, toneIndex: 0 },
    { offset: 0.25, duration: 0.75, toneIndex: 2 },
    { offset: 1, duration: 0.25, toneIndex: 1 },
    { offset: 1.25, duration: 0.75, toneIndex: 3 },
    { offset: 2, duration: 0.5, toneIndex: 2 },
    { offset: 2.5, duration: 0.5, toneIndex: 1 },
    { offset: 3, duration: 1, toneIndex: 0 },
  ],
  // Long tones — a soloist holding a note, not constant motion.
  [{ offset: 0, duration: 4, toneIndex: 0 }],
  [
    { offset: 0, duration: 2, toneIndex: 2 },
    { offset: 2, duration: 2, toneIndex: 0 },
  ],
  [
    { offset: 0, duration: 3, toneIndex: 0 },
    { offset: 3, duration: 1, toneIndex: 1 },
  ],
  [
    { offset: 0, duration: 2, toneIndex: 1 },
    { offset: 2, duration: 0.5, toneIndex: 2 },
    { offset: 2.5, duration: 0.5, toneIndex: 1 },
    { offset: 3, duration: 1, toneIndex: 0 },
  ],
  [
    { offset: 0, duration: 0.5, toneIndex: 0 },
    { offset: 0.5, duration: 0.5, toneIndex: 2 },
    { offset: 1, duration: 2, toneIndex: 3 },
    { offset: 3, duration: 1, toneIndex: 2 },
  ],
  // Plain quarter notes — a calm, singable stretch between busier bars.
  [
    { offset: 0, duration: 1, toneIndex: 0 },
    { offset: 1, duration: 1, toneIndex: 1 },
    { offset: 2, duration: 1, toneIndex: 2 },
    { offset: 3, duration: 1, toneIndex: 3 },
  ],
  [
    { offset: 0, duration: 1, toneIndex: 2 },
    { offset: 1, duration: 1, toneIndex: 0 },
    { offset: 2, duration: 1.5, toneIndex: 1 },
    { offset: 3.5, duration: 0.5, toneIndex: 2 },
  ],
  // Syncopation and rests — phrasing room instead of filling every beat.
  [
    { offset: 0, duration: 0.5, toneIndex: 0, rest: true },
    { offset: 0.5, duration: 0.5, toneIndex: 0 },
    { offset: 1, duration: 1, toneIndex: 2 },
    { offset: 2, duration: 0.5, toneIndex: 0, rest: true },
    { offset: 2.5, duration: 0.5, toneIndex: 1 },
    { offset: 3, duration: 1, toneIndex: 3 },
  ],
  [
    { offset: 0, duration: 1.5, toneIndex: 0 },
    { offset: 1.5, duration: 0.5, toneIndex: 1 },
    { offset: 2, duration: 1, toneIndex: 0, rest: true },
    { offset: 3, duration: 1, toneIndex: 2 },
  ],
  [
    { offset: 0, duration: 1, toneIndex: 0, rest: true },
    { offset: 1, duration: 0.5, toneIndex: 3 },
    { offset: 1.5, duration: 0.5, toneIndex: 2 },
    { offset: 2, duration: 1.5, toneIndex: 1 },
    { offset: 3.5, duration: 0.5, toneIndex: 0 },
  ],
  [
    { offset: 0, duration: 0.5, toneIndex: 1 },
    { offset: 0.5, duration: 1.5, toneIndex: 0 },
    { offset: 2, duration: 0.5, toneIndex: 0, rest: true },
    { offset: 2.5, duration: 0.5, toneIndex: 2 },
    { offset: 3, duration: 0.5, toneIndex: 3 },
    { offset: 3.5, duration: 0.5, toneIndex: 2 },
  ],
  // Busier flourishes with a sixteenth-note turn, resolving to a longer tone.
  [
    { offset: 0, duration: 0.25, toneIndex: 0 },
    { offset: 0.25, duration: 0.25, toneIndex: 1 },
    { offset: 0.5, duration: 0.25, toneIndex: 2 },
    { offset: 0.75, duration: 0.25, toneIndex: 1 },
    { offset: 1, duration: 1, toneIndex: 0 },
    { offset: 2, duration: 2, toneIndex: 3 },
  ],
  [
    { offset: 0, duration: 2, toneIndex: 0 },
    { offset: 2, duration: 0.25, toneIndex: 1 },
    { offset: 2.25, duration: 0.25, toneIndex: 2 },
    { offset: 2.5, duration: 0.25, toneIndex: 3 },
    { offset: 2.75, duration: 0.25, toneIndex: 2 },
    { offset: 3, duration: 1, toneIndex: 0 },
  ],
  // Descending run into a held resolution.
  [
    { offset: 0, duration: 0.5, toneIndex: 3 },
    { offset: 0.5, duration: 0.5, toneIndex: 2 },
    { offset: 1, duration: 0.5, toneIndex: 1 },
    { offset: 1.5, duration: 0.5, toneIndex: 0 },
    { offset: 2, duration: 2, toneIndex: 0 },
  ],
  // Mixed dotted-quarter + eighth lilt, twice.
  [
    { offset: 0, duration: 1.5, toneIndex: 2 },
    { offset: 1.5, duration: 0.5, toneIndex: 1 },
    { offset: 2, duration: 1.5, toneIndex: 0 },
    { offset: 3.5, duration: 0.5, toneIndex: 2 },
  ],
];

/**
 * A chord-tone-based solo line over the given changes — the simplest
 * defensible stand-in for an improvised solo. Each tone resolves to the
 * octave nearest the previous note (same voice-leading approach as
 * countermelody.ts/genreStyles.ts's comping), so the line moves smoothly
 * rather than jumping registers on every event. Range folding/octave
 * placement is left to the caller (assignRoles' pickIdiomaticOctaveShift),
 * since the solo is meant to be played by the same instrument as the theme.
 *
 * `patternOffset` shifts where the bar-to-bar pattern cycle starts — pass a
 * different value per solo chorus (see songForm.ts) so repeated laps over
 * the same chord changes don't play the identical line every time.
 */
export function renderSolo(
  chords: ChordSymbol[],
  beatsPerBar: number,
  useSeventh: boolean,
  startingPitch: number,
  patternOffset = 0,
): Note[] {
  const notes: Note[] = [];
  let id = 0;
  let prev = startingPitch;

  chords.forEach((chord, barIndex) => {
    const triad = triadPitchClasses(chord.root, chord.quality);
    const seventh = (chord.root + (chord.quality === "maj" ? 11 : 10)) % 12;
    const tones = useSeventh ? [...triad, seventh] : triad;
    const pattern = SOLO_PATTERNS[(barIndex + patternOffset) % SOLO_PATTERNS.length];

    for (const event of pattern) {
      if (event.rest) continue;
      const pc = tones[Math.min(event.toneIndex, tones.length - 1)];
      const pitch = pc + 12 * Math.round((prev - pc) / 12);
      notes.push({
        id: `sl${id++}`,
        pitch,
        start: chord.bar * beatsPerBar + event.offset,
        duration: event.duration,
        velocity: 95,
      });
      prev = pitch;
    }
  });

  return notes;
}
