import { triadPitchClasses } from "./chordProgression";
import type { DrumVoices } from "./drums";
import { GM_HIHAT_CLOSED, GM_KICK, GM_SNARE } from "./drums";
import type { ArrangementPart, ChordSymbol, Note, Section } from "./types";

interface Hit {
  offset: number;
  duration: number;
}

// A recognizable "shout"/kime rhythm — two short stabs then a held hit —
// rather than anything genre-specific, since every instrument (including
// drums) plays exactly this same rhythm together; that unison IS the effect.
const HIT_PATTERN: Hit[] = [
  { offset: 0, duration: 0.5 },
  { offset: 1, duration: 0.5 },
  { offset: 2, duration: 2 },
];

/** Resolves each of `prevPitches` (one per existing voice) to the nearest octave of a chord tone, cycling through `tones` if there are more voices than tones. */
function resolveVoicing(prevPitches: number[], tones: number[]): number[] {
  const voices = prevPitches.length > 0 ? prevPitches : [60];
  return voices.map((prev, i) => {
    const pc = tones[i % tones.length];
    return pc + 12 * Math.round((prev - pc) / 12);
  });
}

function lastPitchesBefore(notes: Note[], beat: number): number[] {
  const before = notes.filter((n) => n.start < beat).sort((a, b) => a.start - b.start);
  const last = before[before.length - 1];
  if (!last) return [];
  return last.pitches && last.pitches.length > 0 ? last.pitches : [last.pitch];
}

/**
 * Overrides a bar range with a shared unison rhythm across every part
 * (including drums) — a "キメ"/shout-chorus break, where all instruments
 * hitting the exact same rhythm together is the whole point. Done as a
 * post-process (strip the range's notes, splice in the shared hits) rather
 * than threading a break flag through genreStyles/drums/assignRoles: those
 * five-plus call sites each generate rhythm from their own genre-specific
 * pattern tables, which have nothing in common with "every part plays the
 * same rhythm" — a post-process keeps that one-off logic in one place
 * instead of spread across files that otherwise don't need to know about it.
 */
export function applyBreakHits(
  parts: ArrangementPart[],
  drumVoices: DrumVoices | null,
  chords: ChordSymbol[],
  breakSection: Section,
  beatsPerBar: number,
): { parts: ArrangementPart[]; drumVoices: DrumVoices | null } {
  const breakStart = breakSection.startBar * beatsPerBar;
  const breakEnd = breakStart + breakSection.barCount * beatsPerBar;
  // Defensive: only use hits that fit within a single bar, in case beatsPerBar is ever smaller than assumed.
  const hits = HIT_PATTERN.filter((h) => h.offset + h.duration <= beatsPerBar);

  const newParts = parts.map((part) => {
    const prevPitches = lastPitchesBefore(part.melody.notes, breakStart);
    const kept = part.melody.notes.filter((n) => n.start < breakStart || n.start >= breakEnd);
    const inserted: Note[] = [];
    let id = 0;
    for (let bar = breakSection.startBar; bar < breakSection.startBar + breakSection.barCount; bar++) {
      const chord = chords.find((c) => c.bar === bar);
      if (!chord) continue;
      const tones = triadPitchClasses(chord.root, chord.quality);
      for (const hit of hits) {
        const pitches = resolveVoicing(prevPitches, tones);
        inserted.push({
          id: `bk${id++}`,
          pitch: pitches[0],
          pitches: pitches.length > 1 ? pitches : undefined,
          start: bar * beatsPerBar + hit.offset,
          duration: hit.duration,
          velocity: 105,
        });
      }
    }
    return { ...part, melody: { ...part.melody, notes: [...kept, ...inserted] } };
  });

  let newDrumVoices = drumVoices;
  if (drumVoices) {
    const keepUp = drumVoices.up.filter((n) => n.start < breakStart || n.start >= breakEnd);
    const keepDown = drumVoices.down.filter((n) => n.start < breakStart || n.start >= breakEnd);
    const up: Note[] = [];
    const down: Note[] = [];
    let upId = 0;
    let downId = 0;
    for (let bar = breakSection.startBar; bar < breakSection.startBar + breakSection.barCount; bar++) {
      for (const hit of hits) {
        const start = bar * beatsPerBar + hit.offset;
        up.push({ id: `bku${upId++}`, pitch: GM_SNARE, pitches: [GM_SNARE, GM_HIHAT_CLOSED], start, duration: hit.duration, velocity: 110 });
        down.push({ id: `bkd${downId++}`, pitch: GM_KICK, start, duration: hit.duration, velocity: 110 });
      }
    }
    newDrumVoices = { up: [...keepUp, ...up], down: [...keepDown, ...down] };
  }

  return { parts: newParts, drumVoices: newDrumVoices };
}
