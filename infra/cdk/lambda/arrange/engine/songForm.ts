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

const PICKUP_MOTIF_LENGTH = 3; // notes taken from the head of the theme

/**
 * Occasional teaser phrase during the intro, drawn from the head of the
 * theme melody, so the intro isn't silent the whole way through but also
 * doesn't just restate the theme in full ("時々ピックアップ的なフレーズ",
 * not a wall of melody). Each intro bar independently rolls whether to
 * place a short version of the theme's opening notes near the end of the
 * bar — i.e. as a pickup/anacrusis leading into whatever follows, classic
 * pickup phrasing — at reduced velocity so it reads as a hint rather than a
 * full statement. The final intro bar is weighted much higher, since a
 * pickup straight into the theme is the natural place for this; earlier
 * bars only tease occasionally. Uses Math.random, so like
 * embellishMelody.ts this isn't deterministic across calls.
 */
function buildIntroMelody(themeMelody: Melody, introBars: number, beatsPerBar: number): Melody {
  const head = themeMelody.notes.slice(0, PICKUP_MOTIF_LENGTH);
  if (head.length === 0) return { beatsPerBar, notes: [] };
  const firstStart = head[0].start;
  const motifDuration = head.reduce((sum, n) => Math.max(sum, n.start - firstStart + n.duration), 0);

  const notes: Note[] = [];
  let id = 0;
  for (let bar = 0; bar < introBars; bar++) {
    const chance = bar === introBars - 1 ? 0.6 : 0.25;
    if (Math.random() >= chance) continue;

    const barStart = bar * beatsPerBar;
    // Land the motif in the back half of the bar, like a real pickup,
    // rather than spread across the whole bar.
    const placementStart = Math.max(0, beatsPerBar - motifDuration);

    for (const n of head) {
      notes.push({
        id: `ip${id++}`,
        pitch: n.pitch,
        start: barStart + placementStart + (n.start - firstStart),
        duration: n.duration,
        velocity: Math.round(n.velocity * 0.6),
      });
    }
  }
  return { beatsPerBar, notes };
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

  const introMelody = buildIntroMelody(themeMelody, introBars, beatsPerBar);
  addSection("intro", introBars, introMelody, buildVampProgression(key, introBars));
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
