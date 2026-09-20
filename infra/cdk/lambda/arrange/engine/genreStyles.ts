import { triadPitchClasses } from "./chordProgression";
import type { ChordSymbol, Genre, Note } from "./types";

interface BarEvent {
  offset: number;
  duration: number;
  /** Scale index into the chord's [root, third, fifth, seventh] tones, or "root" shorthand */
  tones: number[];
}

interface GenreStyle {
  chordOctaveBase: number;
  bassOctaveBase: number;
  useSeventh: boolean;
  chordPattern: BarEvent[];
  bassPattern: BarEvent[];
}

const STYLES: Record<Genre, GenreStyle> = {
  jazz: {
    chordOctaveBase: 52,
    bassOctaveBase: 36,
    useSeventh: true,
    chordPattern: [
      { offset: 1, duration: 1, tones: [0, 1, 2, 3] },
      { offset: 3, duration: 1, tones: [0, 1, 2, 3] },
    ],
    bassPattern: [
      { offset: 0, duration: 1, tones: [0] },
      { offset: 1, duration: 1, tones: [2] },
      { offset: 2, duration: 1, tones: [0] },
      { offset: 3, duration: 1, tones: [2] },
    ],
  },
  rock: {
    chordOctaveBase: 48,
    bassOctaveBase: 36,
    useSeventh: false,
    chordPattern: [
      { offset: 0, duration: 2, tones: [0, 2] },
      { offset: 2, duration: 2, tones: [0, 2] },
    ],
    bassPattern: [
      { offset: 0, duration: 1, tones: [0] },
      { offset: 1, duration: 1, tones: [0] },
      { offset: 2, duration: 1, tones: [0] },
      { offset: 3, duration: 1, tones: [0] },
    ],
  },
  classical: {
    chordOctaveBase: 52,
    bassOctaveBase: 36,
    useSeventh: false,
    chordPattern: [{ offset: 0, duration: 4, tones: [0, 1, 2] }],
    bassPattern: [{ offset: 0, duration: 4, tones: [0] }],
  },
  samba: {
    chordOctaveBase: 52,
    bassOctaveBase: 36,
    useSeventh: true,
    chordPattern: [
      { offset: 0, duration: 0.5, tones: [0, 1, 2, 3] },
      { offset: 1.5, duration: 0.5, tones: [0, 1, 2, 3] },
      { offset: 2.5, duration: 1, tones: [0, 1, 2, 3] },
    ],
    bassPattern: [
      { offset: 0, duration: 1, tones: [0] },
      { offset: 1.5, duration: 1, tones: [2] },
      { offset: 3, duration: 1, tones: [0] },
    ],
  },
};

function chordToneStack(chord: ChordSymbol, octaveBase: number, useSeventh: boolean): number[] {
  const triad = triadPitchClasses(chord.root, chord.quality);
  const seventh = (chord.root + (chord.quality === "maj" ? 11 : 10)) % 12;
  const tones = useSeventh ? [...triad, seventh] : triad;
  return tones.map((pc) => octaveBase + pc + (pc < chord.root ? 12 : 0));
}

function renderPattern(
  pattern: BarEvent[],
  chords: ChordSymbol[],
  beatsPerBar: number,
  octaveBase: number,
  useSeventh: boolean,
): Note[] {
  const notes: Note[] = [];
  let id = 0;
  for (const chord of chords) {
    const stack = chordToneStack(chord, octaveBase, useSeventh);
    for (const event of pattern) {
      const pitches = event.tones.map((i) => stack[Math.min(i, stack.length - 1)]).sort((a, b) => a - b);
      notes.push({
        id: `n${id++}`,
        pitch: pitches[0],
        pitches: pitches.length > 1 ? pitches : undefined,
        start: chord.bar * beatsPerBar + event.offset,
        duration: event.duration,
        velocity: 90,
      });
    }
  }
  return notes;
}

export function renderChordsPart(chords: ChordSymbol[], genre: Genre, beatsPerBar: number): Note[] {
  const style = STYLES[genre];
  return renderPattern(style.chordPattern, chords, beatsPerBar, style.chordOctaveBase, style.useSeventh);
}

export function renderBassPart(chords: ChordSymbol[], genre: Genre, beatsPerBar: number): Note[] {
  const style = STYLES[genre];
  return renderPattern(style.bassPattern, chords, beatsPerBar, style.bassOctaveBase, false);
}
