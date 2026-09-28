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
 * notehead it uses.
 *
 * Using treble-clef line/space letters as staff coordinates (this is a
 * neutral percussion staff, not really "treble clef" — the letters are
 * just a convenient way to address the 5 lines/4 spaces + ledger
 * positions above): lines bottom-to-top are E4/G4/B4/D5/F5, spaces are
 * F4/A4/C5/E5, and G5/A5/B5 are ledger positions above the staff.
 *
 * Snare/side-stick and hi-hat positions below are pinned to real reference
 * charts (2026-09-28, see /Users/akimatsu/workspace/学習用楽譜等/jazzドラム楽譜 —
 * a legend chart explicitly labeling every drum's staff position, plus a
 * shuffle chart): snare/rim-click at 第2間 (2nd space from the bottom,
 * counting the 4 spaces within the staff bottom-to-top = A4, NOT the
 * textbook-common middle line — the legend chart's plain-notehead "snare"
 * sits on the middle line, but that's a different symbol from the ×
 * rim-click/side-stick this app actually notates, which the user separately
 * confirmed at 第2間). Hi-hat (stick hits, open or closed) is ABOVE the
 * staff, at 上第1間 — the first ledger space above the top line = G5 —
 * confirmed twice in the legend chart (both "Hi-hat open"/"Hi-hat close"
 * examples sit at that exact height, clearly distinct from and higher than
 * "ride," which the same chart places right ON the top line itself (F5,
 * also applied here) rather than above the staff with the other cymbals.
 * Two earlier passes both got hi-hat wrong in different directions: one
 * mistook a "第5間" instruction for a ledger space above the staff, the
 * next then overcorrected to 第4間 (a real in-staff position, E5) — this
 * reference chart resolves the ambiguity conclusively. Kick/tom/maracas/
 * agogô positions are still the generic-convention guess from before this
 * correction — the same reference chart has real answers for these too
 * (kick/bass sits on a ledger line below the staff, not the space just
 * above the bottom line this mapping currently uses) but re-deriving the
 * complete kit from it is follow-up work, not done in this pass.
 */
export const DRUM_DISPLAY: Record<number, { step: string; octave: number; notehead?: string }> = {
  [GM_KICK]: { step: "F", octave: 4 },
  [GM_LOW_TOM]: { step: "G", octave: 4 },
  [GM_SNARE]: { step: "A", octave: 4 },
  [GM_SIDE_STICK]: { step: "A", octave: 4, notehead: "x" },
  [GM_MID_TOM]: { step: "C", octave: 5 },
  [GM_HIGH_TOM]: { step: "D", octave: 5 },
  [GM_AGOGO_LOW]: { step: "F", octave: 5 },
  [GM_AGOGO_HIGH]: { step: "A", octave: 5 },
  [GM_MARACAS]: { step: "B", octave: 5, notehead: "x" },
  [GM_HIHAT_CLOSED]: { step: "G", octave: 5, notehead: "x" },
  [GM_RIDE]: { step: "F", octave: 5, notehead: "x" },
};

/** Short, human-readable name per GM key — used to build the staff-position
 * legend text (see arrangementToMusicXml.ts's drumLegendXml()), the real
 * published-concert-band-score convention of a legend line above a
 * multi-instrument percussion staff naming each line/space (see this repo's
 * CLAUDE.md "Domain know-how" entry on concert-band percussion notation). */
export const DRUM_NAME: Record<number, string> = {
  [GM_KICK]: "B.D.",
  [GM_LOW_TOM]: "Floor Tom",
  [GM_SNARE]: "S.D.",
  [GM_SIDE_STICK]: "Rim Click",
  [GM_MID_TOM]: "Mid Tom",
  [GM_HIGH_TOM]: "Hi Tom",
  [GM_AGOGO_LOW]: "Agogô (low)",
  [GM_AGOGO_HIGH]: "Agogô (high)",
  [GM_MARACAS]: "Maracas",
  [GM_HIHAT_CLOSED]: "Hi-Hat",
  [GM_RIDE]: "Ride",
};

const STEP_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Sortable staff-height value (bottom-to-top) for a GM key's display
 * position — octave*12 + the step's semitone-within-octave, so two GM keys
 * pinned to the same line/space (e.g. snare and side-stick) sort together. */
export function drumDisplayHeight(gmKey: number): number {
  const display = DRUM_DISPLAY[gmKey];
  if (!display) return 0;
  return display.octave * 12 + (STEP_SEMITONE[display.step] ?? 0);
}
