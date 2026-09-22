import type { EstimatedKey } from "./keyEstimation";
import { scalePitchClasses } from "./keyEstimation";
import { triadPitchClasses } from "./chordProgression";
import { INSTRUMENTS } from "./instruments";
import type { Arrangement, ChordSymbol, Note } from "./types";

export type IssueSeverity = "error" | "warning";
export type IssueCategory = "range" | "dissonance" | "leap" | "overlap" | "bad-duration" | "overflow";

export interface ValidationIssue {
  severity: IssueSeverity;
  category: IssueCategory;
  partId: string;
  /** 0-based measure index */
  measure: number;
  /** beat position within the whole piece */
  beat: number;
  message: string;
}

// A leap this large or more (over an octave+fourth) reads as a real oddity
// for a melody/harmony line — bass parts legitimately leap more (walking
// bass, register jumps between phrases) so they're excluded.
const LARGE_LEAP_SEMITONES = 19;

/**
 * Mechanical sanity checks over a generated Arrangement's actual note data —
 * not a judgment of whether the music is *good*, which is inherently
 * subjective and not really automatable, but a way to catch the kind of
 * concrete defect a human glancing at the score would notice: a note
 * outside the instrument's playable range, two notes overlapping on a
 * monophonic instrument, a note that clashes with neither the chord nor the
 * key, a rhythm that overflows its measure, or a melodic leap large enough
 * to read as a mistake rather than a musical choice.
 */
export function validateArrangement(arrangement: Arrangement, key: EstimatedKey): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const beatsPerBar = arrangement.beatsPerBar;
  const scale = scalePitchClasses(key);
  const chordByBar = new Map<number, ChordSymbol>(arrangement.chords.map((c) => [c.bar, c]));

  for (const part of arrangement.parts) {
    if (part.clef === "percussion") continue;
    const instrument = INSTRUMENTS[part.id];
    const voices = [part.melody.notes, ...(part.secondaryVoice ? [part.secondaryVoice.notes] : [])];

    for (const notes of voices) {
      const sorted = [...notes].sort((a, b) => a.start - b.start);
      let prevEnd = -Infinity;
      let prevPitch: number | null = null;

      for (const note of sorted) {
        const measure = Math.floor(note.start / beatsPerBar);
        const pitches = note.pitches && note.pitches.length > 0 ? note.pitches : [note.pitch];

        if (note.duration <= 0 || !Number.isFinite(note.duration) || !Number.isFinite(note.start)) {
          issues.push({
            severity: "error",
            category: "bad-duration",
            partId: part.id,
            measure,
            beat: note.start,
            message: `non-positive or non-finite duration (${note.duration}) at start ${note.start}`,
          });
        }

        if (!part.polyphonic && note.start < prevEnd - 1e-6) {
          issues.push({
            severity: "error",
            category: "overlap",
            partId: part.id,
            measure,
            beat: note.start,
            message: `note at ${note.start} overlaps the previous note's end (${prevEnd}) on a monophonic voice`,
          });
        }
        prevEnd = Math.max(prevEnd, note.start + note.duration);

        const measureEnd = (measure + 1) * beatsPerBar;
        if (note.start + note.duration > measureEnd + 1e-6) {
          issues.push({
            severity: "error",
            category: "overflow",
            partId: part.id,
            measure,
            beat: note.start,
            message: `note runs past its measure's end (${measureEnd}) without crossing into the next one`,
          });
        }

        for (const p of pitches) {
          if (instrument && (p < instrument.rangeLow || p > instrument.rangeHigh)) {
            issues.push({
              severity: "error",
              category: "range",
              partId: part.id,
              measure,
              beat: note.start,
              message: `pitch ${p} is outside ${part.id}'s technical range [${instrument.rangeLow}, ${instrument.rangeHigh}]`,
            });
          }
        }

        const chord = chordByBar.get(measure);
        if (chord) {
          const triad = triadPitchClasses(chord.root, chord.quality);
          const primaryPc = ((pitches[0] % 12) + 12) % 12;
          const isChordTone = triad.includes(primaryPc);
          const isDiatonic = scale.has(primaryPc);
          if (!isChordTone && !isDiatonic) {
            issues.push({
              severity: "warning",
              category: "dissonance",
              partId: part.id,
              measure,
              beat: note.start,
              message: `pitch class ${primaryPc} is neither a chord tone of ${chord.root}/${chord.quality} nor diatonic to the estimated key`,
            });
          }
        }

        if (prevPitch !== null && part.id !== "electricBass" && part.id !== "tuba" && part.id !== "bassoon") {
          const leap = Math.abs(pitches[0] - prevPitch);
          if (leap >= LARGE_LEAP_SEMITONES) {
            issues.push({
              severity: "warning",
              category: "leap",
              partId: part.id,
              measure,
              beat: note.start,
              message: `large leap of ${leap} semitones from the previous note`,
            });
          }
        }
        prevPitch = pitches[0];
      }
    }
  }

  return issues;
}

/** Groups issues by category for a compact summary (counts only, not every instance). */
export function summarizeIssues(issues: ValidationIssue[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const issue of issues) {
    const key = `${issue.severity}:${issue.category}`;
    summary[key] = (summary[key] ?? 0) + 1;
  }
  return summary;
}
