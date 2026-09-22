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
 * Simplified placeholder melody from scale-degree steps (0=root, 7=root+octave, ...).
 * Not a verified transcription of the original tune — real arrangement engine
 * will need accurate MusicXML/MIDI source data later.
 */
function melodyFromDegrees(
  root: number,
  beatsPerBar: number,
  steps: [degree: number, duration: number][],
): Melody {
  let t = 0;
  const ns: Note[] = steps.map(([degree, duration], i) => {
    const octave = Math.floor(degree / 7);
    const idx = ((degree % 7) + 7) % 7;
    const pitch = root + octave * 12 + MAJOR_SCALE[idx];
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
    melody: repeatMelody(
      {
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
      2,
    ),
  },
  {
    id: "frere-jacques",
    title: "かえるのうた",
    attribution: "伝承曲(ドイツ民謡)",
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
  {
    id: "musunde-hiraite",
    title: "むすんでひらいて",
    attribution: "作曲:J.J.ルソー(1712-1778)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [0, 1], [2, 1], [4, 2], [0, 1], [2, 1], [4, 2],
      [7, 1], [7, 1], [6, 1], [4, 1], [2, 1], [0, 2],
    ]), 2),
  },
  {
    id: "auld-lang-syne",
    title: "蛍の光",
    attribution: "伝承曲(スコットランド民謡)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [0, 1], [0, 1], [2, 1], [0, 1], [4, 1], [5, 2],
      [4, 1], [4, 1], [2, 1], [0, 1], [2, 1], [0, 2],
    ]), 2),
  },
  {
    id: "greensleeves",
    title: "グリーンスリーブス",
    attribution: "伝承曲(イギリス民謡・16世紀)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [0, 1], [2, 1], [3, 1], [5, 2], [4, 1], [3, 1],
      [1, 2], [0, 1], [1, 1], [2, 1], [0, 2],
    ]), 2),
  },
  {
    id: "scarborough-fair",
    title: "スカボローフェア",
    attribution: "伝承曲(イギリス民謡)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [4, 2], [3, 1], [2, 1], [0, 2], [2, 1], [4, 1],
      [3, 2], [1, 1], [2, 1], [0, 4],
    ]), 2),
  },
  {
    id: "michael-row-the-boat-ashore",
    title: "こげよマイケル",
    attribution: "伝承曲(アメリカ伝承霊歌)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [0, 1], [2, 1], [4, 1], [4, 1], [5, 2], [4, 2],
      [2, 1], [0, 1], [2, 1], [0, 4],
    ]), 2),
  },
  {
    id: "kojo-no-tsuki",
    title: "荒城の月",
    attribution: "作曲:滝廉太郎(1879-1903)",
    melody: repeatMelody(melodyFromDegrees(57, 4, [
      [0, 2], [3, 1], [5, 1], [7, 2], [5, 1], [3, 1],
      [1, 2], [0, 1], [2, 1], [0, 4],
    ]), 2),
  },
  {
    id: "hana",
    title: "花(春のうららの)",
    attribution: "作曲:滝廉太郎(1879-1903)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [2, 1], [4, 1], [5, 1], [7, 1], [7, 1], [5, 1], [4, 2],
      [2, 1], [4, 1], [2, 1], [0, 2], [0, 2],
    ]), 2),
  },
  {
    id: "furusato",
    title: "故郷(ふるさと)",
    attribution: "作曲:岡野貞一(1878-1941)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [4, 1], [4, 1], [5, 1], [4, 1], [2, 1], [0, 2],
      [4, 1], [4, 1], [5, 1], [4, 1], [2, 1], [0, 2],
    ]), 2),
  },
  {
    id: "haru-ga-kita",
    title: "春が来た",
    attribution: "作曲:岡野貞一(1878-1941)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [4, 1], [5, 1], [7, 2], [4, 1], [5, 1], [7, 2],
      [7, 1], [9, 1], [7, 1], [5, 1], [4, 4],
    ]), 2),
  },
  {
    id: "oborozukiyo",
    title: "朧月夜",
    attribution: "作曲:岡野貞一(1878-1941)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [2, 1], [4, 1], [5, 2], [4, 1], [2, 1], [0, 2],
      [2, 1], [4, 1], [5, 1], [4, 1], [2, 1], [0, 2],
    ]), 2),
  },
  {
    id: "haru-no-ogawa",
    title: "春の小川",
    attribution: "作曲:岡野貞一(1878-1941)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [0, 1], [2, 1], [4, 1], [5, 1], [4, 1], [2, 2],
      [4, 1], [5, 1], [7, 1], [5, 1], [4, 1], [2, 2],
    ]), 2),
  },
  {
    id: "hamabe-no-uta",
    title: "浜辺の歌",
    attribution: "作曲:成田為三(1893-1945)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [4, 2], [5, 1], [4, 1], [2, 2], [0, 1], [2, 1],
      [4, 2], [2, 1], [0, 1], [0, 4],
    ]), 2),
  },
  {
    id: "soshunfu",
    title: "早春賦",
    attribution: "作曲:中田章(1886-1931)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [4, 1], [4, 1], [5, 1], [4, 1], [2, 1], [0, 1], [2, 2],
      [4, 1], [5, 1], [7, 1], [5, 1], [4, 4],
    ]), 2),
  },
  {
    id: "hanyu-no-yado",
    title: "埴生の宿",
    attribution: "作曲:ヘンリー・ビショップ(英, 1786-1855)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [0, 2], [2, 1], [4, 1], [5, 2], [4, 2],
      [2, 1], [0, 1], [0, 4],
    ]), 2),
  },
  {
    id: "ryoshu",
    title: "旅愁",
    attribution: "作曲:J.P.オードウェイ(米, 1824-1880)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [4, 1], [2, 1], [0, 2], [2, 1], [4, 1], [5, 2],
      [4, 1], [2, 1], [0, 4],
    ]), 2),
  },
  {
    id: "sakura-sakura",
    title: "さくらさくら",
    attribution: "伝承曲(江戸期・作者不詳)",
    melody: repeatMelody(melodyFromDegrees(62, 4, [
      [0, 1], [0, 1], [2, 2], [0, 1], [0, 1], [2, 2],
      [0, 1], [2, 1], [4, 1], [2, 1], [0, 1], [0, 3],
    ]), 2),
  },
  {
    id: "kagome-kagome",
    title: "かごめかごめ",
    attribution: "伝承わらべうた",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [2, 1], [2, 1], [0, 1], [2, 1], [4, 1], [2, 2],
      [0, 1], [2, 1], [0, 4],
    ]), 2),
  },
  {
    id: "toryanse",
    title: "通りゃんせ",
    attribution: "伝承わらべうた",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [0, 1], [2, 1], [0, 1], [2, 1], [4, 2], [2, 1], [0, 1],
      [2, 1], [0, 4],
    ]), 2),
  },
  {
    id: "antagata-dokosa",
    title: "あんたがたどこさ",
    attribution: "伝承わらべうた(熊本)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [4, 1], [4, 1], [2, 1], [4, 1], [5, 1], [4, 1], [2, 2],
      [0, 1], [2, 1], [4, 1], [2, 4],
    ]), 2),
  },
  {
    id: "zui-zui-zukkorobashi",
    title: "ずいずいずっころばし",
    attribution: "伝承わらべうた",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [0, 1], [0, 1], [2, 1], [0, 1], [0, 1], [2, 1], [4, 2],
      [2, 1], [0, 1], [2, 1], [0, 4],
    ]), 2),
  },
  {
    id: "soran-bushi",
    title: "ソーラン節",
    attribution: "伝承曲(北海道民謡)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [0, 1], [2, 1], [4, 2], [5, 1], [4, 1], [2, 2],
      [4, 1], [5, 1], [7, 1], [5, 1], [4, 4],
    ]), 2),
  },
  {
    id: "tanchame",
    title: "谷茶前(沖縄)",
    attribution: "伝承曲(沖縄民謡・1726年記録あり)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [0, 1], [2, 1], [4, 1], [2, 1], [0, 1], [2, 1], [4, 2],
      [5, 1], [4, 1], [2, 1], [0, 1], [2, 4],
    ]), 2),
  },
  {
    id: "tanko-bushi",
    title: "炭坑節",
    attribution: "伝承曲(福岡民謡)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [0, 1], [0, 1], [2, 1], [4, 1], [2, 1], [0, 2],
      [4, 1], [4, 1], [2, 1], [0, 1], [2, 4],
    ]), 2),
  },
  {
    id: "sado-okesa",
    title: "佐渡おけさ",
    attribution: "伝承曲(新潟民謡)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [4, 2], [2, 1], [0, 1], [2, 2], [4, 1], [5, 1],
      [4, 2], [2, 1], [0, 4],
    ]), 2),
  },
  {
    id: "kokiriko-bushi",
    title: "こきりこ節",
    attribution: "伝承曲(富山民謡・日本最古級)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [0, 1], [2, 1], [4, 1], [5, 1], [4, 2], [2, 2],
      [0, 1], [2, 1], [0, 4],
    ]), 2),
  },
];
