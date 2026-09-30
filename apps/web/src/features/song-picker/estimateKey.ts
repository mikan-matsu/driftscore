import type { Melody } from "@/features/piano-roll";
import { estimateKey } from "@/features/score-viewer/keySpelling";

const PITCH_CLASS_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * dur/moll label (e.g. "Cdur"/"amoll" — this project's Japanese-music-
 * education convention, not English major/minor) for a melody, using the
 * same key estimation the notation layer (score-viewer/keySpelling.ts) uses
 * to pick the actual key signature — kept as one canonical implementation
 * rather than two copies of the same histogram algorithm drifting apart.
 * Used to show the key of a melody (preset song or random theme) in the
 * picker preview BEFORE arranging — the arrangement engine's own key isn't
 * known yet at that point (it isn't computed until the user hits
 * "アレンジを生成する"), and re-estimating live also keeps the label correct
 * after the user drags a note's pitch in the preview editor.
 */
export function estimateKeyLabel(melody: Melody): string {
  const key = estimateKey(melody);
  return `${PITCH_CLASS_NAMES[key.root]}${key.isMinor ? "moll" : "dur"}`;
}
