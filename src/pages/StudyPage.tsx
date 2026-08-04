import { useEffect, useMemo, useState } from 'react';
import WordCard from '../components/WordCard';
import NotesEditor from '../components/NotesEditor';
import ExamplePanel from '../components/ExamplePanel';
import RateControl from '../components/RateControl';
import AccentControl from '../components/AccentControl';
import { useWordsStore } from '../store/words';
import { useProgressStore } from '../store/progress';
import { useSettingsStore } from '../store/settings';
import { useToastStore } from '../store/toast';
import { useGlobalKeys } from '../hooks/useGlobalKeys';
import { speakWordSmart, stopSpeech } from '../lib/speech';

type Filter = 'all' | 'new' | 'wrong';

const FILTER_LABELS: Record<Filter, string> = {
  all: '全部',
  new: '生词',
  wrong: '错词',
};

export default function StudyPage() {
  const words = useWordsStore((s) => s.words);
  const records = useProgressStore((s) => s.records);
  const markKnown = useProgressStore((s) => s.markKnown);
  const markUnknown = useProgressStore((s) => s.markUnknown);
  const rate = useSettingsStore((s) => s.rate);
  const showToast = useToastStore((s) => s.show);

  const [filter, setFilter] = useState<Filter>('all');
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const counts = useMemo(
    () => ({
      all: words.length,
      new: words.filter((w) => !records[w.word]?.learnedAt).length,
      wrong: words.filter((w) => (records[w.word]?.wrongCount ?? 0) > 0).length,
    }),
    [words, records],
  );

  const list = useMemo(() => {
    if (filter === 'new') return words.filter((w) => !records[w.word]?.learnedAt);
    if (filter === 'wrong')
      return words.filter((w) => (records[w.word]?.wrongCount ?? 0) > 0);
    return words;
  }, [words, records, filter]);

  const safeIndex = Math.min(index, Math.max(0, list.length - 1));
  const word = list[safeIndex];

  useEffect(() => {
    setFlipped(false);
    setShowNotes(false);
  }, [safeIndex, filter]);

  const go = (delta: number) => {
    if (!list.length) return;
    setIndex((i) => Math.max(0, Math.min(list.length - 1, i + delta)));
  };

  const mark = (kind: 'known' | 'unknown') => {
    if (!word) return;
    if (kind === 'known') {
      markKnown(word);
      showToast(`已认识：${word.word}`, 'success');
    } else {
      markUnknown(word);
      showToast(`已加入错词本：${word.word}`, 'info');
    }
    if (safeIndex < list.length - 1) setIndex((i) => i + 1);
    else setFlipped(false);
  };

  const toggleFlipAndSpeak = () => {
    if (!word) return;
    if (!flipped) {
      setFlipped(true);
      stopSpeech();
      void speakWordSmart(word, rate, true);
    } else {
      setFlipped(false);
    }
  };

  useGlobalKeys(
    (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        toggleFlipAndSpeak();
      } else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === '1') mark('unknown');
      else if (e.key === '2') mark('known');
    },
    [word, flipped, rate, safeIndex, list.length, filter, records, markKnown, markUnknown],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(['all', 'new', 'wrong'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setIndex(0);
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                filter === f
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {FILTER_LABELS[f]} {counts[f]}
            </button>
          ))}
        </div>
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {list.length ? `${safeIndex + 1} / ${list.length}` : '0 / 0'}
        </div>
      </div>

      {word ? (
        <>
          <WordCard word={word} flipped={flipped} onFlip={toggleFlipAndSpeak} />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => mark('unknown')}
              className="rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-rose-600"
            >
              ✗ 不认识 (1)
            </button>
            <button
              type="button"
              onClick={() => mark('known')}
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-600"
            >
              ✓ 认识 (2)
            </button>
            <button
              type="button"
              onClick={() => go(-1)}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold shadow hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              ← 上一个
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold shadow hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              下一个 →
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <RateControl compact />
            <AccentControl />
            <button
              type="button"
              onClick={() => setShowNotes((v) => !v)}
              className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              {showNotes ? '收起笔记' : '📝 词根 / 音节笔记'}
            </button>
          </div>

          {showNotes && <div className="mt-4"><NotesEditor word={word} /></div>}
          <div className="mt-4"><ExamplePanel word={word} /></div>
        </>
      ) : (
        <div className="rounded-3xl border border-dashed p-12 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <div className="text-4xl">🌊</div>
          <p className="mt-2 font-semibold">
            {filter === 'wrong' ? '错词本还是空的，去学习页标记几个「不认识」吧' : '没有符合条件的单词'}
          </p>
          {filter !== 'all' && (
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="mt-3 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
            >
              查看全部单词
            </button>
          )}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
        快捷键：空格 = 翻面+播放 · ←/→ = 上一个/下一个 · 1 = 不认识 · 2 = 认识 · +/− = 语速
      </p>
    </div>
  );
}
