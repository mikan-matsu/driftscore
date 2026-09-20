"use client";

import { useState } from "react";
import type { Note, Melody } from "./types";

const LOWEST_PITCH = 60; // C4
const PITCH_COUNT = 24; // 2 octaves
const BARS = 4;
const BEATS_PER_BAR = 4;
const CELL_WIDTH = 32;
const CELL_HEIGHT = 20;

function pitchLabel(pitch: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(pitch / 12) - 1;
  return `${names[pitch % 12]}${octave}`;
}

export function PianoRoll({
  melody,
  onChange,
}: {
  melody: Melody;
  onChange: (melody: Melody) => void;
}) {
  const [nextId, setNextId] = useState(0);
  const totalBeats = BARS * BEATS_PER_BAR;
  const pitches = Array.from({ length: PITCH_COUNT }, (_, i) => LOWEST_PITCH + PITCH_COUNT - 1 - i);

  function toggleCell(pitch: number, beat: number) {
    const existing = melody.notes.find((n) => n.pitch === pitch && n.start === beat);
    if (existing) {
      onChange({ ...melody, notes: melody.notes.filter((n) => n.id !== existing.id) });
      return;
    }
    const note: Note = { id: `n${nextId}`, pitch, start: beat, duration: 1, velocity: 100 };
    setNextId((id) => id + 1);
    onChange({ ...melody, notes: [...melody.notes, note] });
  }

  return (
    <div className="overflow-x-auto border border-neutral-300 dark:border-neutral-700 rounded-md">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `80px repeat(${totalBeats}, ${CELL_WIDTH}px)`,
        }}
      >
        {pitches.map((pitch) => (
          <div key={pitch} className="contents">
            <div
              className="sticky left-0 bg-neutral-100 dark:bg-neutral-900 border-b border-r border-neutral-300 dark:border-neutral-700 text-xs flex items-center justify-end pr-2"
              style={{ height: CELL_HEIGHT }}
            >
              {pitchLabel(pitch)}
            </div>
            {Array.from({ length: totalBeats }, (_, beat) => {
              const isNoteHere = melody.notes.some((n) => n.pitch === pitch && n.start === beat);
              const isBarStart = beat % BEATS_PER_BAR === 0;
              return (
                <button
                  key={beat}
                  type="button"
                  onClick={() => toggleCell(pitch, beat)}
                  className={`border-b border-neutral-200 dark:border-neutral-800 ${
                    isBarStart ? "border-l-2 border-l-neutral-400 dark:border-l-neutral-600" : "border-l border-l-neutral-200 dark:border-l-neutral-800"
                  } ${isNoteHere ? "bg-[#0a422f]" : "hover:bg-neutral-200 dark:hover:bg-neutral-800"}`}
                  style={{ height: CELL_HEIGHT }}
                  aria-label={`${pitchLabel(pitch)} beat ${beat + 1}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
