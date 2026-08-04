import { useSettingsStore } from '../store/settings';

const PRESETS = [0.1, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5];

export default function RateControl({ compact = false }: { compact?: boolean }) {
  const rate = useSettingsStore((s) => s.rate);
  const setRate = useSettingsStore((s) => s.setRate);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">播放语速</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRate(rate - 0.1)}
            className="h-7 w-7 rounded-lg bg-slate-100 text-sm font-bold hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
            aria-label="降低语速"
          >
            −
          </button>
          <span className="w-14 text-center font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
            {rate.toFixed(2)}x
          </span>
          <button
            type="button"
            onClick={() => setRate(rate + 0.1)}
            className="h-7 w-7 rounded-lg bg-slate-100 text-sm font-bold hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
            aria-label="提高语速"
          >
            +
          </button>
        </div>
      </div>
      <input
        type="range"
        min={0.1}
        max={5}
        step={0.1}
        value={rate}
        onChange={(e) => setRate(parseFloat(e.target.value))}
        className="mt-2 w-full accent-emerald-500"
        aria-label="语速滑块"
      />
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setRate(p)}
              className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
                Math.abs(rate - p) < 0.001
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              {p}x
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
