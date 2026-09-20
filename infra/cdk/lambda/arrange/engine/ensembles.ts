import { INSTRUMENTS, type InstrumentDef } from "./instruments";

export interface EnsemblePreset {
  id: string;
  name: string;
  instruments: InstrumentDef[];
}

export const ENSEMBLE_PRESETS: Record<string, EnsemblePreset> = {
  pianoTrio: {
    id: "pianoTrio",
    name: "Piano Trio",
    instruments: [INSTRUMENTS.lead, INSTRUMENTS.piano, INSTRUMENTS.electricBass],
  },
  woodwindQuartet: {
    id: "woodwindQuartet",
    name: "Woodwind Quartet",
    instruments: [INSTRUMENTS.flute, INSTRUMENTS.oboe, INSTRUMENTS.clarinetBb, INSTRUMENTS.bassoon],
  },
  clarinetGuitarBass: {
    id: "clarinetGuitarBass",
    name: "Clarinet, Guitar & Bass",
    instruments: [INSTRUMENTS.clarinetBb, INSTRUMENTS.guitar, INSTRUMENTS.electricBass],
  },
  brassQuintet: {
    id: "brassQuintet",
    name: "Brass Quintet",
    instruments: [
      INSTRUMENTS.trumpetBb,
      INSTRUMENTS.trumpetBb2,
      INSTRUMENTS.hornF,
      INSTRUMENTS.trombone,
      INSTRUMENTS.tuba,
    ],
  },
};

export const DEFAULT_ENSEMBLE_ID = "pianoTrio";
