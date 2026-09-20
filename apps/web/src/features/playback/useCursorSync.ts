"use client";

import { useEffect, useRef } from "react";
import type { ScoreCursor } from "@/features/score-viewer";

/**
 * Drives the OSMD cursor forward in lockstep with Tone.Transport while
 * playing, using the transport's own clock (not wall-clock time) so the
 * blue line stays sample-accurate with the audio even under scheduling
 * jitter. OSMD cursor timestamps are in whole notes; our beat unit is a
 * quarter note, so 4 beats = 1 whole note regardless of time signature.
 */
export function useCursorSync(cursor: ScoreCursor | null, isPlaying: boolean, bpm: number) {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!cursor || !isPlaying) return;

    let cancelled = false;
    cursor.reset();
    cursor.show();

    async function loop() {
      if (cancelled || !cursor) return;
      const Tone = await import("tone");
      if (cancelled) return;

      const tick = () => {
        if (cancelled) return;
        const elapsedBeats = Tone.getTransport().seconds * (bpm / 60);
        const elapsedWholeNotes = elapsedBeats / 4;
        while (!cursor.iterator.EndReached && cursor.iterator.currentTimeStamp.RealValue < elapsedWholeNotes) {
          cursor.next();
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    loop();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      cursor.hide();
    };
  }, [cursor, isPlaying, bpm]);
}
