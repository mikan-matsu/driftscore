import type { Note } from "@/features/piano-roll";
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

export const PRESET_SONGS: PresetSong[] = [
  {
    id: "twinkle-twinkle",
    title: "きらきら星",
    attribution: "伝承曲(フランス民謡)・パブリックドメイン",
    melody: {
      beatsPerBar: 4,
      notes: notes([
        [60, 0, 1],
        [60, 1, 1],
        [67, 2, 1],
        [67, 3, 1],
        [69, 4, 1],
        [69, 5, 1],
        [67, 6, 2],
        [65, 8, 1],
        [65, 9, 1],
        [64, 10, 1],
        [64, 11, 1],
        [62, 12, 1],
        [62, 13, 1],
        [60, 14, 2],
      ]),
    },
  },
  {
    id: "frere-jacques",
    title: "かえるのうた",
    attribution: "伝承曲(フランス民謡)・パブリックドメイン",
    melody: {
      beatsPerBar: 4,
      notes: notes([
        [60, 0, 1],
        [62, 1, 1],
        [64, 2, 1],
        [60, 3, 1],
        [60, 4, 1],
        [62, 5, 1],
        [64, 6, 1],
        [60, 7, 1],
        [64, 8, 1],
        [65, 9, 1],
        [67, 10, 2],
        [64, 12, 1],
        [65, 13, 1],
        [67, 14, 2],
      ]),
    },
  },
  {
    id: "chocho",
    title: "ちょうちょ",
    attribution: "伝承曲(ヨーロッパ民謡)・パブリックドメイン",
    melody: {
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
  },
  {
    id: "london-bridge",
    title: "ロンドン橋",
    attribution: "伝承曲(イギリス民謡)・パブリックドメイン",
    melody: {
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
  },
];
