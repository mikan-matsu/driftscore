"use client";

import { useEffect, useRef } from "react";
import type { Melody } from "@/features/piano-roll";
import { melodyToMusicXml } from "./melodyToMusicXml";

export function ScoreViewer({ melody, title }: { melody: Melody; title?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let osmd: import("opensheetmusicdisplay").OpenSheetMusicDisplay | undefined;

    async function render() {
      if (!containerRef.current) return;
      const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
      if (cancelled || !containerRef.current) return;

      containerRef.current.innerHTML = "";
      osmd = new OpenSheetMusicDisplay(containerRef.current, {
        autoResize: true,
        backend: "svg",
        drawTitle: Boolean(title),
      });
      const xml = melodyToMusicXml(melody, title);
      await osmd.load(xml);
      if (cancelled) return;
      osmd.render();
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [melody, title]);

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-neutral-300 bg-white p-4 dark:border-neutral-700">
      <div ref={containerRef} />
    </div>
  );
}
