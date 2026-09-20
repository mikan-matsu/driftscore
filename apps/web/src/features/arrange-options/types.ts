export type Genre = "jazz" | "rock" | "classical" | "samba";

export interface ArrangeOptions {
  genre: Genre;
  /** 0 = 忠実なアレンジ, 100 = 大胆に崩す */
  distortion: number;
}

export const GENRES: { id: Genre; label: string }[] = [
  { id: "jazz", label: "ジャズ" },
  { id: "rock", label: "ロック" },
  { id: "classical", label: "クラシック" },
  { id: "samba", label: "サンバ" },
];
