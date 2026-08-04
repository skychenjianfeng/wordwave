import { useEffect, useState } from 'react';
import type { Word } from '../types';
import { useWordsStore } from '../store/words';
import { useProgressStore } from '../store/progress';
import { useSettingsStore } from '../store/settings';
import { useGlobalKeys } from '../hooks/useGlobalKeys';
import { speak, stopSpeech } from '../lib/speech';
import { todayKey } from '../lib/dates';

type QuizKind = 'mixed' | 'meaning' | 'listen' | 'spelling';
type QuizSource = 'all' | 'learned' | 'wrong' | 'due';

interface QuizOption {
  text: string;
  correct: boolean;
}

interface Question {
  kind: 'meaning' | 'listen' | 'spelling';
  word: Word;
  options: QuizOption[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

const KIND_LABELS: Record<QuizKind, string> = {
  mixed: '混合题型',
  meaning: '看英文选释义',
  listen: '听音辨词',
  spelling: '拼写默写',
};

const SOURCE_LABELS: Record<QuizSource, string> = {
  all: '全部单词',
  learned: '已学单词',
  wrong: '错词',
  due: '今日到期',
};

export default function QuizPage() {
  const words = useWordsStore((s) => s.words);
  const records = useProgressStore((s) => s.records);
  const markKnown = useProgressStore((s) => s.markKnown);
  const markUnknown = useProgressStore((s) => s.markUnknown);
  const rate = useSettingsStore((s) => s.rate);

  const [phase, setPhase] = useState<'config' | 'quiz' | 'result'>('config');
  const [kind, setKind] = useState<QuizKind>('mixed');
  const [source, setSource] = useState<QuizSource>('all');
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qi, setQi] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [wrongList, setWrongList] = useState<Word[]>([]);

  const q = questions[qi];

  useEffect(() => {
    if (phase !== 'quiz' || !q) return;
    stopSpeech();
    void speak(q.word.word, 'en', rate, { wordId: q.word.id, wordText: q.word.word, kind: 'word' });
  }, [phase, qi, q?.word.word, rate]);

  useGlobalKeys(
    (e) => {
      if (phase === 'quiz' && !answered && q && q.kind !== 'spelling') {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= q.options.length) {
          setSelected(n - 1);
        }
      }
    },
    [phase, answered, q, selected],
  );

  const start = () => {
    let pool = words;
    if (source === 'learned') pool = words.filter((w) => records[w.word]?.learnedAt);
    if (source === 'wrong')
      pool = words.filter((w) => (records[w.word]?.wrongCount ?? 0) > 0);
    if (source === 'due') {
      const t = todayKey();
      pool = words.filter((w) => {
        const r = records[w.word]?.review;
        return !!r && r.nextReview <= t;
      });
    }
    const chosen = sample(pool, count);
    const qs: Question[] = chosen.map((w, i) => {
      const k: Question['kind'] =
        kind === 'mixed' ? (['meaning', 'listen', 'spelling'] as const)[i % 3] : kind;
      if (k === 'spelling') return { kind: k, word: w, options: [] };
      const others = sample(
        pool.filter((x) => x.word !== w.word),
        3,
      ).map((x) => ({ text: k === 'meaning' ? x.meaning : x.word, correct: false }));
      const correctOpt = { text: k === 'meaning' ? w.meaning : w.word, correct: true };
      return { kind: k, word: w, options: shuffle([correctOpt, ...others]) };
    });
    setQuestions(qs);
    setQi(0);
    setScore(0);
    setWrongList([]);
    setSelected(null);
    setTyped('');
    setAnswered(false);
    setPhase('quiz');
  };

  const submit = () => {
    if (!q || answered) return;
    let correctNow = false;
    if (q.kind === 'spelling') {
      const input = normalize(typed);
      correctNow =
        input === normalize(q.word.word) ||
        (!!q.word.alt && input === normalize(q.word.alt));
      if (!typed.trim()) return;
    } else if (selected !== null) {
      correctNow = q.options[selected]?.correct === true;
    } else {
      return;
    }
    setAnswered(true);
    setIsCorrect(correctNow);
    if (correctNow) {
      setScore((s) => s + 1);
      markKnown(q.word);
    } else {
      setWrongList((l) => [...l, q.word]);
      markUnknown(q.word);
    }
  };

  const next = () => {
    if (qi + 1 >= questions.length) {
      setPhase('result');
    } else {
      setQi((i) => i + 1);
      setSelected(null);
      setTyped('');
      setAnswered(false);
    }
  };

  if (phase === 'config') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h2 className="mb-1 text-xl font-bold">测验模式</h2>
        <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
          看英文选释义 / 听音辨词 / 拼写默写，即时判分，答错自动进错词本
        </p>
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold">题型</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(KIND_LABELS) as QuizKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                    kind === k
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold">题目来源</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SOURCE_LABELS) as QuizSource[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSource(s)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                    source === s
                      ? 'bg-sky-500 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {SOURCE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold">题目数量</label>
            <div className="flex gap-2">
              {[10, 20, 30].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                    count === n
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {n} 题
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={start}
            disabled={words.length === 0}
            className="w-full rounded-2xl bg-emerald-500 py-3.5 font-bold text-white shadow-lg hover:bg-emerald-600 disabled:opacity-40"
          >
            🚀 开始测验
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'result') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <div className="text-5xl">{score === questions.length ? '🏆' : '📊'}</div>
          <h2 className="mt-3 text-2xl font-bold">
            {score} / {questions.length}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            正确率 {questions.length ? Math.round((score / questions.length) * 100) : 0}%
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={start}
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-600"
            >
              再测一次
            </button>
            <button
              type="button"
              onClick={() => setPhase('config')}
              className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              返回设置
            </button>
          </div>
        </div>

        {wrongList.length > 0 && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-white p-4 dark:border-rose-900 dark:bg-slate-800">
            <h3 className="mb-2 text-sm font-bold text-rose-500">错词（已加入错词本）</h3>
            <ul className="space-y-1 text-sm">
              {wrongList.map((w) => (
                <li key={w.word} className="flex items-center gap-2">
                  <span className="font-bold">{w.word}</span>
                  <span className="truncate text-slate-500 dark:text-slate-400">{w.meaning}</span>
                  <button
                    type="button"
                  onClick={() => {
                    stopSpeech();
                    void speak(w.word, 'en', rate, { wordId: w.id, wordText: w.word, kind: 'word' });
                  }}
                    className="ml-auto shrink-0 text-xs text-sky-500 underline"
                  >
                    播放
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (!q) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="font-semibold">
          第 {qi + 1} / {questions.length} 题
        </span>
        <span className="text-emerald-600 dark:text-emerald-400">得分 {score}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${((qi + (answered ? 1 : 0)) / questions.length) * 100}%` }}
        />
      </div>

      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">
          {q.kind === 'meaning' && '看英文选释义'}
          {q.kind === 'listen' && '听音辨词'}
          {q.kind === 'spelling' && '拼写默写'}
        </div>

        {q.kind !== 'spelling' && (
          <div className="text-center">
            <div className="text-3xl font-extrabold">{q.word.word}</div>
            <button
              type="button"
              onClick={() => {
                stopSpeech();
                void speak(q.word.word, 'en', rate, { wordId: q.word.id, wordText: q.word.word, kind: 'word' });
              }}
              className="mt-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              🔊 再听一遍
            </button>
          </div>
        )}

        {q.kind === 'spelling' && (
          <div className="text-center">
            <div className="text-xl font-semibold text-slate-600 dark:text-slate-300">
              {q.word.meaning}
            </div>
            <button
              type="button"
              onClick={() => {
                stopSpeech();
                void speak(q.word.word, 'en', rate, { wordId: q.word.id, wordText: q.word.word, kind: 'word' });
              }}
              className="mt-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              🔊 播放发音
            </button>
          </div>
        )}

        <div className="mt-5">
          {q.kind === 'spelling' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="flex gap-2"
            >
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="输入英文拼写…"
                disabled={answered}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-lg outline-none focus:border-emerald-400 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800"
              />
              <button
                type="submit"
                disabled={answered}
                className="rounded-xl bg-emerald-500 px-5 py-2.5 font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                提交
              </button>
            </form>
          ) : (
            <div className="grid gap-2">
              {q.options.map((opt, i) => {
                let cls =
                  'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-emerald-900/20';
                if (answered) {
                  if (opt.correct)
                    cls =
                      'border-emerald-400 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/30';
                  else if (selected === i)
                    cls = 'border-rose-400 bg-rose-50 dark:border-rose-500 dark:bg-rose-900/30';
                  else cls = 'border-slate-200 opacity-50 dark:border-slate-600';
                } else if (selected === i) {
                  cls = 'border-sky-400 bg-sky-50 dark:border-sky-500 dark:bg-sky-900/30';
                }
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={answered}
                    onClick={() => setSelected(i)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${cls}`}
                  >
                    <span className="mr-2 font-mono text-xs text-slate-400">{i + 1}</span>
                    {opt.text}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!answered && q.kind !== 'spelling' && (
          <button
            type="button"
            onClick={submit}
            disabled={selected === null}
            className="mt-4 w-full rounded-xl bg-emerald-500 py-2.5 font-bold text-white hover:bg-emerald-600 disabled:opacity-40"
          >
            确认答案
          </button>
        )}

        {answered && (
          <div
            className={`mt-4 rounded-xl p-3 text-sm font-medium ${
              isCorrect
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
            }`}
          >
            {isCorrect
              ? '✓ 回答正确！'
              : `✗ 正确答案：${q.kind === 'spelling' ? q.word.word : q.word.meaning}`}
          </div>
        )}

        {answered && (
          <button
            type="button"
            onClick={next}
            className="mt-3 w-full rounded-xl bg-sky-500 py-2.5 font-bold text-white hover:bg-sky-600"
          >
            {qi + 1 >= questions.length ? '查看成绩' : '下一题 →'}
          </button>
        )}
      </div>
    </div>
  );
}
