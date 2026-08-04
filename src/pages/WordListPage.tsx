import { useEffect, useMemo, useState } from 'react';
import VirtualList from '../components/VirtualList';
import WordCard from '../components/WordCard';
import NotesEditor from '../components/NotesEditor';
import ExamplePanel from '../components/ExamplePanel';
import { useWordsStore } from '../store/words';
import { useProgressStore } from '../store/progress';
import { useSettingsStore } from '../store/settings';
import { speakWordSmart, stopSpeech } from '../lib/speech';
import { syllableText } from '../lib/syllables';
import type { Word, WordProgress } from '../types';

function statusOf(rec: WordProgress | undefined): { label: string; cls: string } {
  if (!rec?.learnedAt) return { label: '新词', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300' };
  if (rec.status === 'mastered') return { label: '已掌握', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' };
  if (rec.wrongCount > 0) return { label: '错词', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300' };
  return { label: '学习中', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300' };
}

const ROW_HEIGHT = 56;

export default function WordListPage() {
  const words = useWordsStore((s) => s.words);
  const dicts = useWordsStore((s) => s.dicts);
  const activeDictId = useWordsStore((s) => s.activeDictId);
  const setActiveDict = useWordsStore((s) => s.setActiveDict);
  const records = useProgressStore((s) => s.records);
  const markKnown = useProgressStore((s) => s.markKnown);
  const markUnknown = useProgressStore((s) => s.markUnknown);
  const rate = useSettingsStore((s) => s.rate);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('全部');
  const [subcategory, setSubcategory] = useState('全部');
  const [status, setStatus] = useState('全部');
  const [selected, setSelected] = useState<Word | null>(null);
  const [flipped, setFlipped] = useState(false);

  const categories = useMemo(
    () => ['全部', ...Array.from(new Set(words.map((w) => w.category)))],
    [words],
  );
  const subcategories = useMemo(
    () => [
      '全部',
      ...Array.from(
        new Set(
          words
            .filter((w) => category === '全部' || w.category === category)
            .map((w) => w.subcategory)
            .filter((x): x is string => !!x),
        ),
      ),
    ],
    [words, category],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return words.filter((w) => {
      if (q && !w.word.toLowerCase().includes(q) && !w.meaning.toLowerCase().includes(q))
        return false;
      if (category !== '全部' && w.category !== category) return false;
      if (subcategory !== '全部' && w.subcategory !== subcategory) return false;
      const rec = records[w.word];
      if (status === '新词' && rec?.learnedAt) return false;
      if (status === '学习中' && rec?.status !== 'learning') return false;
      if (status === '已掌握' && rec?.status !== 'mastered') return false;
      if (status === '错词' && (rec?.wrongCount ?? 0) === 0) return false;
      return true;
    });
  }, [words, search, category, subcategory, status, records]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  useEffect(() => {
    setFlipped(false);
  }, [selected]);

  const selectCls =
    'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-800';

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold">单词列表</h2>
        <select
          value={activeDictId}
          onChange={(e) => void setActiveDict(e.target.value)}
          className="ml-auto rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-800"
        >
          {dicts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}（{d.count.toLocaleString()} 词）
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 搜索单词或释义…"
          className={`${selectCls} w-full`}
        />
        <select value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory('全部'); }} className={selectCls}>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className={selectCls}>
          {subcategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
          {['全部', '新词', '学习中', '已掌握', '错词'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <p className="mb-2 text-xs text-slate-400">
        当前词库共 {words.length} 词 · 筛选后 {filtered.length} 词（虚拟滚动，大词库流畅浏览）
      </p>

      <VirtualList
        items={filtered}
        rowHeight={ROW_HEIGHT}
        className="h-[68vh] rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
        renderRow={(w) => {
          const st = statusOf(records[w.word]);
          return (
            <div
              onClick={() => setSelected(w)}
              className="flex h-full w-full cursor-pointer items-center gap-3 border-b border-slate-100 px-3 hover:bg-emerald-50/50 dark:border-slate-700/50 dark:hover:bg-slate-700/40"
            >
              <span className="w-14 shrink-0 font-mono text-xs text-slate-400">#{w.id}</span>
              <div className="w-44 min-w-0 shrink-0">
                <div className="truncate text-sm font-bold">{w.word}</div>
                <div className="truncate text-xs text-emerald-600 dark:text-emerald-400">
                  {syllableText(w.word)}
                </div>
              </div>
              <div className="min-w-0 flex-1 truncate text-sm text-slate-500 dark:text-slate-400">
                {w.meaning}
              </div>
              <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline ${st.cls}`}>
                {st.label}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stopSpeech();
                  void speakWordSmart(w, rate, false);
                }}
                className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
                aria-label={`播放 ${w.word}`}
              >
                🔊
              </button>
            </div>
          );
        }}
      />

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="my-4 w-full max-w-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl bg-white px-3 py-1.5 text-sm font-bold shadow dark:bg-slate-700"
              >
                ✕ 关闭
              </button>
            </div>
            <WordCard word={selected} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => markUnknown(selected)}
                className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600"
              >
                ✗ 不认识
              </button>
              <button
                type="button"
                onClick={() => markKnown(selected)}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600"
              >
                ✓ 认识
              </button>
            </div>
            <NotesEditor word={selected} />
            <ExamplePanel word={selected} />
          </div>
        </div>
      )}
    </div>
  );
}
