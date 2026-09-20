export type Genre = "jazz" | "rock" | "classical" | "samba";

export interface ArrangeOptions {
  genre: Genre;
  /** 0 = 忠実なアレンジ, 100 = 大胆に崩す */
  distortion: number;
  ensembleId: string;
}

export const GENRES: { id: Genre; label: string }[] = [
  { id: "jazz", label: "ジャズ" },
  { id: "rock", label: "ロック" },
  { id: "classical", label: "クラシック" },
  { id: "samba", label: "サンバ" },
];

export const ENSEMBLES: { id: string; label: string; description: string }[] = [
  { id: "pianoTrio", label: "ピアノトリオ", description: "リード + ピアノ + ベース" },
  { id: "woodwindQuartet", label: "木管四重奏", description: "クラリネット + トランペット + ホルン + ファゴット" },
  { id: "clarinetGuitarBass", label: "クラリネット+ギター+ベース", description: "クラリネット + ギター + エレキベース" },
  { id: "brassQuintet", label: "金管五重奏", description: "トランペット2 + ホルン + トロンボーン + チューバ" },
];
