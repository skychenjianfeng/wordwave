import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExampleData } from '../types';

const MAX_ENTRIES = 300;

interface ExampleCacheState {
  cache: Record<string, ExampleData>;
  order: string[];
  put: (key: string, data: ExampleData) => void;
  get: (key: string) => ExampleData | undefined;
  clear: () => void;
}

export const useExampleCacheStore = create<ExampleCacheState>()(
  persist(
    (set, get) => ({
      cache: {},
      order: [],
      put: (key, data) =>
        set((s) => {
          const cache = { ...s.cache, [key]: data };
          const order = s.order.filter((k) => k !== key);
          order.push(key);
          while (order.length > MAX_ENTRIES) {
            const oldest = order.shift();
            if (oldest) delete cache[oldest];
          }
          return { cache, order };
        }),
      get: (key) => get().cache[key],
      clear: () => set({ cache: {}, order: [] }),
    }),
    { name: 'wordwave-example-cache-v1' },
  ),
);
