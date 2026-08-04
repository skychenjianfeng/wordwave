import type { Word } from '../types';
import { syllableText } from '../lib/syllables';
import { speakSyllablesOnly, speakWordSmart, stopSpeech } from '../lib/speech';
import { useSettingsStore } from '../store/settings';
import PhoneticText from './PhoneticText';

interface WordCardProps {
  word: Word;
  flipped: boolean;
  onFlip: () => void;
}

export default function WordCard({ word, flipped, onFlip }: WordCardProps) {
  const rate = useSettingsStore((s) => s.rate);
  const withSyllables = useSettingsStore((s) => s.switches.syllables);

  const playFull = (e: React.MouseEvent) => {
    e.stopPropagation();
    stopSpeech();
    void speakWordSmart(word, rate, withSyllables);
  };
  const playSyllables = (e: React.MouseEvent) => {
    e.stopPropagation();
    stopSpeech();
    void speakSyllablesOnly(word, rate);
  };

  return (
    <div className="perspective mx-auto w-full max-w-xl cursor-pointer select-none" onClick={onFlip}>
      <div
        className={`card-flip preserve-3d relative min-h-[340px] w-full ${
          flipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* 正面：单词 + 音节 */}
        <div className="backface-hidden absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap justify-center gap-2 text-[11px] font-semibold">
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
              No.{word.id}
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
              词频 {word.freq}
            </span>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300">
              {word.category}
            </span>
          </div>
          <div className="text-5xl font-extrabold tracking-wide">{word.word}</div>
          <PhoneticText
            word={word.word}
            className="text-lg font-medium text-slate-500 dark:text-slate-400"
          />
          <div className="text-xl font-medium tracking-wider text-emerald-600 dark:text-emerald-400">
            {syllableText(word.word)}
          </div>
          {word.alt && (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              其他拼写：{word.alt}
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={playFull}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-600"
            >
              🔊 播放
            </button>
            <button
              type="button"
              onClick={playSyllables}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              🎵 逐音节
            </button>
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500">点击卡片翻面查看释义</div>
        </div>

        {/* 背面：释义 */}
        <div className="backface-hidden rotate-y-180 absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-xl dark:border-emerald-900 dark:bg-slate-800">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">
            释义
          </div>
          <div className="max-h-40 overflow-y-auto text-2xl font-semibold leading-relaxed">
            {word.meaning}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {word.category}
            {word.subcategory ? ` · ${word.subcategory}` : ''}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500">点击卡片返回正面</div>
        </div>
      </div>
    </div>
  );
}
