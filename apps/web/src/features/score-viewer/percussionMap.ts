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
 * reference chart resolves the ambiguity conclusively.
 *
 * Re-measured (2026-09-28, later session) against the same reference
 * chart's tom pair (top staff, labeled 「ハイタム high tom」/「ローダム low
 * tom」) via pixel-level analysis (staff line spacing is only ~4.5px in
 * this low-res source, too fine to trust by eye alone): high tom sits in
 * the space above the 2nd-from-top line (E5), low tom sits ON that 2nd
 * line (D5) — both one full staff step higher than this mapping's previous
 * guess (HIGH_TOM was D5, MID_TOM was C5). This app's 3-tom system maps
 * the chart's "low tom" to MID_TOM (there's a separate, lower "floor tom"
 * entry in the same chart — see DRUM_NAME's "Floor Tom" — which is this
 * app's LOW_TOM). Kick's own measured position (F4, the space just above
 * the bottom line) came back matching the existing value exactly, so it's
 * unchanged and now confirmed rather than just assumed.
 *
 * Left unresolved: LOW_TOM/FloorTom's exact position measured ambiguously
 * between the middle line (B4) and the space below it (A4) — peak pixel
 * darkness was split almost evenly between both candidates at this
 * resolution, and forcing a pick risked encoding noise as fact (note B4
 * would also collide with SNARE/SIDE_STICK's position, which itself came
 * from a separate, more authoritative confirmation, not this chart — see
 * above). Only clear enough to say it's wrong, not what it should be
 * instead, so its previous guess (G4) is left in place pending either a
 * higher-resolution reference image or a direct answer from the user.
 * MARACAS/AGOGO aren't in this chart at all (it's a standard kit legend,
 * no Latin percussion) — no reference data exists for them yet.
 */
export const DRUM_DISPLAY: Record<number, { step: string; octave: number; notehead?: string }> = {
  [GM_KICK]: { step: "F", octave: 4 },
  [GM_LOW_TOM]: { step: "G", octave: 4 },
  // Corrected 2026-09-28 (later session, live user correction): plain-notehead
  // snare (S.D.) sits at 第3間 (3rd space from the bottom = C5), not 第2間
  // (A4) as an earlier pass in this same file had it — that A4 position is
  // kept for GM_SIDE_STICK (the × rim-click symbol) only, which the user did
  // not flag as wrong here.
  [GM_SNARE]: { step: "C", octave: 5 },
  [GM_SIDE_STICK]: { step: "A", octave: 4, notehead: "x" },
  [GM_MID_TOM]: { step: "D", octave: 5 },
  [GM_HIGH_TOM]: { step: "E", octave: 5 },
  [GM_AGOGO_LOW]: { step: "F", octave: 5 },
  [GM_AGOGO_HIGH]: { step: "A", octave: 5 },
  // Plain (not ×) notehead — corrected 2026-09-28 against a real samba
  // drum-kit reference chart (/Users/akimatsu/workspace/学習用楽譜等/サンバドラム.png):
  // the steady 16th-note shaker/tamborim ostinato this voices is notated
  // with an ordinary filled notehead there, with × reserved for the
  // separate accent voice (see drums.ts's SAMBA_BAR comment) — using × for
  // both made every samba drum hit look like a cymbal/rim-click, obscuring
  // the actual distinction the reference draws between the steady pulse and
  // its accents.
  [GM_MARACAS]: { step: "B", octave: 5 },
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
