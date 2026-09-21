/**
 * General MIDI percussion key map (channel 10) values used by the arrange
 * API's drum part (see infra/cdk/lambda/arrange/engine/drums.ts) — these
 * numbers travel over the API as ordinary `pitch`/`pitches` values, so both
 * sides need to agree on what they mean. Duplicated rather than shared
 * across the API boundary, matching how the rest of the arrangement types
 * are already duplicated between the lambda and the web app.
 */
export const GM_KICK = 36;
export const GM_SNARE = 38;
export const GM_HIHAT_CLOSED = 42;
export const GM_RIDE = 51;
export const GM_AGOGO_HIGH = 67;
export const GM_AGOGO_LOW = 68;
export const GM_MARACAS = 70;

/** Where each drum sits on a standard 5-line percussion staff, and which notehead it uses. */
export const DRUM_DISPLAY: Record<number, { step: string; octave: number; notehead?: string }> = {
  [GM_KICK]: { step: "F", octave: 4 },
  [GM_SNARE]: { step: "C", octave: 5 },
  [GM_MARACAS]: { step: "B", octave: 4, notehead: "x" },
  [GM_AGOGO_LOW]: { step: "D", octave: 5 },
  [GM_AGOGO_HIGH]: { step: "A", octave: 5 },
  [GM_HIHAT_CLOSED]: { step: "G", octave: 5, notehead: "x" },
  [GM_RIDE]: { step: "F", octave: 5, notehead: "x" },
};
