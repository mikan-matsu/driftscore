import type { Melody } from "@/features/piano-roll";

export type ChordQuality = "maj" | "min" | "dim";

export interface ChordSymbol {
  root: number;
  quality: ChordQuality;
  bar: number;
}

export interface ArrangementPart {
  id: string;
  name: string;
  clef: "treble" | "bass" | "percussion";
  transposeSemitones: number;
  polyphonic: boolean;
  melody: Melody;
  /** A second, independent rhythmic voice on the same staff — percussion only:
   * `melody` carries the up-stem voice (hihat/snare/toms), this carries the
   * down-stem voice (kick), the standard convention for drum notation. */
  secondaryVoice?: Melody;
}

export interface Arrangement {
  genre: string;
  distortion: number;
  ensembleId: string;
  beatsPerBar: number;
  chords: ChordSymbol[];
  /** id of the part carrying the original melody — chord symbols attach to this part */
  melodyPartId: string;
  parts: ArrangementPart[];
}
