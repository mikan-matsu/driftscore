"use client";

import { GENRES, type ArrangeOptions } from "./types";

export function ArrangeOptionsForm({
  value,
  onChange,
}: {
  value: ArrangeOptions;
  onChange: (options: ArrangeOptions) => void;
}) {
  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col gap-2">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">ジャンル</span>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((genre) => (
            <button
              key={genre.id}
              type="button"
              onClick={() => onChange({ ...value, genre: genre.id })}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                value.genre === genre.id
                  ? "bg-[#0a422f] text-white"
                  : "border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900"
              }`}
            >
              {genre.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span>崩し度</span>
          <span>{value.distortion}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={value.distortion}
          onChange={(e) => onChange({ ...value, distortion: Number(e.target.value) })}
          className="w-full accent-[#0a422f]"
        />
        <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-500">
          <span>忠実</span>
          <span>大胆に崩す</span>
        </div>
      </div>
    </div>
  );
}
