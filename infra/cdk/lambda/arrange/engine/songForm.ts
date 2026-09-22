import { MAJOR_DEGREES, MAJOR_QUALITIES, MINOR_DEGREES, MINOR_QUALITIES } from "./chordProgression";
import type { EstimatedKey } from "./keyEstimation";
import { renderSolo } from "./solo";
import type { ChordSymbol, Genre, Melody, Note, Section, SectionKind } from "./types";

const MIN_TOTAL_BARS = 50;

/**
 * A simple I/V-centered vamp for sections with no melody to derive a
 * progression from (intro/ending) — estimateChordProgression can't be
 * reused here, since a rest-only bar gives it no pitch-class evidence to
 * work with and its output degrades to whatever root motion scoring alone
 * prefers, which isn't a deliberate, singable vamp.
 */
function buildVampProgression(key: EstimatedKey, barCount: number): ChordSymbol[] {
  const degrees = key.isMinor ? MINOR_DEGREES : MAJOR_DEGREES;
  const qualities = key.isMinor ? MINOR_QUALITIES : MAJOR_QUALITIES;
  const tonic: ChordSymbol = { root: key.root, quality: qualities[0], bar: 0 };
  const dominant: ChordSymbol = { root: (key.root + degrees[4]) % 12, quality: qualities[4], bar: 0 };

  const chords: ChordSymbol[] = [];
  for (let bar = 0; bar < barCount; bar++) {
    // Always land on the tonic in the final bar.
    const useDominant = bar % 2 === 1 && bar !== barCount - 1;
    chords.push({ ...(useDominant ? dominant : tonic), bar });
  }
  return chords;
}

/** Shifts a melody's notes and a chord progression's bars so they start at `barOffset`. */
function shiftMelody(melody: Melody, barOffset: number, beatsPerBar: number): Melody {
  const beatOffset = barOffset * beatsPerBar;
  return { ...melody, notes: melody.notes.map((n) => ({ ...n, start: n.start + beatOffset })) };
}
function shiftChords(chords: ChordSymbol[], barOffset: number): ChordSymbol[] {
  return chords.map((c) => ({ ...c, bar: c.bar + barOffset }));
}

export interface SongFormResult {
  melody: Melody;
  chords: ChordSymbol[];
  sections: Section[];
}

/**
 * Builds a full song form (intro -> theme -> solo -> break -> reprise ->
 * ending) out of a short theme melody + its chord progression, by
 * concatenating per-section melody/chords rather than generating anything
 * genre/pattern-specific here — genreStyles.ts, drums.ts and assignRoles.ts
 * all operate purely off however long the `chords` array they're given is,
 * so once this hands them one long melody + one long chords array, they need
 * no changes of their own to arrange the whole form.
 *
 * Section lengths scale off the theme's own bar count (`themeBars`) rather
 * than a fixed target, then fall back to repeating the solo (and, if still
 * short, the reprise) so short themes still reach a full-song-ish length —
 * see MIN_TOTAL_BARS.
 */
export function buildSongForm(
  themeMelody: Melody,
  themeChords: ChordSymbol[],
  beatsPerBar: number,
  key: EstimatedKey,
  genre: Genre,
): SongFormResult {
  const themeBars = themeChords.length;
  const introBars = Math.min(4, Math.max(2, Math.round(themeBars / 4)));
  const breakBars = 1;
  const endingBars = 2;

  let soloLaps = 1;
  let repriseLaps = 1;
  const totalBarsFor = (laps: number, repriseLapsN: number) =>
    introBars + themeBars + themeBars * laps + breakBars + themeBars * repriseLapsN + endingBars;
  // Alternately add another lap of solo, then reprise, until the whole form
  // reaches MIN_TOTAL_BARS — a single bump of each (the previous version of
  // this loop) wasn't enough for short themes, e.g. an 8-bar theme only
  // reached 45 bars with one extra lap each, still short of the 50 floor.
  // Capped so a pathological (near-zero-bar) theme can't spin forever.
  for (let guard = 0; guard < 20 && totalBarsFor(soloLaps, repriseLaps) < MIN_TOTAL_BARS; guard++) {
    if (guard % 2 === 0) soloLaps++;
    else repriseLaps++;
  }

  const sections: Section[] = [];
  const melodyParts: Melody[] = [];
  const chordParts: ChordSymbol[][] = [];
  let cursor = 0;

  function addSection(kind: SectionKind, barCount: number, melody: Melody, chords: ChordSymbol[]) {
    sections.push({ kind, startBar: cursor, barCount });
    melodyParts.push(shiftMelody(melody, cursor, beatsPerBar));
    chordParts.push(shiftChords(chords, cursor));
    cursor += barCount;
  }

  const restMelody: Melody = { beatsPerBar, notes: [] };
  const genreUsesSeventh = genre === "jazz" || genre === "samba";

  addSection("intro", introBars, restMelody, buildVampProgression(key, introBars));
  addSection("theme", themeBars, themeMelody, themeChords);
  for (let lap = 0; lap < soloLaps; lap++) {
    const soloStartPitch = themeMelody.notes[0]?.pitch ?? key.root + 72;
    const soloNotes = renderSolo(themeChords, beatsPerBar, genreUsesSeventh, soloStartPitch);
    addSection("solo", themeBars, { beatsPerBar, notes: soloNotes }, themeChords);
  }
  const tonicQuality = key.isMinor ? MINOR_QUALITIES[0] : MAJOR_QUALITIES[0];
  const tonicChord: ChordSymbol = { root: key.root, quality: tonicQuality, bar: 0 };
  const repriseHead = themeChords[0] ?? tonicChord;
  addSection("break", breakBars, restMelody, [{ ...repriseHead, bar: 0 }]);
  for (let lap = 0; lap < repriseLaps; lap++) {
    addSection("reprise", themeBars, themeMelody, themeChords);
  }
  // A held tonic to close the piece, not another vamp — Array.from since a
  // single ChordSymbol repeats identically across every ending bar.
  addSection(
    "ending",
    endingBars,
    restMelody,
    Array.from({ length: endingBars }, (_, bar) => ({ ...tonicChord, bar })),
  );

  const melody: Melody = { beatsPerBar, notes: melodyParts.flatMap((m) => m.notes) };
  const chords: ChordSymbol[] = chordParts.flat();

  return { melody, chords, sections };
}
