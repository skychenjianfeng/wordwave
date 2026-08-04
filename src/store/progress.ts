import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Word, WordNotes, WordProgress } from '../types';
import { applyReview, createReview } from '../lib/sm2';
import { todayKey } from '../lib/dates';

function baseProgress(): WordProgress {
  return {
    status: 'new',
    known: 0,
    unknown: 0,
    learnedAt: null,
    lastSeen: null,
    wrongCount: 0,
    lastWrongAt: null,
    review: null,
    notes: { wordNote: '', syllableNotes: [] },
  };
}

function addActivity(daily: Record<string, string[]>, wordKey: string): Record<string, string[]> {
  const key = todayKey();
  const list = daily[key] ?? [];
  if (list.includes(wordKey)) return daily;
  return { ...daily, [key]: [...list, wordKey] };
}

interface ProgressState {
  records: Record<string, WordProgress>;
  dailyWords: Record<string, string[]>;
  markKnown: (word: Word) => void;
  markUnknown: (word: Word) => void;
  markSeen: (word: Word) => void;
  reviewAnswer: (word: Word, quality: number) => void;
  setWordNote: (wordKey: string, note: string) => void;
  setSyllableNote: (wordKey: string, index: number, note: string) => void;
  exportJson: () => string;
  importJson: (text: string) => boolean;
  resetProgress: () => void;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      records: {},
      dailyWords: {},

      markKnown: (word) =>
        set((s) => {
          const prev = s.records[word.word] ?? baseProgress();
          const known = prev.known + 1;
          const status =
            prev.unknown === 0 && known >= 3
              ? 'mastered'
              : prev.status === 'new'
                ? 'learning'
                : prev.status;
          const now = new Date().toISOString();
          const rec: WordProgress = {
            ...prev,
            known,
            status,
            learnedAt: prev.learnedAt ?? now,
            lastSeen: now,
          };
          return {
            records: { ...s.records, [word.word]: rec },
            dailyWords: addActivity(s.dailyWords, word.word),
          };
        }),

      markUnknown: (word) =>
        set((s) => {
          const prev = s.records[word.word] ?? baseProgress();
          const now = new Date().toISOString();
          const rec: WordProgress = {
            ...prev,
            unknown: prev.unknown + 1,
            status: 'learning',
            learnedAt: prev.learnedAt ?? now,
            lastSeen: now,
            wrongCount: prev.wrongCount + 1,
            lastWrongAt: now,
            review: applyReview(prev.review ?? createReview(), 0),
          };
          return {
            records: { ...s.records, [word.word]: rec },
            dailyWords: addActivity(s.dailyWords, word.word),
          };
        }),

      markSeen: (word) =>
        set((s) => {
          const prev = s.records[word.word] ?? baseProgress();
          const now = new Date().toISOString();
          const rec: WordProgress = {
            ...prev,
            status: prev.status === 'new' ? 'learning' : prev.status,
            learnedAt: prev.learnedAt ?? now,
            lastSeen: now,
          };
          return {
            records: { ...s.records, [word.word]: rec },
            dailyWords: addActivity(s.dailyWords, word.word),
          };
        }),

      reviewAnswer: (word, quality) =>
        set((s) => {
          const prev = s.records[word.word] ?? baseProgress();
          const review = applyReview(prev.review ?? createReview(), quality);
          const now = new Date().toISOString();
          let status: WordProgress['status'] = prev.status === 'new' ? 'learning' : prev.status;
          let wrongCount = prev.wrongCount;
          let lastWrongAt = prev.lastWrongAt;
          if (quality >= 3) {
            if (review.reps >= 2) status = 'mastered';
          } else {
            status = 'learning';
            wrongCount += 1;
            lastWrongAt = now;
          }
          const rec: WordProgress = {
            ...prev,
            status,
            review,
            learnedAt: prev.learnedAt ?? now,
            lastSeen: now,
            wrongCount,
            lastWrongAt,
          };
          return {
            records: { ...s.records, [word.word]: rec },
            dailyWords: addActivity(s.dailyWords, word.word),
          };
        }),

      setWordNote: (wordKey, note) =>
        set((s) => {
          const prev = s.records[wordKey] ?? baseProgress();
          const notes: WordNotes = { ...prev.notes, wordNote: note };
          return { records: { ...s.records, [wordKey]: { ...prev, notes } } };
        }),

      setSyllableNote: (wordKey, index, note) =>
        set((s) => {
          const prev = s.records[wordKey] ?? baseProgress();
          const arr = [...prev.notes.syllableNotes];
          while (arr.length <= index) arr.push('');
          arr[index] = note;
          const notes: WordNotes = { ...prev.notes, syllableNotes: arr };
          return { records: { ...s.records, [wordKey]: { ...prev, notes } } };
        }),

      exportJson: () =>
        JSON.stringify(
          {
            app: 'wordwave',
            version: 1,
            exportedAt: new Date().toISOString(),
            records: get().records,
            dailyWords: get().dailyWords,
          },
          null,
          2,
        ),

      importJson: (text) => {
        try {
          const data = JSON.parse(text) as { records?: unknown; dailyWords?: unknown };
          if (!data || typeof data !== 'object' || !data.records || typeof data.records !== 'object') {
            return false;
          }
          set({
            records: data.records as Record<string, WordProgress>,
            dailyWords:
              data.dailyWords && typeof data.dailyWords === 'object'
                ? (data.dailyWords as Record<string, string[]>)
                : {},
          });
          return true;
        } catch {
          return false;
        }
      },

      resetProgress: () => set({ records: {}, dailyWords: {} }),
    }),
    { name: 'wordwave-progress-v1' },
  ),
);
