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
    instruments: [INSTRUMENTS.clarinetBb, INSTRUMENTS.trumpetBb, INSTRUMENTS.hornF, INSTRUMENTS.bassoon],
  },
  clarinetGuitarBass: {
    id: "clarinetGuitarBass",
    name: "Clarinet, Guitar & Bass",
    instruments: [INSTRUMENTS.clarinetBb, INSTRUMENTS.guitar, INSTRUMENTS.electricBass],
  },
};

export const DEFAULT_ENSEMBLE_ID = "pianoTrio";
