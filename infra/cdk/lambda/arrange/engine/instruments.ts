export type Role = "melody" | "harmony" | "bass";

export interface InstrumentDef {
  id: string;
  name: string;
  clef: "treble" | "bass";
  /** written pitch = sounding pitch + this many semitones */
  transposeSemitones: number;
  /** full technically-playable range, in sounding (concert) MIDI pitch */
  rangeLow: number;
  rangeHigh: number;
  polyphonic: boolean;
  roleAffinity: Role;
  /**
   * The instrument's idiomatic/characteristic register in sounding pitch —
   * narrower than its full technical range, and NOT always centered or
   * biased toward the top of that range (e.g. bassoon's idiomatic core sits
   * near the bottom of its range, not transposed up). When assigning the
   * melody to this instrument, the engine picks the octave-shift that
   * centers the phrase in this band rather than just any octave where it
   * technically fits — the difference between "playable" and "how a real
   * arranger would actually voice it". Sourced from orchestration/arranging
   * references (timbreandorchestration.org, orchestrationonline.com,
   * orchestrationresources.com, evanrogersmusic.com — see instrument
   * comments below); omitted where research didn't turn up a clear enough
   * figure (guitar, piano, electric bass), in which case the engine falls
   * back to centering on the full technical range.
   */
  idiomaticLow?: number;
  idiomaticHigh?: number;
  /**
   * Idiomatic register to use specifically when this instrument is voicing
   * harmony/comping rather than carrying the melody, for instruments whose
   * comfortable register genuinely shifts by role (e.g. clarinet's chalumeau
   * register — darker, blends better as an inner voice — vs. its clarion
   * melody register). Falls back to `idiomaticLow`/`idiomaticHigh` when
   * unset, since for most instruments here the "characteristic middle" is a
   * reasonable harmony register too, not just a melody one.
   */
  harmonyIdiomaticLow?: number;
  harmonyIdiomaticHigh?: number;
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
    // Generic placeholder (used when no dedicated melody instrument exists,
    // e.g. piano trio) — not tied to a real instrument's register, so this
    // just targets a generically "singable lead" register, roughly where a
    // vocal melody or a flute/violin lead line would idiomatically sit.
    idiomaticLow: 72, // C5
    idiomaticHigh: 88, // E6
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
  flute: {
    id: "flute",
    name: "Flute",
    clef: "treble",
    transposeSemitones: 0,
    rangeLow: 60, // C4 sounding
    rangeHigh: 96, // C7 sounding
    polyphonic: false,
    roleAffinity: "melody",
    // "The majority of orchestral [flute] music" sits in the bright,
    // carrying D5-G6 register; low C4-C5 is weak/easily covered and mostly
    // used for color, not melody. https://timbreandorchestration.org/isfee/extreme-orchestration/woodwinds/flute-family
    idiomaticLow: 72, // C5
    idiomaticHigh: 93, // A6
  },
  oboe: {
    id: "oboe",
    name: "Oboe",
    clef: "treble",
    transposeSemitones: 0,
    rangeLow: 58, // Bb3 sounding
    rangeHigh: 91, // G6 sounding
    polyphonic: false,
    roleAffinity: "harmony",
    // "The best, most characteristic sound of the oboe comes from its middle
    // octave-and-a-half" — F4 to Bb5. https://orchestrationonline.com/oboe-optimum-range/
    idiomaticLow: 65, // F4
    idiomaticHigh: 82, // Bb5
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
    // "Most of the melodic writing... sits squarely in the clarion
    // register" (written C5 up) — the chalumeau register below is darker
    // and mainly used deliberately, not as the default melody register, and
    // the "throat tones" just below clarion (written F#4-Bb4) are weak and
    // best minimized. Clarion written C5-C6, sounding (written-2) D5-D6.
    // https://jennyclarinet.com/2024/04/the-range-and-registers-of-the-clarinet/
    idiomaticLow: 70, // D5 sounding (C5 written)
    idiomaticHigh: 82, // D6 sounding (C6 written)
    // As a harmony/inner voice, the chalumeau register (written E3-F4) is the
    // idiomatic choice instead — darker and better-blending than clarion,
    // and naturally sits below where the melody instrument lives. Sounding
    // (written-2): D3-D#4. https://jennyclarinet.com/2024/04/the-range-and-registers-of-the-clarinet/
    harmonyIdiomaticLow: 50, // D3 sounding (E3 written)
    harmonyIdiomaticHigh: 63, // D#4 sounding (F4 written)
  },
  trumpetBb: {
    id: "trumpetBb",
    name: "Trumpet in B♭",
    clef: "treble",
    transposeSemitones: 2,
    // The trumpet's famously-cited lowest note, written F#3, is a WRITTEN
    // pitch — sounding a whole step lower, at E3. The previous value here
    // stored 54 (F#3) as if it were already the sounding pitch, which is
    // off by a whole step; https://www.orchestralibrary.com/reftables/rang.html
    rangeLow: 52, // E3 sounding (F#3 written)
    rangeHigh: 82, // Bb5 sounding (C6 written) — practical top, not the professional-extreme D6 written
    polyphonic: false,
    roleAffinity: "harmony",
    // Idiomatic/"comfortable" register is written C4-G5 — below written C4
    // (down to F#3) "lacks body and luster". Sounding (written-2) Bb3-F5.
    // https://timbreandorchestration.org/isfee/extreme-orchestration/brass/trumpet
    idiomaticLow: 58, // Bb3 sounding (C4 written)
    idiomaticHigh: 77, // F5 sounding (G5 written)
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
    // Horn is described as a "middle-range instrument" whose best spread
    // sits in the middle of its total range — both extremes are explicitly
    // weaker/less secure, and the high register needs a confident embouchure
    // best avoided at amateur/school-band level (this project's target).
    // Idiomatic written F3-C5, sounding (written-7) Bb2-F4.
    // https://www.orchestrationresources.com/brass/individual-brass-instruments/horn
    idiomaticLow: 46, // Bb2 sounding (F3 written)
    idiomaticHigh: 65, // F4 sounding (C5 written)
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
    // Unlike flute/clarinet/trumpet, bassoon's idiomatic "heart of the
    // instrument" sits near the BOTTOM of its range (G2-D4), not transposed
    // up — above written C#4 it gets strained, above A4 it loses its
    // full-throated resonance. https://timbreandorchestration.org/isfee/extreme-orchestration/woodwinds/bassoon-family
    idiomaticLow: 43, // G2
    idiomaticHigh: 69, // A4
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
    // No clear numeric "idiomatic register" found in research (guitar's
    // constraints are more about playable chord shapes/fingering than tone
    // color by register) — left unset, falls back to centering on the full
    // technical range.
  },
  trumpetBb2: {
    id: "trumpetBb2",
    name: "Trumpet in B♭ 2",
    clef: "treble",
    transposeSemitones: 2,
    rangeLow: 52, // E3 sounding (F#3 written) — see trumpetBb's comment
    rangeHigh: 82, // Bb5 sounding (C6 written)
    polyphonic: false,
    roleAffinity: "harmony",
    idiomaticLow: 58, // Bb3 sounding (C4 written) — see trumpetBb's comment
    idiomaticHigh: 77, // F5 sounding (G5 written)
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
    // Sits most comfortably at the upper end of the bass staff and a few
    // ledger lines above (~F3-Bb4); the bottom of the technical range (E2,
    // 7th slide position) is awkward/slow and best avoided as a default.
    // https://wilktone.com/?p=9152
    idiomaticLow: 53, // F3
    idiomaticHigh: 70, // Bb4
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
    // No sweet spot distinct from full range beyond the general brass rule
    // (avoid the very extremes) — practical band-writing ceiling is closer
    // to the top of the bass staff (G3) than the full technical top.
    // https://www.evanrogersmusic.com/blog-contents/big-band-arranging/instrumentation
    idiomaticLow: 28, // E1 (same as technical low — no meaningfully higher "sweet spot" found)
    idiomaticHigh: 55, // G3
  },
};
