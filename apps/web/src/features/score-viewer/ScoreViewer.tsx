"use client";

import { useEffect, useRef, useState } from "react";

export function ScoreViewer({ musicXml, title }: { musicXml: string; title?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!containerRef.current) return;
      try {
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
        setError(null);
      } catch (e) {
        if (cancelled) return;
        console.error("ScoreViewer: failed to render score", e, musicXml);
        setError("楽譜の表示に失敗しました。もう一度生成し直してください。");
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [musicXml, title]);

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700">
      {error ? (
        <p className="p-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <div ref={containerRef} />
      )}
    </div>
  );
}
