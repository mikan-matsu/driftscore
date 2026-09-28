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

function frettedSpan(placements: FretPlacement[]): number {
  const fretted = placements.map((p) => p.fret).filter((f) => f > 0);
  return fretted.length >= 2 ? Math.max(...fretted) - Math.min(...fretted) : 0;
}

/**
 * Assigns each of `pitches` (typically one chord's simultaneous tones) to a
 * distinct string+fret. Two tones can never share a string at the same
 * instant on a real guitar. Each pitch has at most one valid fret per
 * string (fret = pitch - openPitch), so this exhaustively searches every
 * way to assign distinct strings to the pitches and picks the one that
 * minimizes the chord's own fret span first (a human hand can only stretch
 * so far in one position), and only then prefers frets close to `targetFret` — the previous note's fret,
 * so the line reads as one continuous hand position moving up or down the
 * neck. Chord sizes here are small (well under the 6 strings available),
 * so the exhaustive search is cheap.
 *
 * An earlier version picked each note's string+fret independently, sorted
 * only by closeness to targetFret — two notes could each individually be
 * "close to target" while landing far from EACH OTHER (a real chord shape
 * measured up to 14 frets wide, nowhere near playable), since nothing
 * considered the chord's own internal spread at all.
 */
function assignFrets(pitches: number[], targetFret: number): FretPlacement[] {
  const optionsPerNote: FretPlacement[][] = pitches.map((pitch) => {
    const inRange = GUITAR_STRINGS.map((s) => ({ string: s.string, fret: pitch - s.openPitch })).filter(
      (c) => c.fret >= 0 && c.fret <= MAX_FRET,
    );
    if (inRange.length > 0) return inRange;
    // Out of the normal playable span on every string (a very low or very
    // high pitch reaching this part) — fall back to whichever string gets
    // closest, clamped, rather than emitting nothing.
    return GUITAR_STRINGS.map((s) => ({ string: s.string, fret: Math.max(0, Math.min(MAX_FRET, pitch - s.openPitch)) }));
  });

  let best: FretPlacement[] | null = null;
  let bestSpan = Infinity;
  let bestTargetDist = Infinity;

  function search(idx: number, usedStrings: Set<number>, chosen: FretPlacement[]) {
    if (idx === pitches.length) {
      const span = frettedSpan(chosen);
      const targetDist = chosen.reduce((sum, c) => sum + Math.abs(c.fret - targetFret), 0) / chosen.length;
      if (span < bestSpan || (span === bestSpan && targetDist < bestTargetDist)) {
        bestSpan = span;
        bestTargetDist = targetDist;
        best = [...chosen];
      }
      return;
    }
    // Guitar chords here max out well under 6 notes, but if this is ever
    // called with more simultaneous pitches than strings, the (idx+1)th+
    // note simply has no unused string left — every candidate below gets
    // filtered out and the recursion for this branch dead-ends, same as
    // running out of options for any other reason.
    for (const opt of optionsPerNote[idx]) {
      if (usedStrings.has(opt.string)) continue;
      usedStrings.add(opt.string);
      chosen.push(opt);
      search(idx + 1, usedStrings, chosen);
      chosen.pop();
      usedStrings.delete(opt.string);
    }
  }

  search(0, new Set(), []);

  if (best) return best;

  // No valid full assignment exists at all (more simultaneous pitches than
  // strings) — fall back to the old greedy per-note behavior so callers
  // always get a result, rather than nothing. A genuinely unplayable input
  // in this direction is out of scope for this fix.
  const usedStrings = new Set<number>();
  return pitches.map((_, idx) => {
    const candidates = optionsPerNote[idx]
      .filter((c) => !usedStrings.has(c.string))
      .sort((a, b) => Math.abs(a.fret - targetFret) - Math.abs(b.fret - targetFret));
    const chosen = candidates[0] ?? { string: GUITAR_STRINGS[0].string, fret: 0 };
    usedStrings.add(chosen.string);
    return chosen;
  });
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
