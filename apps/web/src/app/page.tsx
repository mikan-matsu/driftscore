"use client";

import { useRef, useState } from "react";
import { SongPicker, type PresetSong } from "@/features/song-picker";
import { ArrangeOptionsForm, CUSTOM_ENSEMBLE_ID, type ArrangeOptions } from "@/features/arrange-options";
import { ScoreViewer, arrangementToMusicXml, type Arrangement, type ScoreCursor } from "@/features/score-viewer";
import { playArrangement, stopPlayback, useCursorSync } from "@/features/playback";
import type { Note } from "@/features/piano-roll";

type Step = "pick" | "options" | "result";

const API_URL = process.env.NEXT_PUBLIC_ARRANGE_API_URL ?? "";

/** Applies a single-note edit (pitch drag or duration double-click, from ScoreViewer's onNoteEdit /
 * onNoteDurationEdit) to one note within one part's melody, without touching anything else — the
 * arrangement's other parts/notes, chord symbols, and sections are untouched, so no fresh /arrange
 * API round-trip is needed. Matches the note by id (unique within one part's own melody). */
function updateNote(arrangement: Arrangement, partId: string, noteId: string, changes: Partial<Note>): Arrangement {
  return {
    ...arrangement,
    parts: arrangement.parts.map((part) =>
      part.id === partId
        ? {
            ...part,
            melody: {
              ...part.melody,
              notes: part.melody.notes.map((n) => (n.id === noteId ? { ...n, ...changes } : n)),
            },
          }
        : part,
    ),
  };
}

export default function Home() {
  const [step, setStep] = useState<Step>("pick");
  const [selectedSong, setSelectedSong] = useState<PresetSong | null>(null);
  const [options, setOptions] = useState<ArrangeOptions>({
    genre: "jazz",
    distortion: 30,
    ensembleId: "pianoTrio",
    customInstrumentIds: [],
    keyRoot: null,
    songForm: "theme",
  });
  const [arrangement, setArrangement] = useState<Arrangement | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [isPlaying, setIsPlaying] = useState(false);
  const [cursor, setCursor] = useState<ScoreCursor | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  // Click-to-select on the rendered score (see project memory
  // `project_osmd_note_id_finding`) — first slice of the planned drag-edit
  // notation UI; editing itself isn't wired up yet, this just surfaces what
  // got resolved so the click-to-note path is visibly working end to end.
  const [selectedNote, setSelectedNote] = useState<{ partId: string; note: Note } | null>(null);
  // Undo for hand-edits (drag-pitch / double-click-duration) made on the
  // score after generation. A plain ref stack of prior full Arrangement
  // snapshots — cheap since edits are infrequent and each Arrangement is
  // small — pushed just before each edit is applied. Not a React state
  // value itself (nothing needs to re-render off its contents), so
  // `canUndo` is the only piece of it surfaced to the UI. Cleared on every
  // fresh /arrange generation, since undoing "past" a full regeneration
  // back into a previous song/genre's notes wouldn't make sense.
  const editHistoryRef = useRef<Arrangement[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  // Guards against a slower, older /arrange request resolving after a newer
  // one (e.g. the user reselects a song and regenerates before the first
  // response lands) and overwriting the newer arrangement with stale data —
  // selectedSong's title would already show the new song while the score
  // underneath silently stayed on the old one.
  const generationIdRef = useRef(0);

  function handleSelectSong(song: PresetSong) {
    setSelectedSong(song);
    setStep("options");
  }

  async function handleGenerate() {
    if (!selectedSong || !API_URL) return;
    const requestId = ++generationIdRef.current;
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
          ...(options.ensembleId === CUSTOM_ENSEMBLE_ID
            ? { instrumentIds: options.customInstrumentIds }
            : { ensembleId: options.ensembleId }),
          keyRoot: options.keyRoot,
          songForm: options.songForm,
        }),
      });
      if (!res.ok) throw new Error(`arrange API returned ${res.status}`);
      const data = (await res.json()) as { arrangement: Arrangement };
      if (requestId !== generationIdRef.current) return;
      setArrangement(data.arrangement);
      setSelectedPartId(null);
      setSelectedNote(null);
      editHistoryRef.current = [];
      setCanUndo(false);
      setStatus("done");
    } catch {
      if (requestId !== generationIdRef.current) return;
      setStatus("error");
    }
  }

  function applyNoteEdit(next: Arrangement) {
    if (!arrangement) return;
    editHistoryRef.current.push(arrangement);
    setCanUndo(true);
    setArrangement(next);
  }

  function handleUndo() {
    const previous = editHistoryRef.current.pop();
    if (!previous) return;
    setArrangement(previous);
    setSelectedNote(null);
    setCanUndo(editHistoryRef.current.length > 0);
  }

  const BPM = 108;
  useCursorSync(cursor, isPlaying, BPM);

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
    <div className="flex flex-col flex-1 min-h-screen bg-slate-50 font-sans dark:bg-slate-950">
      <main className="flex flex-1 w-full flex-col items-center gap-8 py-12 px-4 sm:px-8">
        <div className="w-full max-w-3xl flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            DriftScore
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            知ってる曲を選んで、好きなジャンルにアレンジしてみましょう。
          </p>
        </div>

        <section className="w-full max-w-3xl flex flex-col gap-3">
          <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">1. 曲を選ぶ</h2>
          <SongPicker selectedId={selectedSong?.id ?? null} onSelect={handleSelectSong} />
        </section>

        {selectedSong && (
          <section className="w-full max-w-3xl flex flex-col gap-3">
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">
              2. ジャンルと崩し度を決める
            </h2>
            <ArrangeOptionsForm value={options} onChange={setOptions} />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={options.ensembleId === CUSTOM_ENSEMBLE_ID && options.customInstrumentIds.length === 0}
              className="self-start rounded-full bg-blue-400 px-6 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              アレンジを生成する
            </button>
          </section>
        )}

        {step === "result" && (
          // Wider than the other sections' max-w-3xl (768px) — a single A4
          // portrait page renders at ~734px, so 3xl can't fit even one page
          // without clipping. Two pages side by side (spread view) need
          // ~1484px (734px x2 + gap), past even max-w-7xl (1280px), so this
          // section gets its own wider cap instead of a stock Tailwind size.
          <section className="w-full max-w-[1600px] flex flex-col gap-3">
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-300">3. 結果</h2>
            {status === "loading" && <p className="text-sm text-slate-500">生成中...</p>}
            {status === "error" && (
              <p className="text-sm text-red-600 dark:text-red-400">
                生成に失敗しました。もう一度お試しください。
              </p>
            )}
            {status === "done" && arrangement && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="self-start rounded-full bg-blue-400 px-6 py-2 text-sm font-medium text-white hover:bg-blue-500"
                  >
                    {isPlaying ? "■ 停止" : "▶ 再生"}
                  </button>
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={!canUndo}
                    className="self-start rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    ↶ 元に戻す
                  </button>
                  {arrangement.parts.length > 1 && (
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedPartId(null)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          selectedPartId === null
                            ? "bg-green-500 text-white"
                            : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        }`}
                      >
                        スコア全体
                      </button>
                      {arrangement.parts.map((part) => (
                        <button
                          key={part.id}
                          type="button"
                          onClick={() => setSelectedPartId(part.id)}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                            selectedPartId === part.id
                              ? "bg-green-500 text-white"
                              : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                          }`}
                        >
                          {part.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <ScoreViewer
                  musicXml={arrangementToMusicXml(arrangement, selectedSong?.title, selectedPartId ?? undefined)}
                  title={selectedSong?.title}
                  arrangement={arrangement}
                  onCursorReady={setCursor}
                  onNoteClick={(partId, note) => setSelectedNote({ partId, note })}
                  onNoteEdit={(partId, note, newPitch) => {
                    if (!arrangement) return;
                    applyNoteEdit(updateNote(arrangement, partId, note.id, { pitch: newPitch }));
                    setSelectedNote({ partId, note: { ...note, pitch: newPitch } });
                  }}
                  onNoteDurationEdit={(partId, note, newDuration) => {
                    if (!arrangement) return;
                    applyNoteEdit(updateNote(arrangement, partId, note.id, { duration: newDuration }));
                    setSelectedNote({ partId, note: { ...note, duration: newDuration } });
                  }}
                />
                {selectedNote && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    選択中の音符: {arrangement.parts.find((p) => p.id === selectedNote.partId)?.name ?? selectedNote.partId} / pitch{" "}
                    {selectedNote.note.pitch} / beat {selectedNote.note.start} / 長さ {selectedNote.note.duration}拍(ダブルクリックで変更)
                  </p>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
