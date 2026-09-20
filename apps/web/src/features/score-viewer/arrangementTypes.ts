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
  melody: Melody;
}

export interface Arrangement {
  genre: string;
  distortion: number;
  beatsPerBar: number;
  chords: ChordSymbol[];
  parts: ArrangementPart[];
}
