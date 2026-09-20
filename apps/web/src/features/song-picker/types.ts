import type { Melody } from "@/features/piano-roll";

export interface PresetSong {
  id: string;
  title: string;
  /** Why this is safe to use publicly, e.g. "伝承曲(パブリックドメイン)" */
  attribution: string;
  melody: Melody;
}
