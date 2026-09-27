/**
 * Standard 6-string guitar tuning (E2 A2 D3 G3 B3 E4, sounding pitch — the
 * part's own written-octave-up transposition, see instruments.ts's guitar
 * def, is applied separately at MusicXML render time and doesn't affect
 * this). MusicXML numbers strings from the *highest*-pitched string as 1
 * (the convention this engine's TAB output follows too, matching what OSMD
 * and every tab site/app expects).
 */
const GUITAR_STRINGS: { string: number; openPitch: number }[] = [
  { string: 1, openPitch: 64 }, // E4
  { string: 2, openPitch: 59 }, // B3
  { string: 3, openPitch: 55 }, // G3
  { string: 4, openPitch: 50 }, // D3
  { string: 5, openPitch: 45 }, // A2
  { string: 6, openPitch: 40 }, // E2
];

/** Frets past this are rare on a real neck and read as a mistake, not a fingering choice — clamp the search to a normal playable span. */
const MAX_FRET = 15;

export interface FretPlacement {
  string: number;
  fret: number;
}

/**
 * Assigns each of `pitches` (typically one chord's simultaneous tones) to a
 * distinct string+fret. Two tones can never share a string at the same
 * instant on a real guitar, so this greedily claims strings low-pitch-first
 * (a comping voicing's bass note usually wants a lower/thicker string
 * anyway), preferring the fret closest to `targetFret` — the previous
 * note's fret, so the line reads as one continuous hand position moving up
 * or down the neck rather than jumping between fret 2 and fret 14 for two
 * adjacent notes that happen to share a pitch class.
 */
function assignFrets(pitches: number[], targetFret: number): FretPlacement[] {
  const order = pitches.map((_, i) => i).sort((a, b) => pitches[a] - pitches[b]);
  const usedStrings = new Set<number>();
  const results: FretPlacement[] = new Array(pitches.length);

  for (const idx of order) {
    const pitch = pitches[idx];
    let candidates = GUITAR_STRINGS.filter((s) => !usedStrings.has(s.string))
      .map((s) => ({ string: s.string, fret: pitch - s.openPitch }))
      .filter((c) => c.fret >= 0 && c.fret <= MAX_FRET);
    if (candidates.length === 0) {
      // Out of the normal playable span on every open string (a very low or
      // very high pitch reaching this part) — fall back to whichever unused
      // string gets closest, clamped, rather than emitting nothing.
      candidates = GUITAR_STRINGS.filter((s) => !usedStrings.has(s.string)).map((s) => ({
        string: s.string,
        fret: Math.max(0, Math.min(MAX_FRET, pitch - s.openPitch)),
      }));
    }
    candidates.sort((a, b) => Math.abs(a.fret - targetFret) - Math.abs(b.fret - targetFret) || a.fret - b.fret);
    const chosen = candidates[0];
    usedStrings.add(chosen.string);
    results[idx] = chosen;
  }
  return results;
}

/**
 * Assigns string/fret placements to every note in a guitar part's melody, in
 * chronological order, carrying hand position (the running average fret of
 * the last note/chord) forward from one note to the next for idiomatic
 * continuity. Returns a lookup by Note.id (a chord's several simultaneous
 * pitches share one Note, so the array is parallel to that note's own
 * `pitches`, or a single-element array for a plain single-pitch note).
 */
export function assignGuitarTab(notes: { id: string; start: number; pitch: number; pitches?: number[] }[]): Map<string, FretPlacement[]> {
  const sorted = [...notes].sort((a, b) => a.start - b.start);
  const map = new Map<string, FretPlacement[]>();
  let position = 0;

  for (const note of sorted) {
    const pitches = note.pitches && note.pitches.length > 0 ? note.pitches : [note.pitch];
    const placements = assignFrets(pitches, position);
    map.set(note.id, placements);
    position = placements.reduce((sum, p) => sum + p.fret, 0) / placements.length;
  }
  return map;
}
