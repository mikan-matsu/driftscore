import { estimateKey } from "./keyEstimation";
import { estimateChordProgression } from "./chordProgression";
import { assignRoles } from "./assignRoles";
import { ENSEMBLE_PRESETS, DEFAULT_ENSEMBLE_ID } from "./ensembles";
import { applySwing } from "./swing";
import type { Arrangement, Genre, Melody } from "./types";

export function generateArrangement(
  melody: Melody,
  genre: Genre,
  distortion: number,
  ensembleId: string = DEFAULT_ENSEMBLE_ID,
): Arrangement {
  const preset = ENSEMBLE_PRESETS[ensembleId] ?? ENSEMBLE_PRESETS[DEFAULT_ENSEMBLE_ID];
  const key = estimateKey(melody);
  const chords = estimateChordProgression(melody, key);
  const beatsPerBar = melody.beatsPerBar;

  let parts = assignRoles(melody, chords, genre, distortion, preset.instruments, key);
  if (genre === "jazz") {
    parts = parts.map((part) => ({ ...part, melody: { ...part.melody, notes: applySwing(part.melody.notes) } }));
  }

  return {
    genre,
    distortion,
    ensembleId: preset.id,
    beatsPerBar,
    chords,
    melodyPartId: parts[0].id,
    parts,
  };
}
