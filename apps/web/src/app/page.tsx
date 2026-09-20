"use client";

import { useState } from "react";
import { PianoRoll } from "@/features/piano-roll";
import type { Melody } from "@/features/piano-roll";

const EMPTY_MELODY: Melody = { notes: [], beatsPerBar: 4 };

export default function Home() {
  const [melody, setMelody] = useState<Melody>(EMPTY_MELODY);

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full flex-col items-center gap-6 py-12 px-4 sm:px-8">
        <div className="w-full max-w-4xl flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            DriftScore
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            メロディーを入力してください（セルをクリックして音符を配置）。
          </p>
        </div>
        <div className="w-full max-w-4xl">
          <PianoRoll melody={melody} onChange={setMelody} />
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          {melody.notes.length} 音符
        </p>
      </main>
    </div>
  );
}
