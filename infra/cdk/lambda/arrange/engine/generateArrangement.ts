import { estimateKey } from "./keyEstimation";
import { estimateChordProgression } from "./chordProgression";
import { renderBassPart, renderChordsPart } from "./genreStyles";
import { embellishMelody } from "./embellishMelody";
import type { Arrangement, Genre, Melody } from "./types";

export function generateArrangement(melody: Melody, genre: Genre, distortion: number): Arrangement {
  const key = estimateKey(melody);
  const chords = estimateChordProgression(melody, key);
  const beatsPerBar = melody.beatsPerBar;

  const melodyPart: Melody = embellishMelody(melody, distortion);
  const chordsPart: Melody = { beatsPerBar, notes: renderChordsPart(chords, genre, beatsPerBar) };
  const bassPart: Melody = { beatsPerBar, notes: renderBassPart(chords, genre, beatsPerBar) };

  return {
    genre,
    distortion,
    beatsPerBar,
    chords,
    parts: [
      { id: "melody", name: "Melody", clef: "treble", melody: melodyPart },
      { id: "chords", name: "Piano (Chords)", clef: "treble", melody: chordsPart },
      { id: "bass", name: "Bass", clef: "bass", melody: bassPart },
    ],
  };
}
