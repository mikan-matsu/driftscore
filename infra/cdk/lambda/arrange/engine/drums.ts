import type { ChordSymbol, Genre, Note } from "./types";

// General MIDI percussion key map (channel 10) — reusing the standard rather
// than inventing our own numbering, since both the MusicXML export and the
// Tone.js playback side need a shared, unambiguous "which drum is this" id.
export const GM_KICK = 36;
export const GM_SIDE_STICK = 37;
export const GM_SNARE = 38;
export const GM_LOW_TOM = 45;
export const GM_MID_TOM = 48;
export const GM_HIGH_TOM = 50;
export const GM_HIHAT_CLOSED = 42;
export const GM_RIDE = 51;
export const GM_AGOGO_HIGH = 67;
export const GM_AGOGO_LOW = 68;
export const GM_MARACAS = 70;

interface DrumHit {
  offset: number;
  duration: number;
  pitches: number[];
}

// Basic rock beat: kick on 1 and the "and" of 3, backbeat snare on 2 and 4,
// steady closed-hihat eighths throughout.
const ROCK_BAR: DrumHit[] = [
  { offset: 0, duration: 0.5, pitches: [GM_KICK, GM_HIHAT_CLOSED] },
  { offset: 0.5, duration: 0.5, pitches: [GM_HIHAT_CLOSED] },
  { offset: 1, duration: 0.5, pitches: [GM_SNARE, GM_HIHAT_CLOSED] },
  { offset: 1.5, duration: 0.5, pitches: [GM_HIHAT_CLOSED] },
  { offset: 2, duration: 0.5, pitches: [GM_KICK, GM_HIHAT_CLOSED] },
  { offset: 2.5, duration: 0.5, pitches: [GM_KICK, GM_HIHAT_CLOSED] },
  { offset: 3, duration: 0.5, pitches: [GM_SNARE, GM_HIHAT_CLOSED] },
  { offset: 3.5, duration: 0.5, pitches: [GM_HIHAT_CLOSED] },
];

// Swung jazz ride pattern ("ding, ding-a-ding"): long-short eighth pairs on
// the ride, with the hihat's foot chick landing on 2 and 4 and a light kick
// on 1. Written already in the swung 0.75/0.25 ratio (matching the samba
// comping cell elsewhere in this file) instead of relying on the generic
// applySwing() pass, which only reshapes even eighth pairs and isn't run
// against the drum part.
const JAZZ_BAR: DrumHit[] = [
  { offset: 0, duration: 0.75, pitches: [GM_RIDE, GM_KICK] },
  { offset: 0.75, duration: 0.25, pitches: [GM_RIDE] },
  { offset: 1, duration: 0.75, pitches: [GM_RIDE, GM_HIHAT_CLOSED] },
  { offset: 1.75, duration: 0.25, pitches: [GM_RIDE] },
  { offset: 2, duration: 0.75, pitches: [GM_RIDE] },
  { offset: 2.75, duration: 0.25, pitches: [GM_RIDE] },
  { offset: 3, duration: 0.75, pitches: [GM_RIDE, GM_HIHAT_CLOSED] },
  { offset: 3.75, duration: 0.25, pitches: [GM_RIDE] },
];

// Samba percussion, on a 16th-note grid (samba is felt in 16, not 8 — a
// straight eighth-note shaker reads as generic pop/rock, not samba).
// Maracas run continuous sixteenths for the shimmer; the agogô bell rides
// the "Brazilian clave" syncopation cell (3-3-4-2-2 in 16th units),
// alternating high/low. Kick (surdo) and side-stick (caixa/tamborim) timing
// — one kick per half-bar squarely on beats 2 and 4, with a side-stick
// filling the "e"/"and" around it — is drawn from a real samba drum-kit
// reference chart (a generic teaching pattern, not any specific recording's
// performance) rather than invented from scratch; see project memory for
// the source and reasoning.
const SAMBA_BAR: DrumHit[] = [
  { offset: 0, duration: 0.25, pitches: [GM_MARACAS, GM_AGOGO_HIGH] },
  { offset: 0.25, duration: 0.25, pitches: [GM_MARACAS, GM_SIDE_STICK] },
  { offset: 0.5, duration: 0.25, pitches: [GM_MARACAS] },
  { offset: 0.75, duration: 0.25, pitches: [GM_MARACAS, GM_AGOGO_LOW] },
  { offset: 1, duration: 0.25, pitches: [GM_MARACAS, GM_KICK] },
  { offset: 1.25, duration: 0.25, pitches: [GM_MARACAS] },
  { offset: 1.5, duration: 0.25, pitches: [GM_MARACAS, GM_SIDE_STICK, GM_AGOGO_HIGH] },
  { offset: 1.75, duration: 0.25, pitches: [GM_MARACAS] },
  { offset: 2, duration: 0.25, pitches: [GM_MARACAS] },
  { offset: 2.25, duration: 0.25, pitches: [GM_MARACAS, GM_SIDE_STICK] },
  { offset: 2.5, duration: 0.25, pitches: [GM_MARACAS, GM_AGOGO_LOW] },
  { offset: 2.75, duration: 0.25, pitches: [GM_MARACAS] },
  { offset: 3, duration: 0.25, pitches: [GM_MARACAS, GM_AGOGO_HIGH, GM_KICK] },
  { offset: 3.25, duration: 0.25, pitches: [GM_MARACAS] },
  { offset: 3.5, duration: 0.25, pitches: [GM_MARACAS, GM_SIDE_STICK] },
  { offset: 3.75, duration: 0.25, pitches: [GM_MARACAS] },
];

const PATTERNS: Partial<Record<Genre, DrumHit[]>> = { rock: ROCK_BAR, jazz: JAZZ_BAR, samba: SAMBA_BAR };

// How often a normal bar is swapped for a fill — periodic energy/punctuation
// rather than a section-boundary-aware fill (which would need `sections`
// threaded into this function; not done here, see project memory).
const FILL_EVERY_BARS = 8;

// One bar's worth of "something changes" energy in place of the steady
// groove — a real arranger doesn't fill every 8 bars identically, but a
// single fixed fill per genre is a reasonable first cut (a genuinely varied
// fill-pattern table, à la solo.ts's ~20 patterns, is a natural follow-up if
// this reads as too repetitive once heard).
const ROCK_FILL: DrumHit[] = [
  { offset: 0, duration: 0.5, pitches: [GM_KICK, GM_HIHAT_CLOSED] },
  { offset: 0.5, duration: 0.5, pitches: [GM_SNARE] },
  { offset: 1, duration: 0.5, pitches: [GM_SNARE] },
  { offset: 1.5, duration: 0.5, pitches: [GM_SNARE] },
  { offset: 2, duration: 0.5, pitches: [GM_HIGH_TOM] },
  { offset: 2.5, duration: 0.5, pitches: [GM_HIGH_TOM] },
  { offset: 3, duration: 0.5, pitches: [GM_MID_TOM] },
  { offset: 3.5, duration: 0.5, pitches: [GM_LOW_TOM] },
];

// A "drum trade" shape — ride/kick hold beat 1, then toms take over,
// idiomatic for how a jazz kit punctuates a form without breaking the swing
// feel outright.
const JAZZ_FILL: DrumHit[] = [
  { offset: 0, duration: 0.75, pitches: [GM_RIDE, GM_KICK] },
  { offset: 0.75, duration: 0.25, pitches: [GM_RIDE] },
  { offset: 1, duration: 0.5, pitches: [GM_SNARE] },
  { offset: 1.5, duration: 0.5, pitches: [GM_SNARE] },
  { offset: 2, duration: 0.5, pitches: [GM_HIGH_TOM] },
  { offset: 2.5, duration: 0.5, pitches: [GM_MID_TOM] },
  { offset: 3, duration: 0.5, pitches: [GM_LOW_TOM] },
  { offset: 3.5, duration: 0.5, pitches: [GM_LOW_TOM] },
];

// Keeps the maracas 16th-note shimmer going throughout (so it still reads
// as samba, not a generic fill dropped on top of it) — only the back half
// trades the agogô/side-stick pattern for a descending tom run, like a
// small "chamada" (call) break.
const SAMBA_FILL: DrumHit[] = [
  { offset: 0, duration: 0.25, pitches: [GM_MARACAS, GM_AGOGO_HIGH] },
  { offset: 0.25, duration: 0.25, pitches: [GM_MARACAS, GM_SIDE_STICK] },
  { offset: 0.5, duration: 0.25, pitches: [GM_MARACAS] },
  { offset: 0.75, duration: 0.25, pitches: [GM_MARACAS, GM_AGOGO_LOW] },
  { offset: 1, duration: 0.25, pitches: [GM_MARACAS, GM_KICK] },
  { offset: 1.25, duration: 0.25, pitches: [GM_MARACAS] },
  { offset: 1.5, duration: 0.25, pitches: [GM_MARACAS, GM_SIDE_STICK, GM_AGOGO_HIGH] },
  { offset: 1.75, duration: 0.25, pitches: [GM_MARACAS] },
  { offset: 2, duration: 0.25, pitches: [GM_MARACAS, GM_HIGH_TOM] },
  { offset: 2.25, duration: 0.25, pitches: [GM_MARACAS, GM_MID_TOM] },
  { offset: 2.5, duration: 0.25, pitches: [GM_MARACAS, GM_LOW_TOM] },
  { offset: 2.75, duration: 0.25, pitches: [GM_MARACAS, GM_MID_TOM] },
  { offset: 3, duration: 0.25, pitches: [GM_MARACAS, GM_HIGH_TOM, GM_KICK] },
  { offset: 3.25, duration: 0.25, pitches: [GM_MARACAS, GM_MID_TOM] },
  { offset: 3.5, duration: 0.25, pitches: [GM_MARACAS, GM_LOW_TOM] },
  { offset: 3.75, duration: 0.25, pitches: [GM_MARACAS, GM_LOW_TOM] },
];

const FILL_PATTERNS: Partial<Record<Genre, DrumHit[]>> = { rock: ROCK_FILL, jazz: JAZZ_FILL, samba: SAMBA_FILL };

export interface DrumVoices {
  /** Hihat/snare/ride — standard drum notation convention: stems up. */
  up: Note[];
  /** Kick — stems down, the standard convention's other voice on the same staff. */
  down: Note[];
}

/**
 * Renders a drum part for genres with a defined beat, or null for genres
 * without one (classical — not asked for, left out rather than guessing at
 * a pattern). Deliberately bypasses assignRoles' pitch-folding
 * and collision-avoidance machinery (computeMelodyCeilings, clearOverlaps,
 * etc.) entirely: that logic treats `pitch` as a real sounding pitch to be
 * octave-shifted around other parts, which would silently mangle GM
 * percussion key numbers (they're identifiers, not pitches to voice-lead).
 *
 * Splits into two voices (kick vs. everything else) rather than chording
 * every simultaneous hit together, because a kick landing on the same beat
 * as a hihat needs its own down-stem note, not a shared stem with the
 * up-stem hihat — a single chord group can only have one stem direction.
 */
export function renderDrumPart(chords: ChordSymbol[], genre: Genre, beatsPerBar: number): DrumVoices | null {
  const pattern = PATTERNS[genre];
  if (!pattern) return null;
  const fill = FILL_PATTERNS[genre] ?? pattern;

  const up: Note[] = [];
  const down: Note[] = [];
  let upId = 0;
  let downId = 0;
  chords.forEach((chord, barIndex) => {
    // Every FILL_EVERY_BARS-th bar swaps in a fill instead of the steady
    // groove — periodic punctuation, not tied to song-form section
    // boundaries (renderDrumPart isn't given `sections`, only a flat bar
    // count from the caller's chord list).
    const barPattern = (barIndex + 1) % FILL_EVERY_BARS === 0 ? fill : pattern;
    for (const hit of barPattern) {
      const start = chord.bar * beatsPerBar + hit.offset;
      const upPitches = hit.pitches.filter((p) => p !== GM_KICK).sort((a, b) => a - b);
      const downPitches = hit.pitches.filter((p) => p === GM_KICK);
      if (upPitches.length > 0) {
        up.push({
          id: `du${upId++}`,
          pitch: upPitches[0],
          pitches: upPitches.length > 1 ? upPitches : undefined,
          start,
          duration: hit.duration,
          velocity: 90,
        });
      }
      if (downPitches.length > 0) {
        down.push({ id: `dd${downId++}`, pitch: downPitches[0], start, duration: hit.duration, velocity: 90 });
      }
    }
  });
  return { up, down };
}
