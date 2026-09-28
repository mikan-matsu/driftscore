"use client";

import { Soundfont, SplendidGrandPiano, type Smplr } from "smplr";

/**
 * Maps each DriftScore instrument id (infra/cdk/lambda/arrange/engine/instruments.ts)
 * to a General MIDI instrument name from the FluidR3_GM soundfont (free,
 * openly-licensed multi-sampled recordings — see smplr's own README) rather
 * than a synthesized oscillator. Several DriftScore ids intentionally share
 * one GM name (e.g. every clarinet chair uses "clarinet") — see
 * `loadSampledInstruments`, which loads and caches by GM name, not by
 * DriftScore id, so those chairs share a single fetched instrument instead
 * of re-downloading the same samples per chair.
 *
 * "lead" (a generic placeholder melody voice used when no real melodic
 * instrument exists, e.g. pianoTrio) has no real-instrument identity to
 * match — mapped to violin as a flexible, pleasant default. "guitar" moves
 * here too (off the old PluckSynth physical model) for consistency with
 * every other instrument now being sample-based; TAB notation is unaffected
 * since that's a notation-layer decision, unrelated to the audio engine.
 * "piano" gets its own dedicated multi-velocity-layer sample set
 * (SplendidGrandPiano) rather than the general soundfont's piano patch, for
 * a comping role that's heard almost constantly.
 */
export const GM_INSTRUMENT: Record<string, string> = {
  lead: "violin",
  electricBass: "electric_bass_finger",
  flute: "flute",
  oboe: "oboe",
  clarinetBb: "clarinet",
  clarinetBb2: "clarinet",
  clarinetBb3: "clarinet",
  trumpetBb: "trumpet",
  trumpetBb2: "trumpet",
  trumpetBb3: "trumpet",
  hornF: "french_horn",
  hornF2: "french_horn",
  bassoon: "bassoon",
  guitar: "acoustic_guitar_steel",
  trombone: "trombone",
  // (guitar's actual GM patch is genre-dependent — see GUITAR_GM_BY_GENRE
  // below; this entry is only the fallback for a genre with no override.)
  trombone2: "trombone",
  tuba: "tuba",
  altoSax1: "alto_sax",
  altoSax2: "alto_sax",
  // No dedicated GM euphonium patch exists — french_horn is the closer
  // timbral match (mellow, lyrical) versus tuba's much darker, heavier tone.
  euphonium: "french_horn",
};

// One fixed guitar GM patch across every genre read as a mismatch on its
// own, independent of any one patch's recording quality: rock's power-chord
// chugging/riffs (genreStyles.ts's GUITAR_CHORD_PATTERNS) want a driven
// electric tone, jazz's shell voicings want a clean hollow-body electric
// tone, and samba's fingerstyle batida and classical's Alberti arpeggiation
// both want a nylon-string acoustic tone — steel-string acoustic for all
// four is the "one guitar sound for everything" complaint independent of
// which specific GM recording is used. Keyed by Arrangement.genre; a genre
// with no entry here falls back to GM_INSTRUMENT.guitar above.
const GUITAR_GM_BY_GENRE: Record<string, string> = {
  rock: "overdriven_guitar",
  jazz: "electric_guitar_jazz",
  samba: "acoustic_guitar_nylon",
  classical: "acoustic_guitar_nylon",
};

function resolveGuitarGmName(genre: string | undefined): string {
  return (genre && GUITAR_GM_BY_GENRE[genre]) || GM_INSTRUMENT.guitar;
}

// MusyngKite over FluidR3_GM: FluidR3_GM's brass/reed patches (trumpet,
// french_horn, trombone, oboe, alto_sax) are thin, synth-like recordings —
// exactly the instruments flagged as still sounding wrong after switching
// to samples, while its flute/clarinet/tuba patches (recorded better in
// that particular soundfont) already sounded fine. MusyngKite is a
// larger, more consistently-recorded GM soundfont across the whole
// instrument set, not just a fix for the specific instruments flagged so
// far — same free/open license, same gleitz/midi-js-soundfonts host, same
// smplr Soundfont API, just a different `kit` value.
const KIT = "MusyngKite" as const;

interface CachedInstrument {
  instrument: Smplr;
  ready: Promise<void>;
}

/** Module-level cache, not per-playback: instruments are fetched once per
 * GM name for the whole session and reused across every subsequent
 * generation/replay, so only genuinely new instruments (a newly-picked
 * custom ensemble instrument the session hasn't used yet) cost a fetch. */
const cache = new Map<string, CachedInstrument>();

function getAudioContext(Tone: typeof import("tone")): BaseAudioContext {
  return Tone.getContext().rawContext as unknown as BaseAudioContext;
}

function loadOne(Tone: typeof import("tone"), gmName: string): CachedInstrument {
  const existing = cache.get(gmName);
  if (existing) return existing;

  const ctx = getAudioContext(Tone);
  const instrument =
    gmName === "piano" ? SplendidGrandPiano(ctx) : Soundfont(ctx, { kit: KIT, instrument: gmName });
  const entry: CachedInstrument = { instrument, ready: instrument.ready };
  cache.set(gmName, entry);
  return entry;
}

/**
 * Ensures every GM instrument this arrangement's parts need is loaded
 * (fetching only names not already cached from a previous play), and
 * returns a lookup from DriftScore instrument id to its ready Smplr
 * instance. Callers should await this — and ideally show a loading
 * indicator while it's pending — before scheduling any notes, since a
 * `.start()` call before `.ready` resolves plays nothing.
 */
export async function loadSampledInstruments(
  Tone: typeof import("tone"),
  instrumentIds: string[],
  genre?: string,
): Promise<Map<string, Smplr>> {
  const resolveGmName = (id: string): string | undefined => {
    if (id === "piano") return "piano";
    if (id === "guitar") return resolveGuitarGmName(genre);
    return GM_INSTRUMENT[id];
  };

  const gmNames = new Set<string>();
  for (const id of instrumentIds) {
    const gmName = resolveGmName(id);
    if (gmName) gmNames.add(gmName);
  }

  const entries = [...gmNames].map((name) => [name, loadOne(Tone, name)] as const);
  await Promise.all(entries.map(([, entry]) => entry.ready));

  const byId = new Map<string, Smplr>();
  for (const id of instrumentIds) {
    const gmName = resolveGmName(id);
    const entry = gmName ? cache.get(gmName) : undefined;
    if (entry) byId.set(id, entry.instrument);
  }
  return byId;
}

/** Stops every currently-ringing voice across every loaded sampled
 * instrument — called on playback stop, since these instruments persist
 * across plays (see the module-level cache) rather than being disposed. */
export function stopAllSampledInstruments() {
  for (const { instrument } of cache.values()) {
    instrument.stop();
  }
}
