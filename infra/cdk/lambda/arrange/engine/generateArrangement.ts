import { estimateKey } from "./keyEstimation";
import { estimateChordProgression } from "./chordProgression";
import { assignRoles } from "./assignRoles";
import { applyBreakHits } from "./breakHits";
import { ENSEMBLE_PRESETS, DEFAULT_ENSEMBLE_ID } from "./ensembles";
import type { InstrumentDef } from "./instruments";
import { buildSongForm } from "./songForm";
import { renderDrumPart } from "./drums";
import type { Arrangement, ArrangementPart, Genre, Melody, Section } from "./types";

export type SongForm = "theme" | "full";

/**
 * Shifts every note by the smallest signed semitone distance that moves the
 * melody's tonic onto `targetRoot` (range -5..+6), rather than always
 * transposing upward — an upward-only shift could move a low melody up to
 * nearly two octaves for what's musically just a semitone away in the other
 * direction.
 */
function transposeMelody(melody: Melody, fromRoot: number, targetRoot: number): Melody {
  const shift = (((targetRoot - fromRoot + 6) % 12) + 12) % 12 - 6;
  if (shift === 0) return melody;
  return {
    ...melody,
    notes: melody.notes.map((n) => ({
      ...n,
      pitch: n.pitch + shift,
      pitches: n.pitches?.map((p) => p + shift),
    })),
  };
}

export function generateArrangement(
  inputMelody: Melody,
  genre: Genre,
  distortion: number,
  ensembleId: string = DEFAULT_ENSEMBLE_ID,
  targetKeyRoot?: number | null,
  songForm: SongForm = "theme",
  /** Freeform instrument list for a custom (non-preset) ensemble — when set, overrides `ensembleId` entirely and the returned arrangement's `ensembleId` is "custom". */
  customInstruments?: InstrumentDef[],
): Arrangement {
  const preset = customInstruments
    ? { id: "custom", name: "Custom", instruments: customInstruments }
    : ENSEMBLE_PRESETS[ensembleId] ?? ENSEMBLE_PRESETS[DEFAULT_ENSEMBLE_ID];
  const detectedKey = estimateKey(inputMelody);
  const hasTargetKey = typeof targetKeyRoot === "number" && targetKeyRoot !== detectedKey.root;
  const melody = hasTargetKey ? transposeMelody(inputMelody, detectedKey.root, targetKeyRoot) : inputMelody;
  const key = hasTargetKey ? { root: targetKeyRoot, isMinor: detectedKey.isMinor } : detectedKey;
  const themeChords = estimateChordProgression(melody, key);
  const beatsPerBar = melody.beatsPerBar;

  let fullMelody = melody;
  let chords = themeChords;
  let sections: Section[] = [{ kind: "theme", startBar: 0, barCount: themeChords.length }];
  if (songForm === "full") {
    const form = buildSongForm(melody, themeChords, beatsPerBar, key, genre);
    fullMelody = form.melody;
    chords = form.chords;
    sections = form.sections;
  }

  // Notation stays straight eighths even for jazz — swing is a playback-time
  // interpretation of straight-eighth notation (the real convention: a jazz
  // chart is written straight with a "Swing" marking, not spelled out as
  // dotted-8th+16th throughout), so it's applied client-side in
  // playArrangement.ts, not baked into the notes here. See that file's
  // swingTime() for the actual transform.
  let parts = assignRoles(fullMelody, chords, genre, distortion, preset.instruments, key, sections, preset.layout);

  let drumVoices = renderDrumPart(chords, genre, beatsPerBar, sections);

  const breakSection = sections.find((s) => s.kind === "break");
  if (breakSection) {
    const applied = applyBreakHits(parts, drumVoices, chords, breakSection, beatsPerBar, preset.instruments);
    parts = applied.parts;
    drumVoices = applied.drumVoices;
  }

  if (drumVoices) {
    const drumPart: ArrangementPart = {
      id: "drums",
      // "Drums" (a kit: kick/snare/toms/cymbals) is the wrong word for what
      // this part actually contains once hand percussion enters the mix —
      // samba's pattern (see drums.ts's SAMBA_BAR) is built on maracas and
      // agogô, instruments from a samba bateria, not a drum kit, even
      // though they share this one notated part with the kick. Genres whose
      // pattern really is just a drum kit (rock/jazz/funk: kick/snare/
      // hihat/ride/toms, see ROCK_BAR/JAZZ_BAR/FUNK_BAR) keep "Drums".
      name: genre === "samba" ? "Percussion" : "Drums",
      clef: "percussion",
      transposeSemitones: 0,
      polyphonic: true,
      melody: { beatsPerBar, notes: drumVoices.up },
      secondaryVoice: { beatsPerBar, notes: drumVoices.down },
    };
    parts = [...parts, drumPart];
  }

  return {
    genre,
    distortion,
    ensembleId: preset.id,
    beatsPerBar,
    key,
    chords,
    // parts[0] is the melody instrument for every small preset (assignRoles's
    // default path always returns it first), but a layout-driven ensemble
    // (e.g. wind band) returns parts in band score order instead, so the
    // primary melody instrument isn't necessarily first — fall back to the
    // layout's own explicit answer in that case.
    melodyPartId: preset.layout?.melody ?? parts[0].id,
    parts,
    sections,
  };
}
