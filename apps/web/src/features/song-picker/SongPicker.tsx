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
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {PRESET_SONGS.map((song) => {
        const isSelected = song.id === selectedId;
        return (
          <button
            key={song.id}
            type="button"
            onClick={() => onSelect(song)}
            className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 dark:border-slate-800 ${
              isSelected
                ? "bg-blue-100 dark:bg-blue-950"
                : "hover:bg-blue-50 dark:hover:bg-slate-800"
            }`}
          >
            <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
              {song.title}
            </span>
            <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
              {song.attribution}
            </span>
          </button>
        );
      })}
    </div>
  );
}
