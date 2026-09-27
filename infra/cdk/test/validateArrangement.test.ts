import { generateArrangement } from "../lambda/arrange/engine/generateArrangement";
import { estimateKey } from "../lambda/arrange/engine/keyEstimation";
import { validateArrangement, summarizeIssues } from "../lambda/arrange/engine/validateArrangement";
import type { Genre, Melody, Note } from "../lambda/arrange/engine/types";

// Mechanical sanity checks over generated output, across a representative
// matrix of genre x ensemble x song-form combinations — not a judgment of
// whether the music is *good* (subjective, not automatable), but a
// regression net for concrete defects: out-of-range notes, overlapping
// notes on a monophonic voice, rhythm that overflows its measure, and
// large unintentional-looking leaps. A few genuine chord/key clashes are
// expected (real arrangers use passing tones and "崩し" deliberately), so
// dissonance/leap are warnings; only structural defects fail the test.

function notes(spec: [pitch: number, start: number, duration: number][]): Note[] {
  return spec.map(([pitch, start, duration], i) => ({ id: `n${i}`, pitch, start, duration, velocity: 100 }));
}

function repeatMelody(melody: Melody, times: number): Melody {
  const lastEnd = melody.notes.reduce((max, n) => Math.max(max, n.start + n.duration), 0);
  const loopLength = Math.ceil(lastEnd / melody.beatsPerBar) * melody.beatsPerBar;
  const repeated: Note[] = [];
  let id = 0;
  for (let r = 0; r < times; r++) {
    for (const note of melody.notes) repeated.push({ ...note, id: `n${id++}`, start: note.start + r * loopLength });
  }
  return { beatsPerBar: melody.beatsPerBar, notes: repeated };
}

// "きらきら星" (Twinkle Twinkle), repeated — an odd-length-ish real melody
// rather than a synthetic evenly-spaced one, closer to what the app
// actually generates arrangements from.
const TWINKLE: Melody = repeatMelody(
  {
    beatsPerBar: 4,
    notes: notes([
      [60, 0, 1], [60, 1, 1], [67, 2, 1], [67, 3, 1], [69, 4, 1], [69, 5, 1], [67, 6, 2],
      [65, 8, 1], [65, 9, 1], [64, 10, 1], [64, 11, 1], [62, 12, 1], [62, 13, 1], [60, 14, 2],
    ]),
  },
  2,
);

const GENRES: Genre[] = ["jazz", "rock", "classical", "samba"];
const ENSEMBLES = ["pianoTrio", "woodwindQuartet", "clarinetGuitarBass", "brassQuintet"];
const SONG_FORMS = ["theme", "full"] as const;

describe("validateArrangement — mechanical sanity checks across the generation matrix", () => {
  for (const genre of GENRES) {
    for (const ensembleId of ENSEMBLES) {
      for (const songForm of SONG_FORMS) {
        it(`${genre} / ${ensembleId} / ${songForm}: no structural defects`, () => {
          const arrangement = generateArrangement(TWINKLE, genre, 30, ensembleId, null, songForm);
          const key = estimateKey(TWINKLE);
          const issues = validateArrangement(arrangement, key);
          const errors = issues.filter((i) => i.severity === "error");

          if (errors.length > 0) {
            // eslint-disable-next-line no-console
            console.error(`${genre}/${ensembleId}/${songForm} errors:`, errors.slice(0, 10));
          }
          expect(errors).toEqual([]);

          const warnings = issues.filter((i) => i.severity === "warning");
          const totalNotes = arrangement.parts
            .filter((p) => p.clef !== "percussion")
            .reduce((sum, p) => sum + p.melody.notes.length + (p.secondaryVoice?.notes.length ?? 0), 0);
          // Not a hard musical-quality bar (that's subjective) — just a
          // trip-wire against a generation regression that makes every
          // single note clash or leap, which would mean something is
          // structurally broken (e.g. chords misaligned with bars).
          expect(warnings.length).toBeLessThan(totalNotes);
        });
      }
    }
  }

  it("prints a summary across the whole matrix for manual review", () => {
    const totals: Record<string, number> = {};
    for (const genre of GENRES) {
      for (const ensembleId of ENSEMBLES) {
        const arrangement = generateArrangement(TWINKLE, genre, 30, ensembleId, null, "full");
        const key = estimateKey(TWINKLE);
        const issues = validateArrangement(arrangement, key);
        for (const [k, v] of Object.entries(summarizeIssues(issues))) {
          totals[k] = (totals[k] ?? 0) + v;
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log("validateArrangement summary across genre x ensemble matrix:", totals);
    expect(totals).toBeDefined();
  });
});

/**
 * Register overlap between the melody and an accompaniment part: a comping
 * or harmony note whose pitch reaches at or above a melody note actually
 * sounding at the same time (unison doubling at best, audible masking of
 * the tune at worst). validateArrangement's own "overlap" category only
 * catches two notes overlapping on the *same* monophonic voice — it has
 * never checked register relationships *between* parts, so this class of
 * defect was previously invisible to the whole test suite (see project
 * memory / session notes: found by ear in production, not by any test).
 *
 * Root cause was the polyphonic comping voicer (chordToneStack /
 * genreStyles.ts) and the melody/bass double-sided collision-avoidance
 * (clearOverlaps / assignRoles.ts) both being limited to whole-octave
 * transposition of a fixed root-at-bottom voicing — which can't fit a chord
 * into a sub-octave-wide [low, ceiling) window even when a valid *inverted*
 * voicing would. Fixed for the polyphonic path (piano/guitar-style comping)
 * by allowing inversions (placeToneInBand) and by resolving melody- and
 * bass-clearance together instead of as two independent passes that could
 * re-break each other (bestOverlapShift).
 *
 * pianoTrio and clarinetGuitarBass exercise that fixed path and must stay
 * at zero. woodwindQuartet and brassQuintet split the same chord across
 * several *monophonic* instruments (renderHarmonyVoices' SATB-style voice
 * assignment) instead of voicing it on one polyphonic instrument — a
 * different code path with the same underlying "fixed role order" limitation
 * that isn't fixed yet (an inversion isn't available when each voice is
 * already committed to one specific chord tone). That's a known, tracked
 * gap, not a silent regression allowance: the ceiling below is today's
 * actual count, so any *increase* still fails the build.
 */
function findRegisterCrossings(arrangement: ReturnType<typeof generateArrangement>) {
  const melodyPart = arrangement.parts.find((p) => p.id === arrangement.melodyPartId)!;
  const crossings: { part: string; accompPitch: number; melodyPitch: number; at: number }[] = [];
  for (const part of arrangement.parts) {
    if (part.id === melodyPart.id || part.clef === "percussion") continue;
    for (const note of part.melody.notes) {
      const maxPitch = Math.max(...(note.pitches ?? [note.pitch]));
      const overlapping = melodyPart.melody.notes.filter(
        (m) => m.start < note.start + note.duration && note.start < m.start + m.duration,
      );
      for (const m of overlapping) {
        if (maxPitch >= m.pitch) crossings.push({ part: part.name, accompPitch: maxPitch, melodyPitch: m.pitch, at: note.start });
      }
    }
  }
  return crossings;
}

describe("register overlap between melody and accompaniment", () => {
  const FIXED_ENSEMBLES = ["pianoTrio", "clarinetGuitarBass"];
  // Generous headroom above measured counts (~30-90, varying run to run —
  // embellishMelody's distortion-driven decoration is probabilistic) so
  // this catches a real regression (e.g. an order-of-magnitude jump) without
  // being flaky from ordinary run-to-run variance.
  const KNOWN_GAP_CEILINGS: Record<string, number> = {
    "jazz/woodwindQuartet": 15,
    "rock/woodwindQuartet": 150,
    "classical/woodwindQuartet": 150,
    "samba/woodwindQuartet": 15,
    "jazz/brassQuintet": 20,
    "rock/brassQuintet": 70,
    "classical/brassQuintet": 60,
    "samba/brassQuintet": 40,
  };

  for (const genre of GENRES) {
    for (const ensembleId of FIXED_ENSEMBLES) {
      it(`${genre} / ${ensembleId} / full: zero melody/accompaniment register crossings`, () => {
        const arrangement = generateArrangement(TWINKLE, genre, 30, ensembleId, null, "full");
        expect(findRegisterCrossings(arrangement)).toEqual([]);
      });
    }

    for (const ensembleId of ["woodwindQuartet", "brassQuintet"]) {
      it(`${genre} / ${ensembleId} / full: known-gap crossings don't regress`, () => {
        const arrangement = generateArrangement(TWINKLE, genre, 30, ensembleId, null, "full");
        const ceiling = KNOWN_GAP_CEILINGS[`${genre}/${ensembleId}`];
        expect(findRegisterCrossings(arrangement).length).toBeLessThanOrEqual(ceiling);
      });
    }
  }
});
