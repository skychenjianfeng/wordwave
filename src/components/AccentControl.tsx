import { useSettingsStore, type Accent } from '../store/settings';

const OPTIONS: { value: Accent; label: string; flag: string }[] = [
  { value: 'us', label: '美式', flag: '🇺🇸' },
  { value: 'uk', label: '英式（伦敦腔）', flag: '🇬🇧' },
];

export default function AccentControl() {
  const accent = useSettingsStore((s) => s.accent);
  const setAccent = useSettingsStore((s) => s.setAccent);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <div className="text-sm font-semibold">发音口音</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setAccent(o.value)}
            className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
              accent === o.value
                ? 'bg-sky-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            {o.flag} {o.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-slate-400">
        单词/音节/释义本地音包与 Django 内置 Piper 发音均跟随口音（英式用 en-GB 音色）
      </p>
    </div>
  );
}
