"use client";

import type { Arrangement } from "@/features/score-viewer";

interface Playable {
  triggerAttackRelease(note: string | number, duration: number, time?: number): void;
  dispose(): void;
}

let stopCurrent: (() => void) | null = null;

export function stopPlayback() {
  stopCurrent?.();
  stopCurrent = null;
}

export async function playArrangement(arrangement: Arrangement, bpm = 108) {
  stopPlayback();

  const Tone = await import("tone");
  await Tone.start();

  const secondsPerBeat = 60 / bpm;
  const synths: Playable[] = [];

  for (const part of arrangement.parts) {
    const synth: Playable =
      part.id === "bass"
        ? new Tone.MonoSynth({ oscillator: { type: "sine" } }).toDestination()
        : part.id === "chords"
          ? new Tone.PolySynth(Tone.Synth).toDestination()
          : new Tone.Synth().toDestination();
    synths.push(synth);

    for (const note of part.melody.notes) {
      const pitches = note.pitches && note.pitches.length > 0 ? note.pitches : [note.pitch];
      const time = note.start * secondsPerBeat;
      const duration = note.duration * secondsPerBeat * 0.95;
      Tone.Transport.scheduleOnce((t) => {
        for (const pitch of pitches) {
          const freq = Tone.Frequency(pitch, "midi").toFrequency();
          synth.triggerAttackRelease(freq, duration, t);
        }
      }, time);
    }
  }

  const lastEnd = Math.max(
    0,
    ...arrangement.parts.flatMap((p) => p.melody.notes.map((n) => n.start + n.duration)),
  );

  const cleanup = () => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    for (const synth of synths) synth.dispose();
  };
  Tone.Transport.scheduleOnce(() => {
    cleanup();
    stopCurrent = null;
  }, lastEnd * secondsPerBeat + 0.5);

  stopCurrent = cleanup;
  Tone.Transport.start();
}
