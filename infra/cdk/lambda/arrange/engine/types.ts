export interface Note {
  id: string;
  /** Primary/lowest pitch (MIDI note number) */
  pitch: number;
  /** If set, a stacked chord voicing sounding together for `duration` */
  pitches?: number[];
  start: number;
  duration: number;
  velocity: number;
}

export interface Melody {
  notes: Note[];
  beatsPerBar: number;
}

export type Genre = "jazz" | "rock" | "classical" | "samba";

export type ChordQuality = "maj" | "min" | "dim";

export interface ChordSymbol {
  /** Pitch class 0-11 */
  root: number;
  quality: ChordQuality;
  bar: number;
}

export interface ArrangementPart {
  id: string;
  name: string;
  clef: "treble" | "bass" | "percussion";
  /** written pitch = sounding pitch + this many semitones */
  transposeSemitones: number;
  polyphonic: boolean;
  melody: Melody;
  /** A second, independent rhythmic voice on the same staff — percussion only:
   * `melody` carries the up-stem voice (hihat/snare/toms), this carries the
   * down-stem voice (kick), the standard convention for drum notation. */
  secondaryVoice?: Melody;
}

export interface Arrangement {
  genre: Genre;
  distortion: number;
  ensembleId: string;
  beatsPerBar: number;
  chords: ChordSymbol[];
  /** id of the part carrying the original melody — chord symbols attach to this part */
  melodyPartId: string;
  parts: ArrangementPart[];
}
