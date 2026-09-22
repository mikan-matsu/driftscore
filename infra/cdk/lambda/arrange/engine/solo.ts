import { triadPitchClasses } from "./chordProgression";
import type { ChordSymbol, Note } from "./types";

interface SoloEvent {
  offset: number;
  duration: number;
  /** Index into the chord's [root, third, fifth, (seventh)] tone stack. */
  toneIndex: number;
}

// Genre-agnostic chord-tone arpeggio templates, cycled bar-by-bar like
// genreStyles.ts's comping patterns — deliberately simple (a real motif-based
// solo generator, with development/passing tones, is a future upgrade).
const SOLO_PATTERNS: SoloEvent[][] = [
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
    { offset: 0, duration: 0.75, toneIndex: 0 },
    { offset: 0.75, duration: 0.25, toneIndex: 1 },
    { offset: 1, duration: 0.75, toneIndex: 2 },
    { offset: 1.75, duration: 0.25, toneIndex: 1 },
    { offset: 2, duration: 1, toneIndex: 3 },
    { offset: 3, duration: 1, toneIndex: 0 },
  ],
];

/**
 * A simple chord-tone-arpeggio solo line over the given changes — the
 * simplest defensible stand-in for an improvised solo. Each tone resolves to
 * the octave nearest the previous note (same voice-leading approach as
 * countermelody.ts/genreStyles.ts's comping), so the line moves smoothly
 * rather than jumping registers on every event. Range folding/octave
 * placement is left to the caller (assignRoles' pickIdiomaticOctaveShift),
 * since the solo is meant to be played by the same instrument as the theme.
 */
export function renderSolo(chords: ChordSymbol[], beatsPerBar: number, useSeventh: boolean, startingPitch: number): Note[] {
  const notes: Note[] = [];
  let id = 0;
  let prev = startingPitch;

  chords.forEach((chord, barIndex) => {
    const triad = triadPitchClasses(chord.root, chord.quality);
    const seventh = (chord.root + (chord.quality === "maj" ? 11 : 10)) % 12;
    const tones = useSeventh ? [...triad, seventh] : triad;
    const pattern = SOLO_PATTERNS[barIndex % SOLO_PATTERNS.length];

    for (const event of pattern) {
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
