"use client";

import { useState } from "react";
import { SongPicker, type PresetSong } from "@/features/song-picker";
import { ArrangeOptionsForm, type ArrangeOptions } from "@/features/arrange-options";
import { ScoreViewer, arrangementToMusicXml, type Arrangement } from "@/features/score-viewer";
import { playArrangement, stopPlayback } from "@/features/playback";

type Step = "pick" | "options" | "result";

const API_URL = process.env.NEXT_PUBLIC_ARRANGE_API_URL ?? "";

export default function Home() {
  const [step, setStep] = useState<Step>("pick");
  const [selectedSong, setSelectedSong] = useState<PresetSong | null>(null);
  const [options, setOptions] = useState<ArrangeOptions>({ genre: "jazz", distortion: 30 });
  const [arrangement, setArrangement] = useState<Arrangement | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [isPlaying, setIsPlaying] = useState(false);

  function handleSelectSong(song: PresetSong) {
    setSelectedSong(song);
    setStep("options");
  }

  async function handleGenerate() {
    if (!selectedSong || !API_URL) return;
    stopPlayback();
    setIsPlaying(false);
    setStatus("loading");
    setStep("result");
    try {
      const res = await fetch(`${API_URL}/arrange`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          melody: selectedSong.melody,
          genre: options.genre,
          distortion: options.distortion,
        }),
      });
      if (!res.ok) throw new Error(`arrange API returned ${res.status}`);
      const data = (await res.json()) as { arrangement: Arrangement };
      setArrangement(data.arrangement);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  const BPM = 108;

  async function handleTogglePlay() {
    if (!arrangement) return;
    if (isPlaying) {
      stopPlayback();
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    const lastEnd = Math.max(
      0,
      ...arrangement.parts.flatMap((p) => p.melody.notes.map((n) => n.start + n.duration)),
    );
    await playArrangement(arrangement, BPM);
    window.setTimeout(() => setIsPlaying(false), (lastEnd * 60 * 1000) / BPM + 600);
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
            {status === "loading" && <p className="text-sm text-zinc-500">生成中...</p>}
            {status === "error" && (
              <p className="text-sm text-red-600 dark:text-red-400">
                生成に失敗しました。もう一度お試しください。
              </p>
            )}
            {status === "done" && arrangement && (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="self-start rounded-full bg-[#0a422f] px-6 py-2 text-sm font-medium text-white hover:bg-[#0a422f]/90"
                >
                  {isPlaying ? "■ 停止" : "▶ 再生"}
                </button>
                <ScoreViewer
                  musicXml={arrangementToMusicXml(arrangement, selectedSong?.title)}
                  title={selectedSong?.title}
                />
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
