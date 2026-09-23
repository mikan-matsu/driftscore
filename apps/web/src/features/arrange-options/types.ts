export type Genre = "jazz" | "rock" | "classical" | "samba";

export type SongForm = "theme" | "full";

/** Sentinel ensembleId meaning "use customInstrumentIds instead of a preset". */
export const CUSTOM_ENSEMBLE_ID = "custom";

export interface ArrangeOptions {
  genre: Genre;
  /** 0 = 忠実なアレンジ, 100 = 大胆に崩す */
  distortion: number;
  ensembleId: string;
  /** Instrument catalog ids (see INSTRUMENT_CATALOG) for a freeform custom ensemble — only used when ensembleId === CUSTOM_ENSEMBLE_ID. */
  customInstrumentIds: string[];
  /** Pitch class 0-11 to transpose the melody's tonic to, or null to keep the melody's own key (auto-detected). */
  keyRoot: number | null;
  /** "theme" = テーマ1回のみ(従来通り), "full" = イントロ〜エンディングのフル曲構成 */
  songForm: SongForm;
}

/** Pitch-class labels for the key picker — major/minor isn't chosen here, it's
 * auto-detected from the melody; this only picks which note the tonic moves to. */
export const KEY_ROOTS: { id: number; label: string }[] = [
  { id: 0, label: "C" },
  { id: 1, label: "C#" },
  { id: 2, label: "D" },
  { id: 3, label: "D#" },
  { id: 4, label: "E" },
  { id: 5, label: "F" },
  { id: 6, label: "F#" },
  { id: 7, label: "G" },
  { id: 8, label: "G#" },
  { id: 9, label: "A" },
  { id: 10, label: "A#" },
  { id: 11, label: "B" },
];

export const SONG_FORMS: { id: SongForm; label: string }[] = [
  { id: "theme", label: "テーマのみ" },
  { id: "full", label: "フル構成" },
];

export const GENRES: { id: Genre; label: string }[] = [
  { id: "jazz", label: "ジャズ" },
  { id: "rock", label: "ロック" },
  { id: "classical", label: "クラシック" },
  { id: "samba", label: "サンバ" },
];

export const ENSEMBLES: { id: string; label: string; description: string }[] = [
  { id: "pianoTrio", label: "ピアノトリオ", description: "リード + ピアノ + ベース" },
  { id: "woodwindQuartet", label: "木管四重奏", description: "フルート + オーボエ + クラリネット + ファゴット" },
  { id: "clarinetGuitarBass", label: "クラリネット+ギター+ベース", description: "クラリネット + ギター + エレキベース" },
  { id: "brassQuintet", label: "金管五重奏", description: "トランペット2 + ホルン + トロンボーン + チューバ" },
  { id: CUSTOM_ENSEMBLE_ID, label: "カスタム編成", description: "好きな楽器を自由に組み合わせる" },
];

/**
 * Instrument catalog for the custom-ensemble picker — ids must match keys in
 * infra/cdk/lambda/arrange/engine/instruments.ts's INSTRUMENTS registry
 * (duplicated here since apps/web and the lambda are separate build targets
 * with no shared package; "lead" is intentionally excluded — it's the
 * engine's internal generic-melody-instrument fallback, not something a user
 * should pick directly).
 */
export const INSTRUMENT_CATALOG: { id: string; label: string; group: "woodwind" | "brass" | "rhythm" }[] = [
  { id: "flute", label: "フルート", group: "woodwind" },
  { id: "oboe", label: "オーボエ", group: "woodwind" },
  { id: "clarinetBb", label: "クラリネット(B♭)", group: "woodwind" },
  { id: "bassoon", label: "ファゴット", group: "woodwind" },
  { id: "trumpetBb", label: "トランペット(B♭)", group: "brass" },
  { id: "trumpetBb2", label: "トランペット2(B♭)", group: "brass" },
  { id: "hornF", label: "ホルン(F)", group: "brass" },
  { id: "trombone", label: "トロンボーン", group: "brass" },
  { id: "tuba", label: "チューバ", group: "brass" },
  { id: "piano", label: "ピアノ", group: "rhythm" },
  { id: "guitar", label: "ギター", group: "rhythm" },
  { id: "electricBass", label: "エレキベース", group: "rhythm" },
];

export const MAX_CUSTOM_INSTRUMENTS = 10;
