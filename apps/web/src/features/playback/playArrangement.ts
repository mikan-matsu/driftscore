"use client";

import type { Arrangement } from "@/features/score-viewer";
import {
  GM_KICK,
  GM_SIDE_STICK,
  GM_SNARE,
  GM_LOW_TOM,
  GM_MID_TOM,
  GM_HIGH_TOM,
  GM_HIHAT_CLOSED,
  GM_RIDE,
  GM_AGOGO_HIGH,
  GM_AGOGO_LOW,
  GM_MARACAS,
} from "@/features/score-viewer/percussionMap";
import { loadSampledInstruments, stopAllSampledInstruments } from "./sampledInstruments";
import { swingForPlayback } from "./swingPlayback";

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
  // Rim click: an even tighter/drier noise burst than the maracas shimmer —
  // reads as a "tick" rather than a hit, distinct from the snare's full
  // backbeat crack.
  const sideStick = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.02, sustain: 0 } }).toDestination();
  // One shared pitched-membrane voice for all three toms (unlike the metal
  // synths above, MembraneSynth's triggerAttackRelease takes a real note
  // argument, so no need for three separate instances) — envelope kept
  // short enough for the samba fill's back-to-back 16th-note tom run.
  const toms = new Tone.MembraneSynth({ octaves: 3, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 } }).toDestination();

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
        case GM_SIDE_STICK:
          triggerMetal(sideStick, 0.02, 0, duration, t);
          break;
        case GM_LOW_TOM:
          toms.triggerAttackRelease("G2", duration, t);
          break;
        case GM_MID_TOM:
          toms.triggerAttackRelease("C3", duration, t);
          break;
        case GM_HIGH_TOM:
          toms.triggerAttackRelease("F3", duration, t);
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

  return { trigger, voices: [kick, snare, hihat, ride, maracas, agogoHigh, agogoLow, sideStick, toms] };
}

let stopCurrent: (() => void) | null = null;

export function stopPlayback() {
  stopCurrent?.();
  stopCurrent = null;
}

/**
 * `partId` restricts playback to a single part — mirrors the score view's
 * own per-part tab (selectedPartId in page.tsx), so soloing a part on
 * screen and soloing it in playback stay in sync. Falls back to every part
 * (the normal full-score playback) when omitted or when it doesn't match
 * any part in this arrangement, rather than silently playing nothing.
 *
 * `onLoading` fires while this arrangement's sampled instruments (most of
 * them — see sampledInstruments.ts) are being fetched, so a caller can show
 * a loading indicator: unlike a synthesized oscillator, a sample-based
 * instrument's first use in a session genuinely has to download audio
 * before it can play anything.
 */
export async function playArrangement(
  arrangement: Arrangement,
  bpm = 108,
  partId?: string | null,
  onLoading?: (loading: boolean) => void,
) {
  stopPlayback();

  const Tone = await import("tone");
  await Tone.start();

  const secondsPerBeat = 60 / bpm;
  const disposables: Disposable[] = [];

  const partsToPlay = partId && arrangement.parts.some((p) => p.id === partId)
    ? arrangement.parts.filter((p) => p.id === partId)
    : arrangement.parts;

  const pitchedInstrumentIds = partsToPlay.filter((p) => p.clef !== "percussion").map((p) => p.id);
  onLoading?.(true);
  const sampledInstruments = await loadSampledInstruments(Tone, pitchedInstrumentIds);
  onLoading?.(false);

  const isJazz = arrangement.genre === "jazz";

  for (const part of partsToPlay) {
    if (part.clef === "percussion") {
      const kit = createDrumKit(Tone);
      disposables.push(...kit.voices);
      // Swung per voice (up/down), never on the combined list — the two
      // voices' notes interleave at the same starting beats (e.g. a kick
      // and a ride both starting on beat 1), and swingForPlayback's pairing
      // is blind to which voice a note belongs to: run on a merged list, a
      // down-voice kick with no real partner of its own could accidentally
      // steal the up-voice ride note that actually pairs with it, corrupting
      // both. Each voice's own note stream never has this ambiguity.
      const upNotes = isJazz ? swingForPlayback(part.melody.notes) : part.melody.notes;
      const downNotes = part.secondaryVoice
        ? isJazz
          ? swingForPlayback(part.secondaryVoice.notes)
          : part.secondaryVoice.notes
        : [];
      const drumNotes = [...upNotes, ...downNotes];
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

    // Every pitched DriftScore instrument maps to a real-instrument sample
    // set (see sampledInstruments.ts) — an unmapped id would mean a new
    // instrument was added to the engine's catalog without a GM mapping,
    // which should be fixed there rather than silently substituted here.
    const instrument = sampledInstruments.get(part.id);
    if (!instrument) continue;

    const notes = isJazz ? swingForPlayback(part.melody.notes) : part.melody.notes;
    for (const note of notes) {
      const pitches = note.pitches && note.pitches.length > 0 ? note.pitches : [note.pitch];
      const time = note.start * secondsPerBeat;
      const duration = note.duration * secondsPerBeat * 0.95;
      Tone.Transport.scheduleOnce((t) => {
        for (const pitch of pitches) {
          instrument.start({ note: pitch, time: t, duration, velocity: note.velocity });
        }
      }, time);
    }
  }

  const lastEnd = Math.max(
    0,
    ...partsToPlay.flatMap((p) =>
      [...p.melody.notes, ...(p.secondaryVoice?.notes ?? [])].map((n) => n.start + n.duration),
    ),
  );

  const cleanup = () => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    stopAllSampledInstruments();
    for (const d of disposables) d.dispose();
  };
  Tone.Transport.scheduleOnce(() => {
    cleanup();
    stopCurrent = null;
  }, lastEnd * secondsPerBeat + 0.5);

  stopCurrent = cleanup;
  Tone.Transport.start();
}
