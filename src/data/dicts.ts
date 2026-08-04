import type { DictMeta, Word } from '../types';

let indexCache: DictMeta[] | null = null;
const wordsCache = new Map<string, Word[]>();
const pending = new Map<string, Promise<Word[]>>();

export async function loadDictIndex(): Promise<DictMeta[]> {
  if (indexCache) return indexCache;
  const res = await fetch('/data/dicts/index.json');
  if (!res.ok) throw new Error(`词库索引加载失败：HTTP ${res.status}`);
  const data = (await res.json()) as DictMeta[];
  indexCache = data;
  return data;
}

export async function loadDictWords(dictId: string): Promise<Word[]> {
  const hit = wordsCache.get(dictId);
  if (hit) return hit;
  const running = pending.get(dictId);
  if (running) return running;
  const p = (async () => {
    const res = await fetch(`/data/dicts/${encodeURIComponent(dictId)}.json`);
    if (!res.ok) throw new Error(`词库 ${dictId} 加载失败：HTTP ${res.status}`);
    const list = (await res.json()) as Word[];
    wordsCache.set(dictId, list);
    return list;
  })();
  pending.set(dictId, p);
  try {
    return await p;
  } finally {
    pending.delete(dictId);
  }
}

export function getDictWordsCache(dictId: string): Word[] | null {
  return wordsCache.get(dictId) ?? null;
}
