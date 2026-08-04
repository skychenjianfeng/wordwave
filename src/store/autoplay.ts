import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExampleData, Word } from '../types';

export type AutoplayOrder = 'freq' | 'random' | 'unknown' | 'wrong' | 'category' | 'range';

export interface AutoplayConfig {
  order: AutoplayOrder;
  category: string;
  rangeMin: number;
  rangeMax: number;
  count: number;
  repeats: number;
  interval: number; // 秒
}

export type AutoplayStatus = 'idle' | 'playing' | 'paused' | 'finished';

interface AutoplayState {
  config: AutoplayConfig;
  status: AutoplayStatus;
  queue: Word[];
  index: number;
  repeatIndex: number;
  total: number;
  done: number;
  currentWord: Word | null;
  exampleData: ExampleData | null;
  exampleLoading: boolean;
  exampleFromCache: boolean;
  exampleError: string | null;
  setConfig: (patch: Partial<AutoplayConfig>) => void;
}

export const useAutoplayStore = create<AutoplayState>()(
  persist(
    (set) => ({
      config: {
        order: 'freq',
        category: '',
        rangeMin: 1,
        rangeMax: 5530,
        count: 20,
        repeats: 1,
        interval: 2,
      },
      status: 'idle',
      queue: [],
      index: 0,
      repeatIndex: 0,
      total: 0,
      done: 0,
      currentWord: null,
      exampleData: null,
      exampleLoading: false,
      exampleFromCache: false,
      exampleError: null,
      setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
    }),
    {
      name: 'wordwave-autoplay-v1',
      partialize: (s) => ({ config: s.config }),
    },
  ),
);
