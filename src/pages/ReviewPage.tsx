import { useMemo, useState } from 'react';
import WordCard from '../components/WordCard';
import { useWordsStore } from '../store/words';
import { useProgressStore } from '../store/progress';
import { useGlobalKeys } from '../hooks/useGlobalKeys';
import { todayKey } from '../lib/dates';
import type { Word } from '../types';

type Mode = 'due' | 'wrong';

export default function ReviewPage() {
  const words = useWordsStore((s) => s.words);
  const records = useProgressStore((s) => s.records);
  const reviewAnswer = useProgressStore((s) => s.reviewAnswer);

  const [mode, setMode] = useState<Mode>('due');
  const [session, setSession] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);

  const due = useMemo(() => {
    const t = todayKey();
    return words
      .filter((w) => {
        const rec = records[w.word];
        return !!rec?.learnedAt && !!rec.review && rec.review.nextReview <= t;
      })
      .sort(
        (a, b) =>
          (records[a.word]?.review?.nextReview ?? '').localeCompare(
            records[b.word]?.review?.nextReview ?? '',
          ) || a.id - b.id,
      );
  }, [words, records]);

  const wrongList = useMemo(
    () => words.filter((w) => (records[w.word]?.wrongCount ?? 0) > 0),
    [words, records],
  );

  const word = session[index];

  const start = (m: Mode) => {
    setMode(m);
    setSession(m === 'due' ? due : wrongList);
    setIndex(0);
    setFinished(false);
    setFlipped(false);
  };

  const answer = (quality: number) => {
    if (!word) return;
    reviewAnswer(word, quality);
    if (index < session.length - 1) {
      setIndex((i) => i + 1);
      setFlipped(false);
    } else {
      setFinished(true);
    }
  };

  useGlobalKeys(
    (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === '1') answer(0);
      else if (e.key === '2') answer(5);
    },
    [word, index, session.length, flipped],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => start('due')}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              mode === 'due'
                ? 'bg-emerald-500 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            今日复习（{due.length}）
          </button>
          <button
            type="button"
            onClick={() => start('wrong')}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              mode === 'wrong'
                ? 'bg-rose-500 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            错词本（{wrongList.length}）
          </button>
        </div>
        {session.length > 0 && !finished && (
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
            第 {index + 1} / {session.length}
          </div>
        )}
      </div>

      {finished ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-12 text-center dark:border-emerald-900 dark:bg-emerald-900/20">
          <div className="text-5xl">✅</div>
          <h2 className="mt-3 text-xl font-bold">本次复习完成</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            共复习 {session.length} 个单词，SM-2 间隔将自动安排下次复习
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => start(mode)}
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-600"
            >
              再来一轮
            </button>
          </div>
        </div>
      ) : word ? (
        <>
          <WordCard word={word} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => answer(0)}
              className="rounded-xl bg-rose-500 px-6 py-3 text-sm font-bold text-white shadow hover:bg-rose-600"
            >
              ✗ 忘了 (1)
            </button>
            <button
              type="button"
              onClick={() => answer(5)}
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow hover:bg-emerald-600"
            >
              ✓ 记得 (2)
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-3xl border border-dashed p-12 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <div className="text-4xl">🌱</div>
          <p className="mt-2 font-semibold">
            {mode === 'due' ? '今天没有到期的复习单词，先去学习新词吧！' : '错词本是空的'}
          </p>
          {mode === 'due' && due.length === 0 && wrongList.length > 0 && (
            <button
              type="button"
              onClick={() => start('wrong')}
              className="mt-3 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
            >
              去复习错词本（{wrongList.length}）
            </button>
          )}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
        快捷键：空格 = 翻面 · 1 = 忘了 · 2 = 记得
      </p>
    </div>
  );
}
