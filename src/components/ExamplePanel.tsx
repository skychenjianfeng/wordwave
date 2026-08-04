import { useState } from 'react';
import type { ExampleData, ExampleStyle, Word } from '../types';
import { getExample } from '../api/client';
import { useSettingsStore } from '../store/settings';
import { EXAMPLE_STYLES } from '../lib/exampleStyles';

export default function ExamplePanel({ word }: { word: Word }) {
  const withTranslation = useSettingsStore((s) => s.switches.withTranslation);
  const exampleStyle = useSettingsStore((s) => s.exampleStyle);
  const setExampleStyle = useSettingsStore((s) => s.setExampleStyle);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExampleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const generate = async (force: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getExample(word.word, word.meaning, withTranslation, exampleStyle, force);
      setData(res.data);
      setFromCache(res.fromCache);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">
          AI 例句
          <span className="ml-2 text-xs font-normal text-slate-400">
            {withTranslation ? '含中文翻译 + 辨析' : '仅英文（省 token）'}
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={exampleStyle}
            onChange={(e) => setExampleStyle(e.target.value as ExampleStyle)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium dark:border-slate-600 dark:bg-slate-800"
            aria-label="例句风格"
          >
            {EXAMPLE_STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        <div className="flex gap-2">
          {!data && (
            <button
              type="button"
              onClick={() => generate(false)}
              disabled={loading}
              className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
            >
              生成例句
            </button>
          )}
          {data && (
            <button
              type="button"
              onClick={() => generate(true)}
              disabled={loading}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              重新生成
            </button>
          )}
        </div>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">正在生成例句…</p>}

      {error && (
        <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
          {error}
          <button
            type="button"
            onClick={() => generate(false)}
            className="ml-2 font-semibold underline"
          >
            重试
          </button>
        </div>
      )}

      {data && (
        <div className="space-y-2 text-sm leading-relaxed">
          <p className="italic text-slate-700 dark:text-slate-200">“{data.english}”</p>
          {withTranslation && data.chinese && (
            <p className="text-slate-600 dark:text-slate-300">{data.chinese}</p>
          )}
          {withTranslation && data.distinction && (
            <p className="rounded-xl bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              💡 {data.distinction}
            </p>
          )}
          {fromCache && (
            <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              来自本地缓存
            </span>
          )}
        </div>
      )}
    </div>
  );
}
