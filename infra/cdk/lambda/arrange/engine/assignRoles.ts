import { triadPitchClasses } from "./chordProgression";
import { renderCountermelody } from "./countermelody";
import { embellishMelody } from "./embellishMelody";
import { STYLES, renderBassPart, renderChordsPart } from "./genreStyles";
import type { InstrumentDef } from "./instruments";
import type { EstimatedKey } from "./keyEstimation";
import { renderParallelHarmony } from "./parallelHarmony";
import type { ArrangementPart, ChordSymbol, Genre, Melody, Note, Section } from "./types";

const DEFAULT_CEILING = 84; // fallback comping ceiling for bars with no melody note (e.g. a rest)

// A small ensemble has no other instrument to cover a neighboring registral
// "slot", so real arrangers let each part range further toward its extremes
// than they would in a full section — a wider *tolerance* around the same
// idiomatic center, not a different center. All current presets (piano trio,
// woodwind quartet, clarinet/guitar/bass, brass quintet) are this small, so
// SMALL_ENSEMBLE_SIZE covers them; LARGE_ENSEMBLE_SIZE is a placeholder for
// when a full concert-band preset exists, where the pressure disappears.
const SMALL_ENSEMBLE_SIZE = 5;
const LARGE_ENSEMBLE_SIZE = 10;
const MAX_IDIOMATIC_TOLERANCE = 0.5; // small ensembles may stray up to halfway from the idiomatic edge to the technical edge before being penalized

/** How far outside its idiomatic band a small ensemble's part may stray before the octave-shift scoring penalizes it — 0 (large ensemble) to MAX_IDIOMATIC_TOLERANCE (small ensemble). */
function idiomaticTolerance(ensembleSize: number): number {
  if (ensembleSize <= SMALL_ENSEMBLE_SIZE) return MAX_IDIOMATIC_TOLERANCE;
  if (ensembleSize >= LARGE_ENSEMBLE_SIZE) return 0;
  return (MAX_IDIOMATIC_TOLERANCE * (LARGE_ENSEMBLE_SIZE - ensembleSize)) / (LARGE_ENSEMBLE_SIZE - SMALL_ENSEMBLE_SIZE);
}

/** 0 when `value` is inside [low, high]; otherwise the distance to the nearest edge — being anywhere inside the idiomatic band is equally fine, not just its exact center. */
function distanceFromBand(value: number, low: number, high: number): number {
  if (value < low) return low - value;
  if (value > high) return value - high;
  return 0;
}

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
 * band is defined for the instrument. `ensembleSize` widens the idiomatic
 * band's tolerance for small ensembles — see idiomaticTolerance().
 */
function pickIdiomaticOctaveShift(melody: Melody, instrument: InstrumentDef, ensembleSize: number): number {
  if (melody.notes.length === 0) return 0;
  const idiomLow = instrument.idiomaticLow ?? instrument.rangeLow;
  const idiomHigh = instrument.idiomaticHigh ?? instrument.rangeHigh;
  const tolerance = idiomaticTolerance(ensembleSize);
  const targetLow = idiomLow - tolerance * (idiomLow - instrument.rangeLow);
  const targetHigh = idiomHigh + tolerance * (instrument.rangeHigh - idiomHigh);

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
    // over getting closer to the idiomatic band — the band (widened by
    // ensemble-size tolerance) is a preference within what's playable, not a
    // license to go out of range.
    const score = outOfTechnicalRange * 1000 + distanceFromBand(median + shift, targetLow, targetHigh);
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
function clearOverlaps(
  notes: Note[],
  other: Note[],
  direction: "below" | "above",
  rangeLow: number,
  rangeHigh: number,
): Note[] {
  return notes.map((n) => {
    const pitches = n.pitches ?? [n.pitch];
    const overlapping = other.filter((o) => o.start < n.start + n.duration && n.start < o.start + o.duration);
    if (overlapping.length === 0) return n;
    let shift = 0;
    // Shifting a whole octave at a time to clear a collision has no bound
    // of its own — a low enough melody note (or high enough bass note)
    // could otherwise push shift past the instrument's actual technical
    // range (found via validateArrangement.test.ts). Stop at the range
    // edge and accept the overlap rather than hand the instrument an
    // unplayable pitch; a moment of voices crossing is a lesser defect
    // than a pitch outside the instrument's range entirely.
    if (direction === "below") {
      const boundary = Math.min(...overlapping.map((o) => o.pitch));
      while (Math.max(...pitches) + shift >= boundary && Math.min(...pitches) + shift - 12 >= rangeLow) shift -= 12;
    } else {
      const boundary = Math.max(...overlapping.map((o) => o.pitch));
      while (Math.min(...pitches) + shift <= boundary && Math.max(...pitches) + shift + 12 <= rangeHigh) shift += 12;
    }
    if (shift === 0) return n;
    const shifted = pitches.map((p) => p + shift);
    return { ...n, pitch: shifted[0], pitches: shifted.length > 1 ? shifted : undefined };
  });
}

/**
 * Where the harmony line (ハモリ) and countermelody textures are each active,
 * in beats. In song-form mode (a "reprise" section exists), harmony is
 * reserved for the reprise and countermelody for the theme's own rests —
 * texture builds toward the reprise instead of appearing throughout. With no
 * "reprise" section (plain "theme"-only mode), this falls back to the
 * original whole-piece-halved split so that mode's output is unchanged.
 */
function textureRanges(
  sections: Section[] | undefined,
  beatsPerBar: number,
  chordsLength: number,
): { harmonyFromBeat: number; countermelodyFromBeat: number; countermelodyUntilBeat: number } {
  const reprise = sections?.find((s) => s.kind === "reprise");
  const theme = sections?.find((s) => s.kind === "theme");
  if (reprise && theme) {
    return {
      harmonyFromBeat: reprise.startBar * beatsPerBar,
      countermelodyFromBeat: theme.startBar * beatsPerBar,
      countermelodyUntilBeat: (theme.startBar + theme.barCount) * beatsPerBar,
    };
  }
  const halfBeat = Math.floor(chordsLength / 2) * beatsPerBar;
  return { harmonyFromBeat: halfBeat, countermelodyFromBeat: 0, countermelodyUntilBeat: halfBeat };
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
  ensembleSize: number,
): Map<string, Note[]> {
  const style = STYLES[genre];
  const byRegister = [...instruments].sort((a, b) => b.rangeHigh - a.rangeHigh);
  const notesByInstrument = new Map<string, Note[]>(byRegister.map((i) => [i.id, []]));
  // Seed voice-leading from each instrument's harmony-role idiomatic center
  // (falling back to its melody-role idiomatic center, then the full
  // technical range) rather than always the bare technical-range midpoint —
  // subsequent notes follow via nearest-voice voice-leading below, so this
  // seed is what actually anchors where the part tends to sit.
  const prevPitch = new Map<string, number>(
    byRegister.map((i) => {
      const low = i.harmonyIdiomaticLow ?? i.idiomaticLow ?? i.rangeLow;
      const high = i.harmonyIdiomaticHigh ?? i.idiomaticHigh ?? i.rangeHigh;
      return [i.id, Math.round((low + high) / 2)];
    }),
  );
  // Same per-instrument harmony-role idiomatic band used to seed prevPitch
  // above, widened by the same small-ensemble tolerance the melody-octave
  // picker uses (idiomaticTolerance) — kept per-instrument here since each
  // voice in a harmony/bass stack has its own band, unlike the single
  // melody phrase pickIdiomaticOctaveShift handles.
  const tolerance = idiomaticTolerance(ensembleSize);
  const idiomBands = new Map<string, { low: number; high: number }>(
    byRegister.map((i) => {
      const idiomLow = i.harmonyIdiomaticLow ?? i.idiomaticLow ?? i.rangeLow;
      const idiomHigh = i.harmonyIdiomaticHigh ?? i.idiomaticHigh ?? i.rangeHigh;
      return [
        i.id,
        {
          low: idiomLow - tolerance * (idiomLow - i.rangeLow),
          high: idiomHigh + tolerance * (i.rangeHigh - idiomHigh),
        },
      ];
    }),
  );
  let id = 0;

  chords.forEach((chord, barIndex) => {
    const triad = triadPitchClasses(chord.root, chord.quality);
    const seventh = (chord.root + (chord.quality === "maj" ? 11 : 10)) % 12;
    const tones = style.useSeventh ? [...triad, seventh] : triad;
    const pattern = style.chordPatterns[barIndex % style.chordPatterns.length];
    const ceiling = ceilings[barIndex];
    const low = lows[barIndex];
    const measureEnd = (chord.bar + 1) * beatsPerBar;

    for (const event of pattern) {
      const voiceCount = Math.min(byRegister.length, tones.length);
      let above = ceiling;
      const start = chord.bar * beatsPerBar + event.offset;
      let duration = event.duration;
      // Clamp duration to not exceed measure boundary (handles floating-point accumulation)
      if (start + duration > measureEnd) duration = measureEnd - start;
      for (let i = 0; i < voiceCount; i++) {
        const instrument = byRegister[i];
        const pc = tones[tones.length - 1 - i];
        const prev = prevPitch.get(instrument.id)!;
        let pitch = pc + 12 * Math.round((prev - pc) / 12);
        pitch = foldToRange(pitch, instrument.rangeLow, instrument.rangeHigh);
        // Ceiling wins even if it means dipping toward the instrument's
        // nominal low end — but never past its actual technical floor. A
        // real arranger accepts a comping voice brushing against the
        // melody's register over handing an instrument a pitch it can't
        // physically play; this bound was missing before, letting a low
        // ceiling push some voices (e.g. oboe/2nd trumpet in comping-heavy
        // stretches) below their real playable range entirely.
        while (pitch >= above && pitch - 12 >= instrument.rangeLow) pitch -= 12;
        // Then try to clear the bass too, without breaking the ceiling or the instrument's own technical ceiling.
        while (pitch < low && pitch + 12 < above && pitch + 12 <= instrument.rangeHigh) pitch += 12;
        // Nearest-voice voice-leading can drift the part away from its
        // idiomatic register over a stretch of low ceilings/high floors and
        // then never find its way back once the constraint eases, since
        // each note only looks at the previous one. Nudge it a whole octave
        // toward the idiomatic band when room allows — ceiling/floor still
        // win outright, this only ever fires when both are still satisfied.
        const band = idiomBands.get(instrument.id)!;
        while (pitch < band.low && pitch + 12 <= band.high && pitch + 12 < above && pitch + 12 >= low) pitch += 12;
        while (pitch > band.high && pitch - 12 >= band.low && pitch - 12 >= low && pitch - 12 < above) pitch -= 12;
        prevPitch.set(instrument.id, pitch);
        notesByInstrument.get(instrument.id)!.push({
          id: `h${id++}`,
          pitch,
          start,
          duration,
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
  sections?: Section[],
): ArrangementPart[] {
  const beatsPerBar = melody.beatsPerBar;
  const melodyInstrument = pickMelodyInstrument(ensemble);
  const remaining = ensemble.filter((i) => i.id !== melodyInstrument.id);
  const bassInstrument = pickBassInstrument(remaining);
  const harmonyInstruments = remaining.filter((i) => i.id !== bassInstrument?.id);

  const shift = pickIdiomaticOctaveShift(melody, melodyInstrument, ensemble.length);
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

  // renderBassPart's octave is a fixed genre-style constant
  // (STYLES[genre].bassOctaveBase), the same for every instrument — without
  // this, an electric bass, tuba, and bassoon playing the same bass line all
  // landed in whatever register that one constant happened to fold into,
  // rather than each instrument's own idiomatic bass register (e.g. bassoon
  // sits comfortably higher than tuba). Reuses the same whole-phrase octave
  // picker as the melody instrument, just with the bass instrument's own
  // idiomaticLow/High band.
  const bassPart: ArrangementPart | null = bassInstrument
    ? {
        id: bassInstrument.id,
        name: bassInstrument.name,
        clef: bassInstrument.clef,
        transposeSemitones: bassInstrument.transposeSemitones,
        polyphonic: bassInstrument.polyphonic,
        melody: (() => {
          const rawBass: Melody = { beatsPerBar, notes: renderBassPart(chords, genre, beatsPerBar) };
          const bassShift = pickIdiomaticOctaveShift(rawBass, bassInstrument, ensemble.length);
          const shiftedBass = bassShift
            ? { ...rawBass, notes: rawBass.notes.map((n) => ({ ...n, pitch: n.pitch + bassShift })) }
            : rawBass;
          return foldMelodyToRange(shiftedBass, bassInstrument.rangeLow, bassInstrument.rangeHigh);
        })(),
      }
    : null;
  const bassFloors = computeBassFloors(chords, bassPart?.melody.notes ?? [], beatsPerBar, bassInstrument?.rangeHigh ?? 0);

  const harmonyParts: ArrangementPart[] = [];
  const polyHarmony = harmonyInstruments.filter((i) => i.polyphonic);
  const restHarmony = harmonyInstruments.filter((i) => !i.polyphonic);

  // Real arrangements don't harmonize or answer the melody constantly —
  // texture builds over the piece. The countermelody (call-and-response
  // filling the melody's rests, when there's a spare voice for it) and the
  // harmony line (parallel diatonic-third "ハモリ") are reserved for
  // different, non-overlapping spans — see textureRanges().
  const { harmonyFromBeat, countermelodyFromBeat, countermelodyUntilBeat } = textureRanges(
    sections,
    beatsPerBar,
    chords.length,
  );

  // Highest-register monophonic harmony instrument — closest to the
  // melody's own register — carries the harmony line in the second half.
  // Skipped entirely when there's no monophonic harmony instrument (e.g.
  // piano trio, clarinet/guitar/bass) — a chordal (polyphonic) instrument
  // doesn't fit this role, since it already voices full chords on its own.
  const harmonyLineInstrument =
    restHarmony.length > 0 ? restHarmony.reduce((top, i) => (i.rangeHigh > top.rangeHigh ? i : top)) : null;
  // Next-highest-register remaining instrument answers the melody's rests in
  // the first half — only when there's a THIRD monophonic harmony
  // instrument to spare (e.g. brass quintet's horn, once trumpet 2 has the
  // harmony line and trombone is left free to comp); otherwise every
  // instrument just comps and no countermelody plays this arrangement.
  const nonHarmonyLine = restHarmony.filter((i) => i.id !== harmonyLineInstrument?.id);
  const countermelodyInstrument =
    nonHarmonyLine.length >= 2 ? nonHarmonyLine.reduce((top, i) => (i.rangeHigh > top.rangeHigh ? i : top)) : null;

  if (restHarmony.length > 0) {
    const lowestRange = Math.min(...restHarmony.map((i) => i.rangeLow));
    const lows = bassFloors.map((f) => Math.max(lowestRange, f));
    const compingVoices = renderHarmonyVoices(chords, genre, beatsPerBar, restHarmony, ceilings, lows, ensemble.length);

    for (const instrument of restHarmony) {
      const comping = compingVoices.get(instrument.id) ?? [];
      let notes = comping;

      if (instrument.id === harmonyLineInstrument?.id) {
        const harmonyLine = foldMelodyToRange(
          renderParallelHarmony(melodyPart.melody, key),
          instrument.rangeLow,
          instrument.rangeHigh,
        ).notes.filter((n) => n.start >= harmonyFromBeat);
        notes = [...comping.filter((n) => n.start < harmonyFromBeat), ...harmonyLine];
      } else if (instrument.id === countermelodyInstrument?.id) {
        const startingPitch = Math.round(((instrument.idiomaticLow ?? instrument.rangeLow) + (instrument.idiomaticHigh ?? instrument.rangeHigh)) / 2);
        // renderCountermelody voice-leads purely by nearest-octave-to-
        // previous-note with no ceiling/floor of its own, so a long enough
        // answering line can drift outside the instrument's technical range
        // over time (found via validateArrangement.test.ts: trumpetBb2
        // landing a couple semitones under its floor) — fold it back the
        // same way the harmony-line branch above already does.
        const answers = foldMelodyToRange(
          { beatsPerBar, notes: renderCountermelody(
            melodyPart.melody.notes,
            chords,
            beatsPerBar,
            countermelodyUntilBeat,
            startingPitch,
            countermelodyFromBeat,
          ) },
          instrument.rangeLow,
          instrument.rangeHigh,
        ).notes;
        notes = [
          ...comping.filter((n) => n.start < countermelodyFromBeat),
          ...answers,
          ...comping.filter((n) => n.start >= countermelodyUntilBeat),
        ];
      }

      harmonyParts.push({
        id: instrument.id,
        name: instrument.name,
        clef: instrument.clef,
        transposeSemitones: instrument.transposeSemitones,
        polyphonic: instrument.polyphonic,
        melody: { beatsPerBar, notes },
      });
    }
  }

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

  const clearedHarmonyParts = harmonyParts.map((part) => {
    const instrument = harmonyInstruments.find((i) => i.id === part.id);
    const rangeLow = instrument?.rangeLow ?? -Infinity;
    const rangeHigh = instrument?.rangeHigh ?? Infinity;
    return {
      ...part,
      melody: {
        ...part.melody,
        notes: clearOverlaps(
          clearOverlaps(part.melody.notes, melodyPart.melody.notes, "below", rangeLow, rangeHigh),
          bassPart?.melody.notes ?? [],
          "above",
          rangeLow,
          rangeHigh,
        ),
      },
    };
  });

  // Staff order top-to-bottom: melody, then harmony (high to low register), then bass at the very bottom.
  return [melodyPart, ...clearedHarmonyParts, ...(bassPart ? [bassPart] : [])];
}
