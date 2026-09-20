"use client";

import { useEffect, useRef } from "react";

export function ScoreViewer({ musicXml, title }: { musicXml: string; title?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!containerRef.current) return;
      const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
      if (cancelled || !containerRef.current) return;

      containerRef.current.innerHTML = "";
      const osmd = new OpenSheetMusicDisplay(containerRef.current, {
        autoResize: true,
        backend: "svg",
        drawTitle: Boolean(title),
      });
      await osmd.load(musicXml);
      if (cancelled) return;
      osmd.render();
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [musicXml, title]);

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700">
      <div ref={containerRef} />
    </div>
  );
}
