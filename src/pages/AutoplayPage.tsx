import { useEffect, useMemo, useState } from 'react';
import {
  useAutoplayStore,
  type AutoplayConfig,
  type AutoplayOrder,
} from '../store/autoplay';
import { useWordsStore } from '../store/words';
import { useSettingsStore } from '../store/settings';
import { useProgressStore } from '../store/progress';
import { useExampleCacheStore } from '../store/exampleCache';
import { useToastStore } from '../store/toast';
import { EXAMPLE_STYLES } from '../lib/exampleStyles';
import type { ExampleStyle } from '../types';
import { autoplayEngine, buildAutoplayQueue } from '../lib/autoplay';
import { syllableText } from '../lib/syllables';
import RateControl from '../components/RateControl';
import AccentControl from '../components/AccentControl';
import SwitchPanel from '../components/SwitchPanel';
import { useGlobalKeys } from '../hooks/useGlobalKeys';
import PhoneticText from '../components/PhoneticText';

const ORDER_LABELS: Record<AutoplayOrder, string> = {
  freq: '按词频顺序',
  random: '随机',
  unknown: '只播生词',
  wrong: '只播错词',
  category: '按分类筛选',
  range: '按词频区间筛选',
};

function clampInt(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

export default function AutoplayPage() {
  const config = useAutoplayStore((s) => s.config);
  const setConfig = useAutoplayStore((s) => s.setConfig);
  const status = useAutoplayStore((s) => s.status);
  const index = useAutoplayStore((s) => s.index);
  const repeatIndex = useAutoplayStore((s) => s.repeatIndex);
  const total = useAutoplayStore((s) => s.total);
  const done = useAutoplayStore((s) => s.done);
  const currentWord = useAutoplayStore((s) => s.currentWord);
  const exampleData = useAutoplayStore((s) => s.exampleData);
  const exampleLoading = useAutoplayStore((s) => s.exampleLoading);
  const exampleFromCache = useAutoplayStore((s) => s.exampleFromCache);
  const exampleError = useAutoplayStore((s) => s.exampleError);

  const words = useWordsStore((s) => s.words);
  const dicts = useWordsStore((s) => s.dicts);
  const activeDictId = useWordsStore((s) => s.activeDictId);
  const setActiveDict = useWordsStore((s) => s.setActiveDict);
  const records = useProgressStore((s) => s.records);
  const switches = useSettingsStore((s) => s.switches);
  const exampleStyle = useSettingsStore((s) => s.exampleStyle);
  const setExampleStyle = useSettingsStore((s) => s.setExampleStyle);
  const setSwitch = useSettingsStore((s) => s.setSwitch);
  const cacheSize = useExampleCacheStore((s) => s.order.length);
  const clearExampleCache = useExampleCacheStore((s) => s.clear);

  const [showConfig, setShowConfig] = useState(status === 'idle');
  const [jumpInput, setJumpInput] = useState('');
  const [showMeaningNow, setShowMeaningNow] = useState(switches.showMeaningCard);

  const categories = useMemo(() => Array.from(new Set(words.map((w) => w.category))), [words]);
  const available = useMemo(
    () => buildAutoplayQueue(words, config).length,
    [words, config, records],
  );

  useEffect(() => {
    return () => autoplayEngine.stop();
  }, []);

  useGlobalKeys(
    (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        autoplayEngine.toggle();
      } else if (e.key === 'ArrowLeft') autoplayEngine.prev();
      else if (e.key === 'ArrowRight') autoplayEngine.next();
    },
    [status],
  );

  const jump = () => {
    const n = parseInt(jumpInput, 10);
    if (Number.isNaN(n) || total === 0) return;
    autoplayEngine.jumpTo(clampInt(n, 1, total) - 1);
    setJumpInput('');
  };

  const start = () => {
    autoplayEngine.start(config);
    setShowMeaningNow(switches.showMeaningCard);
    setShowConfig(false);
  };

  const percent = total ? Math.round((done / total) * 100) : 0;

  if (showConfig || status === 'idle') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold">自动播放设置</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            可高度自定义的听读播放器，播放过的单词自动记为「已学」
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <label className="mb-1 block text-sm font-semibold">选择词库</label>
            <select
              value={activeDictId}
              onChange={(e) => void setActiveDict(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              {dicts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}（{d.count.toLocaleString()} 词）
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              切换词库会同时影响学习、复习、测验与自动播放
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <label className="mb-1 block text-sm font-semibold">播放顺序</label>
            <select
              value={config.order}
              onChange={(e) => setConfig({ order: e.target.value as AutoplayOrder })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              {(Object.keys(ORDER_LABELS) as AutoplayOrder[]).map((k) => (
                <option key={k} value={k}>
                  {ORDER_LABELS[k]}
                </option>
              ))}
            </select>

            {config.order === 'category' && (
              <div className="mt-3">
                <label className="mb-1 block text-sm font-semibold">选择分类</label>
                <select
                  value={config.category}
                  onChange={(e) => setConfig({ category: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {config.order === 'range' && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-sm font-semibold">序号区间</label>
                <input
                  type="number"
                  min={1}
                  max={words.length || 5530}
                  value={config.rangeMin}
                  onChange={(e) =>
                    setConfig({ rangeMin: clampInt(parseInt(e.target.value, 10), 1, words.length || 5530) })
                  }
                  className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
                <span>—</span>
                <input
                  type="number"
                  min={1}
                  max={words.length || 5530}
                  value={config.rangeMax}
                  onChange={(e) =>
                    setConfig({ rangeMax: clampInt(parseInt(e.target.value, 10), 1, words.length || 5530) })
                  }
                  className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="mb-1 block text-sm font-semibold">本次播放数量</label>
                <div className="flex items-center gap-2">
                  {[20, 50, 100].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setConfig({ count: n })}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        config.count === n
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={words.length || 5530}
                    value={config.count}
                    onChange={(e) =>
                      setConfig({ count: clampInt(parseInt(e.target.value, 10), 1, words.length || 5530) })
                    }
                    className="w-20 rounded-xl border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">当前筛选可播 {available} 个</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold">单词发音重复</label>
                <select
                  aria-label="发音重复次数"
                  value={config.repeats}
                  onChange={(e) =>
                    setConfig({ repeats: clampInt(parseInt(e.target.value, 10), 1, 10) })
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>
                      {n} 遍
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  发音重复 N 遍，释义与例句每词只读一遍
                </p>
              </div>

              <div className="min-w-[180px] flex-1">
                <label className="mb-1 flex justify-between text-sm font-semibold">
                  <span>单词间隔</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    {config.interval.toFixed(1)} 秒
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={config.interval}
                  onChange={(e) => setConfig({ interval: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <RateControl />
            <AccentControl />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold">开关区（全部持久化保存）</h3>
            <SwitchPanel />
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900 dark:bg-sky-900/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold">🤖 AI 例句（开关）</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  开启后每播完一个单词自动生成并朗读例句；关闭后零 API 调用
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={switches.aiExamples}
                onClick={() => setSwitch('aiExamples', !switches.aiExamples)}
                className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                  switches.aiExamples ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    switches.aiExamples ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
            {switches.aiExamples && (
              <div className="mt-3">
                <label className="mb-1 block text-sm font-semibold">例句风格</label>
                <select
                  value={exampleStyle}
                  onChange={(e) => setExampleStyle(e.target.value as ExampleStyle)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                >
                  {EXAMPLE_STYLES.map((s) => (
                    <option key={s.value} value={s.value} title={s.desc}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-400">
                  风格随请求与缓存一起生效：切换后新例句按新风格生成（缓存按风格分开）
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
            <span className="text-slate-500 dark:text-slate-400">
              AI 例句本地缓存：{cacheSize} 条
            </span>
            <button
              type="button"
              onClick={() => {
                clearExampleCache();
                useToastStore.getState().show('例句缓存已清空', 'success');
              }}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              清空例句缓存
            </button>
          </div>

          <button
            type="button"
            onClick={start}
            disabled={words.length === 0 || available === 0}
            className="w-full rounded-2xl bg-emerald-500 py-3.5 text-base font-bold text-white shadow-lg hover:bg-emerald-600 disabled:opacity-40"
          >
            ▶ 开始自动播放（{Math.min(config.count, available)} 个单词）
          </button>
        </div>
      </div>
    );
  }

  if (status === 'finished') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="text-6xl">🎉</div>
        <h2 className="mt-4 text-2xl font-bold">播放完成</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          本次共播放 {total} 个单词，已自动记为「已学」
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={start}
            className="rounded-xl bg-emerald-500 px-6 py-3 font-bold text-white hover:bg-emerald-600"
          >
            🔁 再播一遍
          </button>
          <button
            type="button"
            onClick={() => {
              autoplayEngine.stop();
              setShowConfig(true);
            }}
            className="rounded-xl bg-white px-6 py-3 font-semibold shadow hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            修改配置
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              status === 'playing'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
            }`}
          >
            {status === 'playing' ? '▶ 播放中' : '⏸ 已暂停'}
          </span>
          <span className="font-semibold">
            第 {Math.min(index + 1, total)} / {total} 个
          </span>
          {config.repeats > 1 && (
            <span className="text-slate-500 dark:text-slate-400">
              发音 第 {repeatIndex + 1}/{config.repeats} 遍
            </span>
          )}
          <select
            aria-label="播放中发音重复次数"
            value={config.repeats}
            onChange={(e) =>
              setConfig({ repeats: clampInt(parseInt(e.target.value, 10), 1, 10) })
            }
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold dark:border-slate-600 dark:bg-slate-800"
            title="播放中调整发音重复次数（下一个单词生效）"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                发音 {n} 遍
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSwitch('aiExamples', !switches.aiExamples)}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
              switches.aiExamples
                ? 'bg-sky-500 text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            AI 例句 {switches.aiExamples ? '开' : '关'}
          </button>
          {switches.aiExamples && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
              {EXAMPLE_STYLES.find((s) => s.value === exampleStyle)?.label}
            </span>
          )}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            {ORDER_LABELS[config.order]}
          </span>
        </div>
        <div className="w-48">
          <RateControl compact />
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      {currentWord && (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap justify-center gap-2 text-[11px] font-semibold">
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
              No.{currentWord.id}
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
              词频 {currentWord.freq}
            </span>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300">
              {currentWord.category}
            </span>
          </div>
          <div className="mt-4 text-4xl font-extrabold tracking-wide md:text-5xl">
            {currentWord.word}
          </div>
          <PhoneticText
            word={currentWord.word}
            className="mt-2 text-lg font-medium text-slate-500 dark:text-slate-400"
          />
          <div className="mt-2 text-xl font-medium tracking-wider text-emerald-600 dark:text-emerald-400">
            {syllableText(currentWord.word)}
          </div>

          {switches.showMeaningCard && (
            <div className="mt-5">
              {showMeaningNow ? (
                <div className="mx-auto max-w-md rounded-2xl bg-emerald-50 p-4 text-lg font-medium dark:bg-emerald-900/20">
                  {currentWord.meaning}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setShowMeaningNow((v) => !v)}
                className="mt-2 text-xs text-slate-400 underline hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showMeaningNow ? '隐藏释义' : '偷看释义'}
              </button>
            </div>
          )}
        </div>
      )}

      {switches.aiExamples && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-2 font-bold">AI 例句</h3>
          {exampleLoading && <p className="text-slate-500">正在生成…</p>}
          {exampleError && (
            <p className="text-rose-500">生成失败：{exampleError}（已跳过，不影响播放）</p>
          )}
          {exampleData && (
            <div className="space-y-2 leading-relaxed">
              <p className="italic text-slate-700 dark:text-slate-200">
                “{exampleData.english}”
              </p>
              {switches.withTranslation && exampleData.chinese && (
                <p className="text-slate-600 dark:text-slate-300">{exampleData.chinese}</p>
              )}
              {switches.withTranslation && exampleData.distinction && (
                <p className="rounded-xl bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  💡 {exampleData.distinction}
                </p>
              )}
              {exampleFromCache && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                  本地缓存
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => autoplayEngine.prev()}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold shadow hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          ⏮ 上一个
        </button>
        <button
          type="button"
          onClick={() => autoplayEngine.toggle()}
          className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-600"
        >
          {status === 'paused' ? '▶ 继续' : '⏸ 暂停'}
        </button>
        <button
          type="button"
          onClick={() => autoplayEngine.next()}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold shadow hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          下一个 ⏭
        </button>
        <div className="flex items-center gap-1">
          <input
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') jump();
            }}
            placeholder={`1-${total}`}
            className="w-20 rounded-xl border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <button
            type="button"
            onClick={jump}
            className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            跳到
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            autoplayEngine.stop();
            setShowConfig(true);
          }}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-rose-500 shadow hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          ■ 停止
        </button>
      </div>

      <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
        快捷键：空格 = 播放/暂停 · ←/→ = 上一个/下一个 · +/− = 语速
      </p>
    </div>
  );
}
