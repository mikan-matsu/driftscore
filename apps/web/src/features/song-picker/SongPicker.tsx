"use client";

import { PRESET_SONGS } from "./presetSongs";
import type { PresetSong } from "./types";

export function SongPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (song: PresetSong) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
      {PRESET_SONGS.map((song) => {
        const isSelected = song.id === selectedId;
        return (
          <button
            key={song.id}
            type="button"
            onClick={() => onSelect(song)}
            className={`flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors ${
              isSelected
                ? "border-[#0a422f] bg-[#0a422f]/10 dark:bg-[#0a422f]/20"
                : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900"
            }`}
          >
            <span className="font-medium text-black dark:text-zinc-50">{song.title}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{song.attribution}</span>
          </button>
        );
      })}
    </div>
  );
}
