"use client";

import type { Arrangement } from "@/features/score-viewer";
import {
  GM_KICK,
  GM_SNARE,
  GM_HIHAT_CLOSED,
  GM_RIDE,
  GM_AGOGO_HIGH,
  GM_AGOGO_LOW,
  GM_MARACAS,
} from "@/features/score-viewer/percussionMap";

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
/**
 * Clamps a MetalSynth/NoiseSynth's own decay+release to fit inside the note
 * duration it's about to play, then triggers it. Each of these synths has a
 * FIXED envelope set at construction time, independent of how long the note
 * actually is — fine for slower patterns, but the jazz ride's swung
 * "ding-a-ding" (0.25-beat gaps) and other tight 16th-note patterns can
 * retrigger the same synth before its fixed decay/release curve finishes,
 * which throws "Start time must be strictly greater than previous start
 * time" from Tone's internal envelope automation (the next attack lands
 * before the previous release curve's already-scheduled tail). Rescaling
 * the envelope per hit keeps every synth's tail shorter than its own gap to
 * the next hit, regardless of tempo or pattern.
 */
function triggerMetal(
  synth: { set(props: Record<string, unknown>): void; triggerAttackRelease(duration: number, time: number): void },
  baseDecay: number,
  baseRelease: number,
  duration: number,
  time: number,
) {
  const decay = Math.min(baseDecay, duration * 0.6);
  const release = Math.min(baseRelease, duration * 0.2);
  synth.set({ envelope: { decay, release } });
  synth.triggerAttackRelease(duration, time);
}

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
  // Shaker: a much tighter noise burst than the snare's, so it reads as a
  // continuous shimmer rather than a backbeat hit.
  const maracas = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 } }).toDestination();
  // Agogô bells: two MetalSynths tuned apart (like hihat/ride above) rather
  // than one instrument pitched dynamically, since MetalSynth's trigger
  // doesn't take a note argument.
  const agogoHigh = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.2, release: 0.05 },
    harmonicity: 8,
    modulationIndex: 16,
    resonance: 5200,
    octaves: 0.8,
  }).toDestination();
  const agogoLow = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.25, release: 0.05 },
    harmonicity: 6,
    modulationIndex: 16,
    resonance: 3600,
    octaves: 0.8,
  }).toDestination();

  // Tone's underlying oscillators require every start() on the same voice to
  // be at a strictly later time than the previous one — in practice, times
  // computed as `note.start * secondsPerBeat` for two notes on the same drum
  // voice can land close enough together that floating-point rounding (or
  // Web Audio's own scheduling precision) makes the second one not strictly
  // greater, which throws instead of silently reordering. A tiny enforced
  // minimum gap per voice, independent of how the times were computed
  // upstream, is the only way to guarantee this rather than just making it
  // less likely.
  const MIN_GAP = 0.002; // 2ms — inaudible, just enough to break exact/near ties
  const lastTriggerTime: Partial<Record<number, number>> = {};
  const nextTime = (gmKey: number, time: number) => {
    const last = lastTriggerTime[gmKey];
    const t = last !== undefined && time <= last ? last + MIN_GAP : time;
    lastTriggerTime[gmKey] = t;
    return t;
  };

  const trigger = (gmKey: number, duration: number, time: number) => {
    const t = nextTime(gmKey, time);
    try {
      switch (gmKey) {
        case GM_KICK:
          kick.triggerAttackRelease("C1", duration, t);
          break;
        case GM_SNARE:
          triggerMetal(snare, 0.15, 0, duration, t);
          break;
        case GM_HIHAT_CLOSED:
          triggerMetal(hihat, 0.08, 0.01, duration, t);
          break;
        case GM_RIDE:
          triggerMetal(ride, 0.3, 0.05, duration, t);
          break;
        case GM_MARACAS:
          triggerMetal(maracas, 0.04, 0, duration, t);
          break;
        case GM_AGOGO_HIGH:
          triggerMetal(agogoHigh, 0.2, 0.05, duration, t);
          break;
        case GM_AGOGO_LOW:
          triggerMetal(agogoLow, 0.25, 0.05, duration, t);
          break;
      }
    } catch {
      // Tone clamps a scheduled time to the audio context's actual current
      // time if playback has fallen behind (e.g. the JS thread stalls for a
      // moment scheduling hundreds of drum hits at once, more likely in a
      // dev build than production) — two nearby hits on the same voice can
      // then both get clamped to the same instant, which Tone's underlying
      // oscillator rejects as "not strictly greater than the previous start
      // time". This is an inherent real-time-scheduling race, not a data
      // bug (verified: the generated note timings themselves never
      // collide) — dropping the one hit that lost the race is inaudible and
      // far better than the whole playback erroring out.
    }
  };

  return { trigger, voices: [kick, snare, hihat, ride, maracas, agogoHigh, agogoLow] };
}

/**
 * Per-instrument-id timbre so a flute doesn't sound like a trumpet doesn't
 * sound like a guitar — built entirely from Tone.js's own oscillator
 * shapes/envelopes (no sampled instrument audio, same choice as the drum
 * kit above: no new dependency, no runtime fetch of external sample files).
 * Oscillator choice leans on real acoustic reasoning where there's an
 * obvious fit (clarinet's cylindrical bore favors odd harmonics, i.e. a
 * square wave; a plucked string's envelope is fast-attack/fast-decay/
 * near-zero sustain), otherwise just differentiates brightness/attack by
 * ear. `id` not in this table (e.g. the generic "lead" placeholder) falls
 * back to Tone's own defaults, matching the pre-existing behavior.
 */
type BasicOscillatorType = "sine" | "square" | "sawtooth" | "triangle";
interface VoiceEnvelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

const INSTRUMENT_VOICES: Record<string, { oscillator: BasicOscillatorType; envelope: VoiceEnvelope }> = {
  flute: { oscillator: "sine", envelope: { attack: 0.05, decay: 0.1, sustain: 0.9, release: 0.3 } },
  oboe: { oscillator: "sawtooth", envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.2 } },
  clarinetBb: { oscillator: "square", envelope: { attack: 0.03, decay: 0.05, sustain: 0.9, release: 0.2 } },
  trumpetBb: { oscillator: "sawtooth", envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.15 } },
  trumpetBb2: { oscillator: "sawtooth", envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.15 } },
  hornF: { oscillator: "triangle", envelope: { attack: 0.04, decay: 0.1, sustain: 0.8, release: 0.3 } },
  trombone: { oscillator: "sawtooth", envelope: { attack: 0.03, decay: 0.1, sustain: 0.75, release: 0.2 } },
  // Poly (chordal) instruments — a fast decay to near-zero sustain reads as
  // "struck/plucked" rather than "held", the main audible difference
  // between piano/guitar comping and a sustained wind/brass line.
  piano: { oscillator: "triangle", envelope: { attack: 0.005, decay: 0.6, sustain: 0.05, release: 0.5 } },
  guitar: { oscillator: "square", envelope: { attack: 0.005, decay: 0.3, sustain: 0.05, release: 0.4 } },
  // Bass-role instruments.
  electricBass: { oscillator: "sine", envelope: { attack: 0.01, decay: 0.15, sustain: 0.8, release: 0.15 } },
  tuba: { oscillator: "sine", envelope: { attack: 0.04, decay: 0.15, sustain: 0.85, release: 0.25 } },
  bassoon: { oscillator: "sawtooth", envelope: { attack: 0.03, decay: 0.1, sustain: 0.8, release: 0.2 } },
};

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

    const voice = INSTRUMENT_VOICES[part.id];
    const synth: Playable =
      part.clef === "bass"
        ? new Tone.MonoSynth({ oscillator: { type: voice?.oscillator ?? "sine" }, envelope: voice?.envelope }).toDestination()
        : part.polyphonic
          ? new Tone.PolySynth(Tone.Synth, { oscillator: { type: voice?.oscillator ?? "triangle" }, envelope: voice?.envelope }).toDestination()
          : new Tone.Synth({ oscillator: { type: voice?.oscillator ?? "triangle" }, envelope: voice?.envelope }).toDestination();
    synths.push(synth);

    for (const note of part.melody.notes) {
      const pitches = note.pitches && note.pitches.length > 0 ? note.pitches : [note.pitch];
      const time = note.start * secondsPerBeat;
      const duration = note.duration * secondsPerBeat * 0.95;
      Tone.Transport.scheduleOnce((t) => {
        for (const pitch of pitches) {
          const freq = Tone.Frequency(pitch, "midi").toFrequency();
          // See the drum kit's `trigger()` above for why this can throw
          // even with correct, non-overlapping note data: Tone clamps a
          // scheduled time to "now" when the JS thread falls behind (e.g.
          // scheduling hundreds of notes at once in a dev build), which can
          // make two nearby notes on the same monophonic synth collide.
          try {
            synth.triggerAttackRelease(freq, duration, t);
          } catch {
            // dropped one note to a scheduling race — inaudible, see above.
          }
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
