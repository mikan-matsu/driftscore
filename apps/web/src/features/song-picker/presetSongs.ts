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
// Natural minor (Aeolian) — e.g. 荒城の月, whose melody is fundamentally in a
// minor key. Using MAJOR_SCALE for a minor-key song isn't just "some wrong
// notes," it's structurally incapable of representing the melody at all
// (the 3rd/6th/7th degrees are a semitone off from every real note).
const NATURAL_MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
// Ryukyu scale (琉球音階) — do-mi-fa-so-ti, i.e. the major scale with the 2nd
// and 6th degrees dropped (semitones from root: 0, 4, 5, 7, 11). The
// characteristic scale of Okinawan/Amami folk melody; using MAJOR_SCALE's
// 7-note diatonic set for an Okinawan tune would be the same category of
// error as using it for 荒城の月's minor key above — the 2nd and 6th degrees
// just don't belong in this idiom regardless of which specific notes a given
// melody uses.
const RYUKYU_SCALE = [0, 4, 5, 7, 11];

/**
 * Simplified placeholder melody from scale-degree steps (0=root, scale.length=root+octave, ...).
 * Not a verified transcription of the original tune — real arrangement engine
 * will need accurate MusicXML/MIDI source data later. `scale` can be any length
 * (e.g. the 5-note RYUKYU_SCALE, not just a 7-note diatonic scale) — degree
 * wrapping/octave placement is derived from the scale's own length, not hardcoded to 7.
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
    // FIXME: this is genuinely in a minor key (confirmed via Wikipedia and a
    // real published transcription, 2026-09-28 — see feedback memory on
    // melody verification) — fixed the SCALE (was wrongly major), but the
    // specific degree sequence below is still the old unverified placeholder,
    // not a real transcription. Don't trust the individual notes yet.
    melody: repeatMelody(melodyFromDegrees(57, 4, [
      [0, 2], [3, 1], [5, 1], [7, 2], [5, 1], [3, 1],
      [1, 2], [0, 1], [2, 1], [0, 4],
    ], NATURAL_MINOR_SCALE), 2),
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
    // Re-scaled (2026-09-28) from the default 7-note MAJOR_SCALE to the
    // 5-note RYUKYU_SCALE — see that constant's comment. The degree sequence
    // itself is still an unverified placeholder, not a real transcription.
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [0, 1], [1, 1], [2, 1], [1, 1], [0, 1], [1, 1], [2, 2],
      [3, 1], [2, 1], [1, 1], [0, 1], [1, 4],
    ], RYUKYU_SCALE), 2),
  },
  {
    id: "asadoya-yunta",
    title: "安里屋ユンタ(沖縄)",
    attribution: "伝承曲(沖縄・八重山民謡)",
    // Placeholder only, like the other minyo entries above (not a verified
    // transcription) — but correctly in the Ryukyu scale this time from the
    // start, rather than needing a later re-scale fix.
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [0, 1], [1, 1], [2, 2], [1, 1], [0, 1], [1, 2],
      [2, 1], [3, 1], [2, 1], [1, 1], [0, 4],
    ], RYUKYU_SCALE), 2),
  },
  {
    id: "tinsagu-nu-hana",
    title: "てぃんさぐぬ花(沖縄)",
    attribution: "伝承曲(沖縄わらべうた)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [0, 2], [1, 1], [2, 1], [3, 2], [2, 1], [1, 1],
      [0, 1], [1, 1], [0, 4],
    ], RYUKYU_SCALE), 2),
  },
  {
    id: "toshin-doi",
    title: "唐船ドーイ(沖縄)",
    attribution: "伝承曲(沖縄民謡・カチャーシー)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [2, 1], [2, 1], [3, 1], [2, 1], [1, 1], [0, 1], [1, 2],
      [2, 1], [1, 1], [0, 1], [1, 1], [0, 4],
    ], RYUKYU_SCALE), 2),
  },
  {
    id: "jin-jin",
    title: "じんじん(沖縄わらべうた)",
    attribution: "伝承曲(沖縄わらべうた・蛍呼び歌)",
    melody: repeatMelody(melodyFromDegrees(60, 4, [
      [0, 1], [1, 1], [0, 1], [1, 1], [2, 2], [1, 1], [0, 1],
      [1, 1], [0, 4],
    ], RYUKYU_SCALE), 2),
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
