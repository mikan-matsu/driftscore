import { triadPitchClasses } from "./chordProgression";
import { embellishMelody } from "./embellishMelody";
import { STYLES, renderBassPart, renderChordsPart } from "./genreStyles";
import type { InstrumentDef } from "./instruments";
import type { EstimatedKey } from "./keyEstimation";
import type { ArrangementPart, ChordSymbol, Genre, Melody, Note } from "./types";

const DEFAULT_CEILING = 84; // fallback comping ceiling for bars with no melody note (e.g. a rest)

/** Shifts a pitch by octaves until it lies within [low, high]. */
function foldToRange(pitch: number, low: number, high: number): number {
  let p = pitch;
  while (p < low) p += 12;
  while (p > high) p -= 12;
  return p;
}

function foldMelodyToRange(melody: Melody, low: number, high: number): Melody {
  return {
    ...melody,
    notes: melody.notes.map((n) => ({
      ...n,
      pitch: foldToRange(n.pitch, low, high),
      pitches: n.pitches?.map((p) => foldToRange(p, low, high)),
    })),
  };
}

/**
 * Picks a single whole-octave shift for the whole melody phrase — rather
 * than range-folding note by note, which can break a melody's contour by
 * shifting some notes but not others once it nears the range boundary — so
 * it lands as close as possible to the instrument's idiomatic register
 * (`idiomaticLow`/`idiomaticHigh`), not just anywhere it technically fits.
 * A flute part sitting at the very bottom of its technical range is
 * "playable" but not how a real arranger would voice it; see instruments.ts.
 * Falls back to centering on the full technical range when no idiomatic
 * band is defined for the instrument.
 */
function pickIdiomaticOctaveShift(melody: Melody, instrument: InstrumentDef): number {
  if (melody.notes.length === 0) return 0;
  const targetLow = instrument.idiomaticLow ?? instrument.rangeLow;
  const targetHigh = instrument.idiomaticHigh ?? instrument.rangeHigh;
  const targetCenter = (targetLow + targetHigh) / 2;

  const pitches = melody.notes.map((n) => n.pitch).sort((a, b) => a - b);
  const median = pitches[Math.floor(pitches.length / 2)];

  let bestShift = 0;
  let bestScore = Infinity;
  for (let octaves = -4; octaves <= 4; octaves++) {
    const shift = octaves * 12;
    const outOfTechnicalRange = melody.notes.filter((n) => {
      const p = n.pitch + shift;
      return p < instrument.rangeLow || p > instrument.rangeHigh;
    }).length;
    // Staying within the instrument's technically-playable range always wins
    // over getting closer to the idiomatic center — the idiomatic band is a
    // preference within what's playable, not a license to go out of range.
    const score = outOfTechnicalRange * 1000 + Math.abs(median + shift - targetCenter);
    if (score < bestScore) {
      bestScore = score;
      bestShift = shift;
    }
  }
  return bestShift;
}

/**
 * The standard comping technique is to voice accompaniment in the register
 * immediately below the melody, not in some independently-chosen register —
 * see e.g. jazz comping voice-leading practice. This computes, per bar, the
 * lowest melody pitch sounding in that bar (comping must stay below it), so
 * accompaniment is built anchored to the melody instead of drifting into it
 * and having to be shoved out of the way afterward.
 */
function computeMelodyCeilings(chords: ChordSymbol[], melodyNotes: Note[], beatsPerBar: number): number[] {
  let lastCeiling = DEFAULT_CEILING;
  return chords.map((chord) => {
    const barStart = chord.bar * beatsPerBar;
    const barEnd = barStart + beatsPerBar;
    const inBar = melodyNotes.filter((n) => n.start < barEnd && barStart < n.start + n.duration);
    if (inBar.length === 0) return lastCeiling;
    lastCeiling = Math.min(...inBar.map((n) => n.pitch));
    return lastCeiling;
  });
}

/**
 * Per-bar floor for accompaniment: the highest bass pitch sounding in that
 * bar (plus a small buffer), so comping doesn't drift down into the bass's
 * actual register — not just its nominal instrument range, which the bass
 * doesn't use uniformly (e.g. a walking approach tone can climb briefly).
 */
function computeBassFloors(chords: ChordSymbol[], bassNotes: Note[], beatsPerBar: number, fallback: number): number[] {
  let lastFloor = fallback;
  return chords.map((chord) => {
    const barStart = chord.bar * beatsPerBar;
    const barEnd = barStart + beatsPerBar;
    const inBar = bassNotes.filter((n) => n.start < barEnd && barStart < n.start + n.duration);
    if (inBar.length === 0) return lastFloor;
    lastFloor = Math.max(...inBar.map((n) => n.pitch)) + 1;
    return lastFloor;
  });
}

/**
 * Bar-level ceilings/floors handle the normal case, but a comping note that
 * sustains across a bar line (e.g. a syncopated hit landing just before the
 * barline) can still land in a register the *next* bar's melody or bass
 * moves into mid-sustain. This is a final, rare-case safety net using real
 * time overlap rather than bar membership, shifting the whole simultaneous
 * note (never per-tone, to keep the voicing's shape) out of the way.
 */
function clearOverlaps(notes: Note[], other: Note[], direction: "below" | "above"): Note[] {
  return notes.map((n) => {
    const pitches = n.pitches ?? [n.pitch];
    const overlapping = other.filter((o) => o.start < n.start + n.duration && n.start < o.start + o.duration);
    if (overlapping.length === 0) return n;
    let shift = 0;
    if (direction === "below") {
      const boundary = Math.min(...overlapping.map((o) => o.pitch));
      while (Math.max(...pitches) + shift >= boundary) shift -= 12;
    } else {
      const boundary = Math.max(...overlapping.map((o) => o.pitch));
      while (Math.min(...pitches) + shift <= boundary) shift += 12;
    }
    if (shift === 0) return n;
    const shifted = pitches.map((p) => p + shift);
    return { ...n, pitch: shifted[0], pitches: shifted.length > 1 ? shifted : undefined };
  });
}

function pickMelodyInstrument(ensemble: InstrumentDef[]): InstrumentDef {
  return ensemble.find((i) => i.roleAffinity === "melody") ?? ensemble[0];
}

function pickBassInstrument(candidates: InstrumentDef[]): InstrumentDef | null {
  if (candidates.length === 0) return null;
  return (
    candidates.find((i) => i.roleAffinity === "bass") ??
    candidates.reduce((lowest, i) => (i.rangeLow < lowest.rangeLow ? i : lowest))
  );
}

/**
 * Splits the genre's chord-tone stack across a set of monophonic instruments,
 * one tone per instrument per event, voice-led against each instrument's
 * previous note. The highest-register instrument is anchored below the
 * melody ceiling for that bar, and each lower instrument is then anchored
 * below the voice just above it, so voices stay in SATB-style descending
 * order without crossing. When there are fewer instruments than chord
 * tones, the lowest extensions are dropped; when there are more, the extra
 * (lowest-register) instruments rest.
 */
function renderHarmonyVoices(
  chords: ChordSymbol[],
  genre: Genre,
  beatsPerBar: number,
  instruments: InstrumentDef[],
  ceilings: number[],
  lows: number[],
): Map<string, Note[]> {
  const style = STYLES[genre];
  const byRegister = [...instruments].sort((a, b) => b.rangeHigh - a.rangeHigh);
  const notesByInstrument = new Map<string, Note[]>(byRegister.map((i) => [i.id, []]));
  const prevPitch = new Map<string, number>(
    byRegister.map((i) => [i.id, Math.round((i.rangeLow + i.rangeHigh) / 2)]),
  );
  let id = 0;

  chords.forEach((chord, barIndex) => {
    const triad = triadPitchClasses(chord.root, chord.quality);
    const seventh = (chord.root + (chord.quality === "maj" ? 11 : 10)) % 12;
    const tones = style.useSeventh ? [...triad, seventh] : triad;
    const pattern = style.chordPatterns[barIndex % style.chordPatterns.length];
    const ceiling = ceilings[barIndex];
    const low = lows[barIndex];

    for (const event of pattern) {
      const voiceCount = Math.min(byRegister.length, tones.length);
      let above = ceiling;
      for (let i = 0; i < voiceCount; i++) {
        const instrument = byRegister[i];
        const pc = tones[tones.length - 1 - i];
        const prev = prevPitch.get(instrument.id)!;
        let pitch = pc + 12 * Math.round((prev - pc) / 12);
        pitch = foldToRange(pitch, instrument.rangeLow, instrument.rangeHigh);
        while (pitch >= above) pitch -= 12; // ceiling wins even if it means dipping below the instrument's nominal low end
        while (pitch < low && pitch + 12 < above) pitch += 12; // then try to clear the bass too, without breaking the ceiling
        prevPitch.set(instrument.id, pitch);
        notesByInstrument.get(instrument.id)!.push({
          id: `h${id++}`,
          pitch,
          start: chord.bar * beatsPerBar + event.offset,
          duration: event.duration,
          velocity: 85,
        });
        above = pitch;
      }
    }
  });

  return notesByInstrument;
}

export function assignRoles(
  melody: Melody,
  chords: ChordSymbol[],
  genre: Genre,
  distortion: number,
  ensemble: InstrumentDef[],
  key: EstimatedKey,
): ArrangementPart[] {
  const beatsPerBar = melody.beatsPerBar;
  const melodyInstrument = pickMelodyInstrument(ensemble);
  const remaining = ensemble.filter((i) => i.id !== melodyInstrument.id);
  const bassInstrument = pickBassInstrument(remaining);
  const harmonyInstruments = remaining.filter((i) => i.id !== bassInstrument?.id);

  const shift = pickIdiomaticOctaveShift(melody, melodyInstrument);
  const shiftedMelody: Melody = shift
    ? { ...melody, notes: melody.notes.map((n) => ({ ...n, pitch: n.pitch + shift, pitches: n.pitches?.map((p) => p + shift) })) }
    : melody;

  const melodyPart: ArrangementPart = {
    id: melodyInstrument.id,
    name: melodyInstrument.name,
    clef: melodyInstrument.clef,
    transposeSemitones: melodyInstrument.transposeSemitones,
    polyphonic: melodyInstrument.polyphonic,
    melody: foldMelodyToRange(embellishMelody(shiftedMelody, distortion, key), melodyInstrument.rangeLow, melodyInstrument.rangeHigh),
  };
  const ceilings = computeMelodyCeilings(chords, melodyPart.melody.notes, beatsPerBar);

  const bassPart: ArrangementPart | null = bassInstrument
    ? {
        id: bassInstrument.id,
        name: bassInstrument.name,
        clef: bassInstrument.clef,
        transposeSemitones: bassInstrument.transposeSemitones,
        polyphonic: bassInstrument.polyphonic,
        melody: foldMelodyToRange(
          { beatsPerBar, notes: renderBassPart(chords, genre, beatsPerBar) },
          bassInstrument.rangeLow,
          bassInstrument.rangeHigh,
        ),
      }
    : null;
  const bassFloors = computeBassFloors(chords, bassPart?.melody.notes ?? [], beatsPerBar, bassInstrument?.rangeHigh ?? 0);

  const harmonyParts: ArrangementPart[] = [];
  const polyHarmony = harmonyInstruments.filter((i) => i.polyphonic);
  const monoHarmony = harmonyInstruments.filter((i) => !i.polyphonic);

  for (const instrument of polyHarmony) {
    const lows = bassFloors.map((f) => Math.max(instrument.rangeLow, f));
    harmonyParts.push({
      id: instrument.id,
      name: instrument.name,
      clef: instrument.clef,
      transposeSemitones: instrument.transposeSemitones,
      polyphonic: instrument.polyphonic,
      melody: { beatsPerBar, notes: renderChordsPart(chords, genre, beatsPerBar, ceilings, lows) },
    });
  }
  if (monoHarmony.length > 0) {
    const lowestRange = Math.min(...monoHarmony.map((i) => i.rangeLow));
    const lows = bassFloors.map((f) => Math.max(lowestRange, f));
    const voices = renderHarmonyVoices(chords, genre, beatsPerBar, monoHarmony, ceilings, lows);
    for (const instrument of monoHarmony) {
      harmonyParts.push({
        id: instrument.id,
        name: instrument.name,
        clef: instrument.clef,
        transposeSemitones: instrument.transposeSemitones,
        polyphonic: instrument.polyphonic,
        melody: { beatsPerBar, notes: voices.get(instrument.id) ?? [] },
      });
    }
  }

  const clearedHarmonyParts = harmonyParts.map((part) => ({
    ...part,
    melody: {
      ...part.melody,
      notes: clearOverlaps(
        clearOverlaps(part.melody.notes, melodyPart.melody.notes, "below"),
        bassPart?.melody.notes ?? [],
        "above",
      ),
    },
  }));

  // Staff order top-to-bottom: melody, then harmony (high to low register), then bass at the very bottom.
  return [melodyPart, ...clearedHarmonyParts, ...(bassPart ? [bassPart] : [])];
}
