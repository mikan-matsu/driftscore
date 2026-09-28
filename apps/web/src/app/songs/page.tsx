"use client";

import { useRouter } from "next/navigation";
import { SongPicker, type PresetSong } from "@/features/song-picker";
import { useAppStore } from "@/store/appStore";

/** Dedicated song-selection page — moved off the main page since the full
 * searchable song list crowded it out (see project memory). Selecting a
 * song stores it in the shared app store and returns to "/", which reads
 * it from there instead of a local page.tsx-only state. */
export default function SongsPage() {
  const router = useRouter();
  const selectedSong = useAppStore((s) => s.selectedSong);
  const setSelectedSong = useAppStore((s) => s.setSelectedSong);

  function handleSelect(song: PresetSong) {
    setSelectedSong(song);
    router.push("/");
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-slate-50 font-sans dark:bg-slate-950">
      <main className="flex flex-1 w-full flex-col items-center gap-6 py-12 px-4 sm:px-8">
        <div className="w-full max-w-3xl flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="self-start text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            ← 戻る
          </button>
          <h1 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            曲を選ぶ
          </h1>
        </div>
        <section className="w-full max-w-3xl">
          <SongPicker selectedId={selectedSong?.id ?? null} onSelect={handleSelect} />
        </section>
      </main>
    </div>
  );
}
