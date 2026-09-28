import { create } from "zustand";
import type { PresetSong } from "@/features/song-picker";

/**
 * Cross-page app state — starts with just the selected song, since that's
 * the first piece of state that needs to survive a route change (song
 * selection moved to its own /songs page rather than living inline on the
 * main page). Grows here as more of page.tsx's state needs to cross a page
 * boundary, rather than each page re-inventing its own passing mechanism.
 */
interface AppState {
  selectedSong: PresetSong | null;
  setSelectedSong: (song: PresetSong | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedSong: null,
  setSelectedSong: (song) => set({ selectedSong: song }),
}));
