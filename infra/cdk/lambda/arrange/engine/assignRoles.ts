import { triadPitchClasses } from "./chordProgression";
import { embellishMelody } from "./embellishMelody";
import { STYLES, renderBassPart, renderChordsPart } from "./genreStyles";
import type { InstrumentDef } from "./instruments";
import type { EstimatedKey } from "./keyEstimation";
import type { ArrangementPart, ChordSymbol, Genre, Melody, Note } from "./types";

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
 * Drops any accompaniment note whose register collides with the melody note
 * sounding at the same time down an octave (as long as that stays within
 * `low`), so comping doesn't fight the melody for the same register.
 */
function lowerBelowMelody(melody: Melody, melodyNotes: Note[], low: number): Melody {
  return {
    ...melody,
    notes: melody.notes.map((n) => {
      const pitches = n.pitches ?? [n.pitch];
      const overlapping = melodyNotes.filter(
        (m) => m.start < n.start + n.duration && n.start < m.start + m.duration,
      );
      if (overlapping.length === 0) return n;
      const melodyFloor = Math.min(...overlapping.map((m) => m.pitch));
      let shift = 0;
      while (Math.max(...pitches) + shift >= melodyFloor && Math.min(...pitches) + shift - 12 >= low) {
        shift -= 12;
      }
      if (shift === 0) return n;
      const shifted = pitches.map((p) => p + shift);
      return { ...n, pitch: shifted[0], pitches: shifted.length > 1 ? shifted : undefined };
    }),
  };
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
 * one tone per instrument per event (top tone to the highest-register
 * instrument), voice-led against each instrument's previous note. When there
 * are fewer instruments than chord tones, the lowest extensions are dropped;
 * when there are more, the extra (lowest-register) instruments rest.
 */
function renderHarmonyVoices(
  chords: ChordSymbol[],
  genre: Genre,
  beatsPerBar: number,
  instruments: InstrumentDef[],
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

    for (const event of pattern) {
      const voiceCount = Math.min(byRegister.length, tones.length);
      for (let i = 0; i < voiceCount; i++) {
        const instrument = byRegister[i];
        const pc = tones[tones.length - 1 - i];
        const prev = prevPitch.get(instrument.id)!;
        let pitch = pc + 12 * Math.round((prev - pc) / 12);
        pitch = foldToRange(pitch, instrument.rangeLow, instrument.rangeHigh);
        prevPitch.set(instrument.id, pitch);
        notesByInstrument.get(instrument.id)!.push({
          id: `h${id++}`,
          pitch,
          start: chord.bar * beatsPerBar + event.offset,
          duration: event.duration,
          velocity: 85,
        });
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

  const melodyPart: ArrangementPart = {
    id: melodyInstrument.id,
    name: melodyInstrument.name,
    clef: melodyInstrument.clef,
    transposeSemitones: melodyInstrument.transposeSemitones,
    polyphonic: melodyInstrument.polyphonic,
    melody: foldMelodyToRange(embellishMelody(melody, distortion, key), melodyInstrument.rangeLow, melodyInstrument.rangeHigh),
  };
  const melodyNotes = melodyPart.melody.notes;

  const harmonyParts: ArrangementPart[] = [];
  const polyHarmony = harmonyInstruments.filter((i) => i.polyphonic);
  const monoHarmony = harmonyInstruments.filter((i) => !i.polyphonic);

  for (const instrument of polyHarmony) {
    const inRange = foldMelodyToRange(
      { beatsPerBar, notes: renderChordsPart(chords, genre, beatsPerBar) },
      instrument.rangeLow,
      instrument.rangeHigh,
    );
    harmonyParts.push({
      id: instrument.id,
      name: instrument.name,
      clef: instrument.clef,
      transposeSemitones: instrument.transposeSemitones,
      polyphonic: instrument.polyphonic,
      melody: lowerBelowMelody(inRange, melodyNotes, instrument.rangeLow),
    });
  }
  if (monoHarmony.length > 0) {
    const voices = renderHarmonyVoices(chords, genre, beatsPerBar, monoHarmony);
    for (const instrument of monoHarmony) {
      const inRange: Melody = { beatsPerBar, notes: voices.get(instrument.id) ?? [] };
      harmonyParts.push({
        id: instrument.id,
        name: instrument.name,
        clef: instrument.clef,
        transposeSemitones: instrument.transposeSemitones,
        polyphonic: instrument.polyphonic,
        melody: lowerBelowMelody(inRange, melodyNotes, instrument.rangeLow),
      });
    }
  }

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

  // Staff order top-to-bottom: melody, then harmony (high to low register), then bass at the very bottom.
  return [melodyPart, ...harmonyParts, ...(bassPart ? [bassPart] : [])];
}
