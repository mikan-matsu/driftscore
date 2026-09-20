"use client";

import { useState } from "react";
import { SongPicker, type PresetSong } from "@/features/song-picker";
import { ArrangeOptionsForm, type ArrangeOptions } from "@/features/arrange-options";
import { ScoreViewer } from "@/features/score-viewer";
import type { Melody } from "@/features/piano-roll";

type Step = "pick" | "options" | "result";

const API_URL = process.env.NEXT_PUBLIC_ARRANGE_API_URL ?? "";

export default function Home() {
  const [step, setStep] = useState<Step>("pick");
  const [selectedSong, setSelectedSong] = useState<PresetSong | null>(null);
  const [options, setOptions] = useState<ArrangeOptions>({ genre: "jazz", distortion: 30 });
  const [resultMelody, setResultMelody] = useState<Melody | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");

  function handleSelectSong(song: PresetSong) {
    setSelectedSong(song);
    setStep("options");
  }

  async function handleGenerate() {
    if (!selectedSong) return;
    setStatus("loading");
    setStep("result");
    try {
      if (API_URL) {
        await fetch(`${API_URL}/arrange`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            melody: selectedSong.melody,
            genre: options.genre,
            distortion: options.distortion,
          }),
        });
      }
    } catch {
      // アレンジ生成APIは未実装なので、失敗してもプレビューは出す
    }
    setResultMelody(selectedSong.melody);
    setStatus("done");
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full flex-col items-center gap-8 py-12 px-4 sm:px-8">
        <div className="w-full max-w-3xl flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            DriftScore
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            知ってる曲を選んで、好きなジャンルにアレンジしてみましょう。
          </p>
        </div>

        <section className="w-full max-w-3xl flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">1. 曲を選ぶ</h2>
          <SongPicker selectedId={selectedSong?.id ?? null} onSelect={handleSelectSong} />
        </section>

        {selectedSong && (
          <section className="w-full max-w-3xl flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              2. ジャンルと崩し度を決める
            </h2>
            <ArrangeOptionsForm value={options} onChange={setOptions} />
            <button
              type="button"
              onClick={handleGenerate}
              className="self-start rounded-full bg-[#0a422f] px-6 py-2 text-sm font-medium text-white hover:bg-[#0a422f]/90"
            >
              アレンジを生成する
            </button>
          </section>
        )}

        {step === "result" && (
          <section className="w-full max-w-3xl flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">3. 結果</h2>
            {status === "loading" && (
              <p className="text-sm text-zinc-500">生成中...</p>
            )}
            {status === "done" && resultMelody && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-zinc-500 dark:text-zinc-500">
                  アレンジ生成エンジンは準備中のため、今は選んだメロディーをそのまま五線譜表示しています。
                </p>
                <ScoreViewer melody={resultMelody} title={selectedSong?.title} />
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
