import { INSTRUMENTS, type InstrumentDef } from "./instruments";

/**
 * Explicit doubling/section structure for a large ensemble, where the
 * pianoTrio-style "one melody instrument + one bass instrument + everything
 * else is one flat harmony stack" model (assignRoles.ts's default path)
 * breaks down — a dozen-plus wind/brass parts need several instruments
 * doubling the same melody or bass line in their own register, and several
 * independently-voiced harmony sections, not one giant SATB stack. Omitted
 * for the small presets (and always for a custom ensemble), which keep
 * today's simpler pick-one-of-each behavior unchanged.
 */
export interface EnsembleLayout {
  /** Primary melody instrument id — embellished, others just double it. */
  melody: string;
  /** Instrument ids that double the melody an octave/register apart, unembellished (no independent fills — real doublers play the same line). */
  melodyDoublers: string[];
  /** Primary bass instrument id — the bass line's "source of truth". */
  bass: string;
  /** Instrument ids that double the bass line in their own idiomatic register. */
  bassDoublers: string[];
  /** Each inner array is voiced as its own independent SATB-style comping stack (assignRoles.ts's renderHarmonyVoices), not merged into one big stack across the whole ensemble. */
  harmonyGroups: string[][];
}

export interface EnsemblePreset {
  id: string;
  name: string;
  instruments: InstrumentDef[];
  layout?: EnsembleLayout;
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
  windBand: {
    id: "windBand",
    name: "Wind Band",
    // Standard concert-band top-to-bottom score order (see CLAUDE.md's
    // domain-know-how entry on concert-band engraving conventions) — this
    // array's order is what determines part order in the returned
    // arrangement for the layout-driven path, not the melody-first/
    // register-sorted order the small presets get.
    instruments: [
      INSTRUMENTS.flute,
      INSTRUMENTS.clarinetBb,
      INSTRUMENTS.clarinetBb2,
      INSTRUMENTS.clarinetBb3,
      INSTRUMENTS.altoSax1,
      INSTRUMENTS.altoSax2,
      INSTRUMENTS.trumpetBb,
      INSTRUMENTS.trumpetBb2,
      INSTRUMENTS.trumpetBb3,
      INSTRUMENTS.hornF,
      INSTRUMENTS.hornF2,
      INSTRUMENTS.trombone,
      INSTRUMENTS.trombone2,
      INSTRUMENTS.euphonium,
      INSTRUMENTS.tuba,
    ],
    layout: {
      // Clarinet 1 carries the tune (concert band's "violin section"); flute,
      // alto sax 1, and trumpet 1 double it in their own register for the
      // characteristic thick full-band melody doubling — not independently
      // embellished, just the same line refit to each instrument.
      melody: "clarinetBb",
      melodyDoublers: ["flute", "altoSax1", "trumpetBb"],
      // Tuba carries the bass line; euphonium and both trombones double it
      // (a "low brass choir" doubling the same line, each in its own
      // register) rather than voicing independent harmony — sidesteps the
      // still-unresolved SATB register-overlap gap for these parts entirely
      // (see CLAUDE.md) by not asking them to freely voice chord tones.
      bass: "tuba",
      bassDoublers: ["euphonium", "trombone", "trombone2"],
      // Two independently-voiced comping stacks rather than one big one:
      // inner woodwinds (3 voices, fits a plain triad with no rests) and
      // upper brass (4 voices, fits a seventh chord exactly). Horns sit with
      // the brass stack — their idiomatic register is the same middle band
      // trumpets 2/3 comp in.
      harmonyGroups: [
        ["clarinetBb2", "clarinetBb3", "altoSax2"],
        ["trumpetBb2", "trumpetBb3", "hornF", "hornF2"],
      ],
    },
  },
};

export const DEFAULT_ENSEMBLE_ID = "pianoTrio";
