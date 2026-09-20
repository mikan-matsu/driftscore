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
  clef: "treble" | "bass";
  transposeSemitones: number;
  polyphonic: boolean;
  melody: Melody;
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
