import { create } from 'zustand';
import { loadDictIndex, loadDictWords } from '../data/dicts';
import type { DictMeta, Word } from '../types';

const STORAGE_KEY = 'wordwave-active-dict-v1';

function readActiveDict(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? 'kaoyan';
  } catch {
    return 'kaoyan';
  }
}

interface WordsState {
  dicts: DictMeta[];
  activeDictId: string;
  words: Word[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  loadDicts: () => Promise<void>;
  setActiveDict: (id: string) => Promise<void>;
}

export const useWordsStore = create<WordsState>((set, get) => ({
  dicts: [],
  activeDictId: readActiveDict(),
  words: [],
  loading: false,
  error: null,
  load: async () => {
    set({ loading: true, error: null });
    try {
      const dicts = await loadDictIndex();
      let active = readActiveDict();
      if (!dicts.some((d) => d.id === active)) active = dicts[0]?.id ?? 'kaoyan';
      const words = await loadDictWords(active);
      set({ dicts, activeDictId: active, words, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
  loadDicts: async () => {
    const dicts = await loadDictIndex();
    set({ dicts });
  },
  setActiveDict: async (id) => {
    const { dicts } = get();
    if (dicts.length === 0) await get().loadDicts();
    set({ loading: true, error: null });
    try {
      const words = await loadDictWords(id);
      localStorage.setItem(STORAGE_KEY, id);
      set({ activeDictId: id, words, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  },
}));
