import type { Note, Melody } from "@/features/piano-roll";
import type { PresetSong } from "./types";

function notes(spec: [pitch: number, start: number, duration: number][]): Note[] {
  return spec.map(([pitch, start, duration], i) => ({
    id: `n${i}`,
    pitch,
    start,
    duration,
    velocity: 100,
  }));
}

/** Repeats a melody `times` times back-to-back, so short placeholder tunes play longer. */
function repeatMelody(melody: Melody, times: number): Melody {
  const lastEnd = melody.notes.reduce((max, n) => Math.max(max, n.start + n.duration), 0);
  const loopLength = Math.ceil(lastEnd / melody.beatsPerBar) * melody.beatsPerBar;
  const repeated: Note[] = [];
  let id = 0;
  for (let r = 0; r < times; r++) {
    for (const note of melody.notes) {
      repeated.push({ ...note, id: `n${id++}`, start: note.start + r * loopLength });
    }
  }
  return { beatsPerBar: melody.beatsPerBar, notes: repeated };
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

/**
 * Simplified placeholder melody from scale-degree steps (0=root, scale.length=root+octave, ...).
 * Not a verified transcription of the original tune — real arrangement engine
 * will need accurate MusicXML/MIDI source data later.
 */
function melodyFromDegrees(
  root: number,
  beatsPerBar: number,
  steps: [degree: number, duration: number][],
  scale: number[] = MAJOR_SCALE,
): Melody {
  let t = 0;
  const ns: Note[] = steps.map(([degree, duration], i) => {
    const octave = Math.floor(degree / scale.length);
    const idx = ((degree % scale.length) + scale.length) % scale.length;
    const pitch = root + octave * 12 + scale[idx];
    const note: Note = { id: `n${i}`, pitch, start: t, duration, velocity: 100 };
    t += duration;
    return note;
  });
  return { beatsPerBar, notes: ns };
}

export const PRESET_SONGS: PresetSong[] = [
  {
    id: "twinkle-twinkle",
    title: "きらきら星",
    attribution: "伝承曲(フランス民謡)",
    // Real structure is 6 lines, A-B-C-C-A-B (the previous version only had
    // A-B, repeated as A-B-A-B — missing the "up above the world so high /
    // like a diamond in the sky" (C) section entirely).
    melody: {
      beatsPerBar: 4,
      notes: notes([
        // A: Twinkle twinkle little star
        [60, 0, 1], [60, 1, 1], [67, 2, 1], [67, 3, 1], [69, 4, 1], [69, 5, 1], [67, 6, 2],
        // B: How I wonder what you are
        [65, 8, 1], [65, 9, 1], [64, 10, 1], [64, 11, 1], [62, 12, 1], [62, 13, 1], [60, 14, 2],
        // C: Up above the world so high
        [67, 16, 1], [67, 17, 1], [65, 18, 1], [65, 19, 1], [64, 20, 1], [64, 21, 1], [62, 22, 2],
        // C: Like a diamond in the sky
        [67, 24, 1], [67, 25, 1], [65, 26, 1], [65, 27, 1], [64, 28, 1], [64, 29, 1], [62, 30, 2],
        // A: Twinkle twinkle little star
        [60, 32, 1], [60, 33, 1], [67, 34, 1], [67, 35, 1], [69, 36, 1], [69, 37, 1], [67, 38, 2],
        // B: How I wonder what you are
        [65, 40, 1], [65, 41, 1], [64, 42, 1], [64, 43, 1], [62, 44, 1], [62, 45, 1], [60, 46, 2],
      ]),
    },
  },
  {
    id: "frere-jacques",
    title: "かえるのうた",
    attribution: "伝承曲(ドイツ民謡)",
    // NOTE (2026-09-28): a previous pass in this session wrongly "corrected"
    // this to the Frère Jacques round's melody, based on an unverified
    // assumption that かえるのうた is a Japanese lyric set to that same tune.
    // The user confirmed the real melody opens Do-Re-Mi-Fa-Mi-Re-Do (matching
    // this original version), not Frère Jacques' Do-Re-Mi-Do — reverted.
    // The rest of this melody (past the opening phrase) is still unverified.
    melody: {
      beatsPerBar: 4,
      notes: notes([
        [60, 0, 1],
        [62, 1, 1],
        [64, 2, 1],
        [65, 3, 1],
        [64, 4, 1],
        [62, 5, 1],
        [60, 6, 2],
        [64, 8, 1],
        [65, 9, 1],
        [67, 10, 1],
        [69, 11, 1],
        [67, 12, 1],
        [65, 13, 1],
        [64, 14, 2],
        [60, 16, 1],
        [60, 17, 1],
        [60, 18, 1],
        [60, 19, 1],
        [60, 20, 0.5],
        [60, 20.5, 0.5],
        [62, 21, 0.5],
        [62, 21.5, 0.5],
        [64, 22, 0.5],
        [64, 22.5, 0.5],
        [65, 23, 0.5],
        [65, 23.5, 0.5],
        [64, 24, 1],
        [62, 25, 1],
        [60, 26, 6],
      ]),
    },
  },
  {
    id: "chocho",
    title: "ちょうちょ",
    attribution: "伝承曲(ヨーロッパ民謡)",
    melody: repeatMelody(
      {
        beatsPerBar: 4,
        notes: notes([
          [67, 0, 1],
          [67, 1, 1],
          [69, 2, 1],
          [67, 3, 1],
          [72, 4, 1],
          [72, 5, 1],
          [71, 6, 1],
          [69, 7, 1],
          [67, 8, 1],
          [69, 9, 1],
          [71, 10, 1],
          [72, 11, 1],
          [67, 12, 4],
        ]),
      },
      2,
    ),
  },
  {
    id: "london-bridge",
    title: "ロンドン橋",
    attribution: "伝承曲(イギリス民謡)",
    melody: repeatMelody(
      {
        beatsPerBar: 4,
        notes: notes([
          [67, 0, 1],
          [69, 1, 1],
          [67, 2, 1],
          [65, 3, 1],
          [64, 4, 1],
          [65, 5, 1],
          [67, 6, 2],
          [62, 8, 1],
          [64, 9, 1],
          [65, 10, 1],
          [64, 11, 1],
          [65, 12, 1],
          [67, 13, 2],
          [60, 15, 1],
        ]),
      },
      2,
    ),
  },
  {
    id: "mary-had-a-little-lamb",
    title: "メリーさんのひつじ",
    attribution: "伝承曲(アメリカ民謡)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [2, 1], [1, 1], [0, 1], [1, 1], [2, 1], [2, 1], [2, 2],
      [1, 1], [1, 1], [1, 2], [2, 1], [4, 1], [4, 2],
    ]), 2),
  },
];
