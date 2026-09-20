import { estimateKey } from "./keyEstimation";
import { estimateChordProgression } from "./chordProgression";
import { assignRoles } from "./assignRoles";
import { ENSEMBLE_PRESETS, DEFAULT_ENSEMBLE_ID } from "./ensembles";
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

  const parts = assignRoles(melody, chords, genre, distortion, preset.instruments);

  return {
    genre,
    distortion,
    ensembleId: preset.id,
    beatsPerBar,
    chords,
    parts,
  };
}
