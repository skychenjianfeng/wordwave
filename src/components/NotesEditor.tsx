import { useMemo } from 'react';
import type { Word } from '../types';
import { splitSyllables } from '../lib/syllables';
import { useProgressStore } from '../store/progress';

export default function NotesEditor({ word }: { word: Word }) {
  const notes = useProgressStore((s) => s.records[word.word]?.notes);
  const setWordNote = useProgressStore((s) => s.setWordNote);
  const setSyllableNote = useProgressStore((s) => s.setSyllableNote);
  const syllables = useMemo(() => splitSyllables(word.word), [word.word]);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="text-sm font-bold">词根 / 音节笔记</h3>
      <div className="flex flex-wrap gap-2">
        {syllables.map((syl, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-600 dark:bg-slate-700/50"
          >
            <div className="text-center font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {syl}
            </div>
            <input
              value={notes?.syllableNotes[i] ?? ''}
              onChange={(e) => setSyllableNote(word.word, i, e.target.value)}
              placeholder="联想/词根备注"
              className="mt-1 w-28 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-800"
            />
          </div>
        ))}
      </div>
      <textarea
        value={notes?.wordNote ?? ''}
        onChange={(e) => setWordNote(word.word, e.target.value)}
        placeholder="整词笔记：联想记忆、词根词缀分析……"
        rows={3}
        className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-800"
      />
    </div>
  );
}
