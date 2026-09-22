import type { Melody } from "@/features/piano-roll";

export type ChordQuality = "maj" | "min" | "dim";

export interface ChordSymbol {
  root: number;
  quality: ChordQuality;
  bar: number;
}

export type SectionKind = "intro" | "theme" | "solo" | "break" | "reprise" | "ending";

/** A span of the full song form (intro/theme/solo/break/reprise/ending), in bars. */
export interface Section {
  kind: SectionKind;
  /** 0-based, matches ChordSymbol.bar */
  startBar: number;
  barCount: number;
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
  /** Song-form sections. A single [{kind:"theme", startBar:0, barCount:chords.length}] in "theme"-only mode. */
  sections: Section[];
}
