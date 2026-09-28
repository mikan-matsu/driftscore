"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrangeOptionsForm, CUSTOM_ENSEMBLE_ID, type ArrangeOptions } from "@/features/arrange-options";
import { ScoreViewer, arrangementToMusicXml, type Arrangement, type ScoreCursor } from "@/features/score-viewer";
import { playArrangement, stopPlayback, useCursorSync } from "@/features/playback";
import type { Note } from "@/features/piano-roll";
import { useAppStore } from "@/store/appStore";

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
  // Song selection lives on its own page (/songs) now, not inline here —
  // the shared store is what lets that page's pick survive the navigation
  // back to "/".
  const selectedSong = useAppStore((s) => s.selectedSong);
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
  // True while this arrangement's sampled instruments (see
  // features/playback/sampledInstruments.ts) are being fetched — a
  // sample-based instrument genuinely has to download audio the first time
  // it's used in a session, unlike a synthesized oscillator, so this needs
  // its own indicator distinct from `isPlaying`.
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [cursor, setCursor] = useState<ScoreCursor | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  // Which parts are muted (greyed out in the score, silent in playback) —
  // independent of selectedPartId's solo/tab selection. A Finale-style
  // "click a part off" toggle: e.g. mute just the drums while everything
  // else still plays, vs. selectedPartId's "play ONLY this one part."
  const [mutedPartIds, setMutedPartIds] = useState<Set<string>>(new Set());

  function toggleMutedPart(partId: string) {
    setMutedPartIds((prev) => {
      const next = new Set(prev);
      if (next.has(partId)) next.delete(partId);
      else next.add(partId);
      return next;
    });
  }
  // Click-to-select on the rendered score (see project memory
  // `project_osmd_note_id_finding`) — first slice of the planned drag-edit
  // notation UI; editing itself isn't wired up yet, this just surfaces what
  // got resolved so the click-to-note path is visibly working end to end.
  const [selectedNote, setSelectedNote] = useState<{ partId: string; note: Note } | null>(null);
  // Undo/redo for hand-edits (drag-pitch / double-click-duration) made on
  // the score after generation. Two plain ref stacks of prior full
  // Arrangement snapshots — cheap since edits are infrequent and each
  // Arrangement is small — rather than React state, since nothing needs to
  // re-render off their contents directly (`canUndo`/`canRedo` are the only
  // pieces surfaced to the UI). A fresh edit clears the redo stack (the
  // conventional behavior: redoing past a new edit doesn't make sense).
  // Both are cleared on every fresh /arrange generation, since
  // undoing/redoing "past" a full regeneration back into a previous
  // song/genre's notes wouldn't make sense.
  const editHistoryRef = useRef<Arrangement[]>([]);
  const redoHistoryRef = useRef<Arrangement[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // Guards against a slower, older /arrange request resolving after a newer
  // one (e.g. the user reselects a song and regenerates before the first
  // response lands) and overwriting the newer arrangement with stale data —
  // selectedSong's title would already show the new song while the score
  // underneath silently stayed on the old one.
  const generationIdRef = useRef(0);

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
      redoHistoryRef.current = [];
      setCanUndo(false);
      setCanRedo(false);
      setStatus("done");
    } catch {
      if (requestId !== generationIdRef.current) return;
      setStatus("error");
    }
  }

  function applyNoteEdit(next: Arrangement) {
    if (!arrangement) return;
    editHistoryRef.current.push(arrangement);
    redoHistoryRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
    setArrangement(next);
  }

  function handleUndo() {
    if (!arrangement) return;
    const previous = editHistoryRef.current.pop();
    if (!previous) return;
    redoHistoryRef.current.push(arrangement);
    setArrangement(previous);
    setSelectedNote(null);
    setCanUndo(editHistoryRef.current.length > 0);
    setCanRedo(true);
  }

  function handleRedo() {
    if (!arrangement) return;
    const next = redoHistoryRef.current.pop();
    if (!next) return;
    editHistoryRef.current.push(arrangement);
    setArrangement(next);
    setSelectedNote(null);
    setCanUndo(true);
    setCanRedo(redoHistoryRef.current.length > 0);
  }

  // Cmd/Ctrl+Z to undo, Cmd/Ctrl+Shift+Z to redo — the note-editing
  // convention every desktop app follows. Bound at the window level (not on
  // a specific element) since a note edit doesn't leave focus anywhere in
  // particular after a drag or double-click. preventDefault() blocks the
  // browser's own text-field undo from also firing when the shortcut is
  // pressed while some unrelated input has focus.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

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
    // Solos the currently selected part tab (see ScoreViewer's part buttons)
    // — matches what's on screen, so "スコア全体" plays everything and
    // picking e.g. "Alto Saxophone 1" plays only that part.
    const partsToPlay = selectedPartId
      ? arrangement.parts.filter((p) => p.id === selectedPartId)
      : arrangement.parts;
    const lastEnd = Math.max(
      0,
      ...partsToPlay.flatMap((p) => p.melody.notes.map((n) => n.start + n.duration)),
    );
    await playArrangement(arrangement, BPM, selectedPartId, setIsLoadingAudio, mutedPartIds);
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
          <Link
            href="/songs"
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            {selectedSong ? (
              <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
                {selectedSong.title}
              </span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500">曲を選んでください</span>
            )}
            <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
              {selectedSong ? "変更する" : "選ぶ"} →
            </span>
          </Link>
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
                    disabled={isLoadingAudio}
                    className="self-start rounded-full bg-blue-400 px-6 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoadingAudio ? "音源読み込み中..." : isPlaying ? "■ 停止" : "▶ 再生"}
                  </button>
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={!canUndo}
                    title="⌘Z / Ctrl+Z"
                    className="self-start rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    ↶ 元に戻す
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={!canRedo}
                    title="⌘⇧Z / Ctrl+Shift+Z"
                    className="self-start rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    ↷ やり直す
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
                      {arrangement.parts.map((part) => {
                        const isMuted = mutedPartIds.has(part.id);
                        return (
                          <span key={part.id} className="inline-flex overflow-hidden rounded-full border border-slate-300 dark:border-slate-600">
                            <button
                              type="button"
                              onClick={() => setSelectedPartId(part.id)}
                              className={`px-3 py-1 text-xs font-medium transition-colors ${
                                selectedPartId === part.id
                                  ? "bg-green-500 text-white"
                                  : isMuted
                                    ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                              }`}
                            >
                              {part.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleMutedPart(part.id)}
                              title={isMuted ? `${part.name}のミュートを解除` : `${part.name}をミュート(再生せず、譜表もグレーアウト)`}
                              aria-pressed={isMuted}
                              className={`border-l px-2 py-1 text-xs transition-colors ${
                                isMuted
                                  ? "border-slate-300 bg-slate-300 text-slate-700 dark:border-slate-600 dark:bg-slate-600 dark:text-slate-200"
                                  : "border-slate-300 text-slate-400 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-500 dark:hover:bg-slate-700"
                              }`}
                            >
                              {isMuted ? "🔇" : "🔊"}
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <ScoreViewer
                  musicXml={arrangementToMusicXml(arrangement, selectedSong?.title, selectedPartId ?? undefined, mutedPartIds)}
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
