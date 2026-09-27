/**
 * General MIDI percussion key map (channel 10) values used by the arrange
 * API's drum part (see infra/cdk/lambda/arrange/engine/drums.ts) — these
 * numbers travel over the API as ordinary `pitch`/`pitches` values, so both
 * sides need to agree on what they mean. Duplicated rather than shared
 * across the API boundary, matching how the rest of the arrangement types
 * are already duplicated between the lambda and the web app.
 */
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

/**
 * Where each drum sits on a standard 5-line percussion staff, and which
 * notehead it uses — bottom-to-top: kick, low/mid tom, snare (and
 * side-stick sharing the snare's line, an × notehead instead of a normal
 * one being the standard way to notate a rim click at the same drum's
 * position), agogô low, high tom, ride/hihat (× noteheads, cymbals sit
 * above the drums), agogô high.
 */
export const DRUM_DISPLAY: Record<number, { step: string; octave: number; notehead?: string }> = {
  [GM_KICK]: { step: "F", octave: 4 },
  [GM_LOW_TOM]: { step: "G", octave: 4 },
  [GM_MID_TOM]: { step: "A", octave: 4 },
  [GM_MARACAS]: { step: "B", octave: 4, notehead: "x" },
  [GM_SNARE]: { step: "C", octave: 5 },
  [GM_SIDE_STICK]: { step: "C", octave: 5, notehead: "x" },
  [GM_AGOGO_LOW]: { step: "D", octave: 5 },
  [GM_HIGH_TOM]: { step: "E", octave: 5 },
  [GM_HIHAT_CLOSED]: { step: "G", octave: 5, notehead: "x" },
  [GM_RIDE]: { step: "F", octave: 5, notehead: "x" },
  [GM_AGOGO_HIGH]: { step: "A", octave: 5 },
};
