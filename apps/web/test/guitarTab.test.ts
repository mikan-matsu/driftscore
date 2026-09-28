import { assignGuitarTab } from "../src/features/score-viewer/guitarTab";

// A human hand can comfortably stretch across about 4-5 frets in one
// position; anything wider within the SAME simultaneous chord is not a
// voicing choice, it's an impossible stretch. This is a different failure
// mode from an individual note landing far from the neck's "home" position
// (which assignFrets already optimizes for via targetFret) — two notes can
// each be individually "close to target" while still being far from EACH
// OTHER, since assignFrets picks a fret for each note independently.
const MAX_PLAYABLE_FRET_SPAN = 5;

function fretSpan(notes: { id: string; start: number; pitch: number; pitches?: number[] }[]): number {
  const tab = assignGuitarTab(notes);
  let maxSpan = 0;
  for (const placements of tab.values()) {
    // A fret of 0 (open string) doesn't constrain hand position — exclude
    // it from the span the same way a real guitarist would (an open string
    // costs no hand-position stretch at all).
    const fretted = placements.map((p) => p.fret).filter((f) => f > 0);
    if (fretted.length < 2) continue;
    const span = Math.max(...fretted) - Math.min(...fretted);
    maxSpan = Math.max(maxSpan, span);
  }
  return maxSpan;
}

describe("assignGuitarTab — chord playability", () => {
  // Sweeps every root across a range of chord shapes genreStyles.ts's
  // comping patterns actually produce (triads, shell voicings root+7th,
  // wider two-octave spreads for a bass-note-plus-upper-voicing texture),
  // rather than a single hand-picked example — a fret-span defect could
  // easily be specific to one interval combination.
  const CHORD_SHAPES: { name: string; intervals: number[] }[] = [
    { name: "triad", intervals: [0, 4, 7] },
    { name: "shell (root+7th)", intervals: [0, 10] },
    { name: "shell (root+3rd+7th)", intervals: [0, 4, 10] },
    // genreStyles.ts's GUITAR_CHORD_PATTERNS pulls tones from a chord-tone
    // stack that's fitted into the instrument's comping register band
    // (chordToneStack/freshStack, see CLAUDE.md's domain-knowhow notes) —
    // realistically at most about an octave wide, not a full two octaves.
    { name: "wide spread within one octave", intervals: [0, 7, 12] },
    { name: "power chord", intervals: [0, 7] },
  ];

  for (const { name, intervals } of CHORD_SHAPES) {
    it(`${name}: every root stays within a ${MAX_PLAYABLE_FRET_SPAN}-fret hand span`, () => {
      let worst = 0;
      for (let root = 40; root <= 64; root++) {
        const pitches = intervals.map((i) => root + i);
        const notes = [{ id: "n0", start: 0, pitch: pitches[0], pitches }];
        worst = Math.max(worst, fretSpan(notes));
      }
      expect(worst).toBeLessThanOrEqual(MAX_PLAYABLE_FRET_SPAN);
    });
  }

  it("a sequence of chords stays playable independent of hand-position drift", () => {
    // Hand position (targetFret) carries forward note-to-note — a long
    // comping sequence could in principle drift into a bad state even if
    // any single chord in isolation is fine.
    const notes = [];
    let t = 0;
    for (let bar = 0; bar < 16; bar++) {
      const root = 40 + ((bar * 5) % 24);
      notes.push({ id: `n${bar}`, start: t, pitch: root, pitches: [root, root + 4, root + 10] });
      t += 4;
    }
    expect(fretSpan(notes)).toBeLessThanOrEqual(MAX_PLAYABLE_FRET_SPAN);
  });
});
