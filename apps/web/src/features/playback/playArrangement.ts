"use client";

import type { Arrangement } from "@/features/score-viewer";
import { GM_KICK, GM_SNARE, GM_HIHAT_CLOSED, GM_RIDE } from "@/features/score-viewer/percussionMap";

interface Playable {
  triggerAttackRelease(note: string | number, duration: number, time?: number): void;
  dispose(): void;
}

interface Disposable {
  dispose(): void;
}

/** Kick/snare/hihat/ride each need a different Tone.js instrument shape — none of
 * them take a pitched "note" argument the way melodic synths do, so this
 * normalizes them to a single (duration, time) trigger. Built from Tone's own
 * built-in synths, not sampled drum audio: no new dependency, no runtime
 * fetch of external sample files. */
function createDrumKit(Tone: typeof import("tone")): { trigger: (gmKey: number, duration: number, time: number) => void; voices: Disposable[] } {
  const kick = new Tone.MembraneSynth().toDestination();
  const snare = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.15, sustain: 0 } }).toDestination();
  const hihat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.08, release: 0.01 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  }).toDestination();
  const ride = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.3, release: 0.05 },
    harmonicity: 4,
    modulationIndex: 20,
    resonance: 3000,
    octaves: 1,
  }).toDestination();

  const trigger = (gmKey: number, duration: number, time: number) => {
    switch (gmKey) {
      case GM_KICK:
        kick.triggerAttackRelease("C1", duration, time);
        break;
      case GM_SNARE:
        snare.triggerAttackRelease(duration, time);
        break;
      case GM_HIHAT_CLOSED:
        hihat.triggerAttackRelease(duration, time);
        break;
      case GM_RIDE:
        ride.triggerAttackRelease(duration, time);
        break;
    }
  };

  return { trigger, voices: [kick, snare, hihat, ride] };
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
  const synths: Disposable[] = [];

  for (const part of arrangement.parts) {
    if (part.clef === "percussion") {
      const kit = createDrumKit(Tone);
      synths.push(...kit.voices);
      const drumNotes = [...part.melody.notes, ...(part.secondaryVoice?.notes ?? [])];
      for (const note of drumNotes) {
        const pitches = note.pitches && note.pitches.length > 0 ? note.pitches : [note.pitch];
        const time = note.start * secondsPerBeat;
        const duration = note.duration * secondsPerBeat * 0.95;
        Tone.Transport.scheduleOnce((t) => {
          for (const gmKey of pitches) kit.trigger(gmKey, duration, t);
        }, time);
      }
      continue;
    }

    const synth: Playable =
      part.clef === "bass"
        ? new Tone.MonoSynth({ oscillator: { type: "sine" } }).toDestination()
        : part.polyphonic
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
    ...arrangement.parts.flatMap((p) =>
      [...p.melody.notes, ...(p.secondaryVoice?.notes ?? [])].map((n) => n.start + n.duration),
    ),
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
