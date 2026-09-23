"use client";

import {
  CUSTOM_ENSEMBLE_ID,
  ENSEMBLES,
  GENRES,
  INSTRUMENT_CATALOG,
  KEY_ROOTS,
  MAX_CUSTOM_INSTRUMENTS,
  SONG_FORMS,
  type ArrangeOptions,
} from "./types";

const GROUP_LABELS: Record<(typeof INSTRUMENT_CATALOG)[number]["group"], string> = {
  woodwind: "木管",
  brass: "金管",
  rhythm: "リズム/コード",
};

export function ArrangeOptionsForm({
  value,
  onChange,
}: {
  value: ArrangeOptions;
  onChange: (options: ArrangeOptions) => void;
}) {
  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col gap-2">
        <span className="text-sm text-slate-500 dark:text-slate-400">曲構成</span>
        <div className="flex flex-wrap gap-2">
          {SONG_FORMS.map((form) => (
            <button
              key={form.id}
              type="button"
              onClick={() => onChange({ ...value, songForm: form.id })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                value.songForm === form.id
                  ? "bg-blue-400 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {form.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-slate-500 dark:text-slate-400">ジャンル</span>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((genre) => (
            <button
              key={genre.id}
              type="button"
              onClick={() => onChange({ ...value, genre: genre.id })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                value.genre === genre.id
                  ? "bg-blue-400 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {genre.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-slate-500 dark:text-slate-400">編成</span>
        <div className="flex flex-wrap gap-2">
          {ENSEMBLES.map((ensemble) => (
            <button
              key={ensemble.id}
              type="button"
              title={ensemble.description}
              onClick={() => onChange({ ...value, ensembleId: ensemble.id })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                value.ensembleId === ensemble.id
                  ? "bg-blue-400 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {ensemble.label}
            </button>
          ))}
        </div>
        {value.ensembleId === CUSTOM_ENSEMBLE_ID && (
          <div className="mt-2 flex flex-col gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
              <span>楽器を選択(最大{MAX_CUSTOM_INSTRUMENTS}種)</span>
              <span>{value.customInstrumentIds.length}種選択中</span>
            </div>
            {(["woodwind", "brass", "rhythm"] as const).map((group) => (
              <div key={group} className="flex flex-col gap-1">
                <span className="text-xs text-slate-400 dark:text-slate-500">{GROUP_LABELS[group]}</span>
                <div className="flex flex-wrap gap-2">
                  {INSTRUMENT_CATALOG.filter((i) => i.group === group).map((instrument) => {
                    const selected = value.customInstrumentIds.includes(instrument.id);
                    const atLimit = !selected && value.customInstrumentIds.length >= MAX_CUSTOM_INSTRUMENTS;
                    return (
                      <button
                        key={instrument.id}
                        type="button"
                        disabled={atLimit}
                        onClick={() =>
                          onChange({
                            ...value,
                            customInstrumentIds: selected
                              ? value.customInstrumentIds.filter((id) => id !== instrument.id)
                              : [...value.customInstrumentIds, instrument.id],
                          })
                        }
                        className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                          selected
                            ? "bg-blue-400 text-white"
                            : atLimit
                              ? "border border-slate-100 text-slate-300 dark:border-slate-800 dark:text-slate-600"
                              : "border border-slate-200 text-slate-600 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        {instrument.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-slate-500 dark:text-slate-400">調</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...value, keyRoot: null })}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              value.keyRoot === null
                ? "bg-blue-400 text-white"
                : "border border-slate-200 text-slate-600 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            お任せ
          </button>
          {KEY_ROOTS.map((key) => (
            <button
              key={key.id}
              type="button"
              onClick={() => onChange({ ...value, keyRoot: key.id })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                value.keyRoot === key.id
                  ? "bg-blue-400 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {key.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>崩し度</span>
          <span>{value.distortion}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={value.distortion}
          onChange={(e) => onChange({ ...value, distortion: Number(e.target.value) })}
          className="w-full accent-blue-400"
        />
        <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
          <span>忠実</span>
          <span>大胆に崩す</span>
        </div>
      </div>
    </div>
  );
}
