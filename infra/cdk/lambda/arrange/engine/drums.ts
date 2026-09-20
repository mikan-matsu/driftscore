import type { ChordSymbol, Genre, Note } from "./types";

// General MIDI percussion key map (channel 10) — reusing the standard rather
// than inventing our own numbering, since both the MusicXML export and the
// Tone.js playback side need a shared, unambiguous "which drum is this" id.
export const GM_KICK = 36;
export const GM_SNARE = 38;
export const GM_HIHAT_CLOSED = 42;
export const GM_RIDE = 51;

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

const PATTERNS: Partial<Record<Genre, DrumHit[]>> = { rock: ROCK_BAR, jazz: JAZZ_BAR };

export interface DrumVoices {
  /** Hihat/snare/ride — standard drum notation convention: stems up. */
  up: Note[];
  /** Kick — stems down, the standard convention's other voice on the same staff. */
  down: Note[];
}

/**
 * Renders a drum part for genres with a defined beat, or null for genres
 * without one (classical, samba — not asked for, left out rather than
 * guessing at a pattern). Deliberately bypasses assignRoles' pitch-folding
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

  const up: Note[] = [];
  const down: Note[] = [];
  let upId = 0;
  let downId = 0;
  chords.forEach((chord) => {
    for (const hit of pattern) {
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
