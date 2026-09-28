"use client";

import { useState } from "react";
import { PRESET_SONGS } from "./presetSongs";
import type { PresetSong } from "./types";

/** Matches against both the displayed (kanji/kana) title and the romanized
 * id (e.g. "furusato" finds 「故郷」) — song ids are already romanized for
 * routing/keying, so this comes for free and lets a user search without
 * needing IME input. */
function matches(song: PresetSong, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return song.title.toLowerCase().includes(q) || song.id.toLowerCase().includes(q);
}

export function SongPicker({
  selectedId,
  onSelect,
  /** Constrains the result list to a small scrollable area instead of
   * growing to fit every match — for embedding inline on a page that isn't
   * dedicated to song browsing (the main page's quick-pick widget), as
   * opposed to the full /songs page where the list can grow freely. */
  compact = false,
}: {
  selectedId: string | null;
  onSelect: (song: PresetSong) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = PRESET_SONGS.filter((song) => matches(song, query));

  return (
    <div className="flex w-full flex-col gap-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="曲名で検索(例: 故郷、furusato)"
        className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
      <div
        className={`w-full rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 ${
          compact ? "max-h-64 overflow-y-auto" : "overflow-hidden"
        }`}
      >
        {filtered.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">該当する曲が見つかりませんでした。</p>
        ) : (
          filtered.map((song) => {
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
          })
        )}
      </div>
    </div>
  );
}
