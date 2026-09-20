export type Role = "melody" | "harmony" | "bass";

export interface InstrumentDef {
  id: string;
  name: string;
  clef: "treble" | "bass";
  /** written pitch = sounding pitch + this many semitones */
  transposeSemitones: number;
  /** playable range, in sounding (concert) MIDI pitch */
  rangeLow: number;
  rangeHigh: number;
  polyphonic: boolean;
  roleAffinity: Role;
}

export const INSTRUMENTS: Record<string, InstrumentDef> = {
  lead: {
    id: "lead",
    name: "Lead",
    clef: "treble",
    transposeSemitones: 0,
    rangeLow: 55,
    rangeHigh: 96,
    polyphonic: false,
    roleAffinity: "melody",
  },
  piano: {
    id: "piano",
    name: "Piano (Chords)",
    clef: "treble",
    transposeSemitones: 0,
    rangeLow: 36,
    rangeHigh: 96,
    polyphonic: true,
    roleAffinity: "harmony",
  },
  electricBass: {
    id: "electricBass",
    name: "Bass",
    clef: "bass",
    transposeSemitones: 0,
    rangeLow: 28,
    rangeHigh: 60,
    polyphonic: false,
    roleAffinity: "bass",
  },
  clarinetBb: {
    id: "clarinetBb",
    name: "Clarinet in B♭",
    clef: "treble",
    transposeSemitones: 2,
    rangeLow: 50, // D3 sounding
    rangeHigh: 89, // F6 sounding
    polyphonic: false,
    roleAffinity: "melody",
  },
  trumpetBb: {
    id: "trumpetBb",
    name: "Trumpet in B♭",
    clef: "treble",
    transposeSemitones: 2,
    rangeLow: 54, // F#3 sounding
    rangeHigh: 82, // A5 sounding
    polyphonic: false,
    roleAffinity: "harmony",
  },
  hornF: {
    id: "hornF",
    name: "Horn in F",
    clef: "treble",
    transposeSemitones: 7,
    rangeLow: 41, // F2 sounding
    rangeHigh: 77, // F5 sounding
    polyphonic: false,
    roleAffinity: "harmony",
  },
  bassoon: {
    id: "bassoon",
    name: "Bassoon",
    clef: "bass",
    transposeSemitones: 0,
    rangeLow: 34, // Bb1 sounding
    rangeHigh: 75, // Eb5 sounding
    polyphonic: false,
    roleAffinity: "bass",
  },
  guitar: {
    id: "guitar",
    name: "Guitar",
    clef: "treble",
    transposeSemitones: 12, // notated an octave above sounding pitch
    rangeLow: 40, // E2 sounding
    rangeHigh: 88, // E6 sounding
    polyphonic: true,
    roleAffinity: "harmony",
  },
  trumpetBb2: {
    id: "trumpetBb2",
    name: "Trumpet in B♭ 2",
    clef: "treble",
    transposeSemitones: 2,
    rangeLow: 54, // F#3 sounding
    rangeHigh: 82, // A5 sounding
    polyphonic: false,
    roleAffinity: "harmony",
  },
  trombone: {
    id: "trombone",
    name: "Trombone",
    clef: "bass",
    transposeSemitones: 0,
    rangeLow: 40, // E2 sounding
    rangeHigh: 72, // C5 sounding
    polyphonic: false,
    roleAffinity: "harmony",
  },
  tuba: {
    id: "tuba",
    name: "Tuba",
    clef: "bass",
    transposeSemitones: 0,
    rangeLow: 28, // E1 sounding
    rangeHigh: 58, // Bb3 sounding
    polyphonic: false,
    roleAffinity: "bass",
  },
};
