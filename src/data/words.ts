import type { Word } from '../types';

interface RawWord {
  '序号': number;
  '词频': number;
  '单词': string;
  '释义': string;
  '其他拼写': string | null;
  '分类': string;
  '子分类': string | null;
}

let cache: Word[] | null = null;
let promise: Promise<Word[]> | null = null;

async function doLoad(): Promise<Word[]> {
  const res = await fetch('/data/words.json');
  if (!res.ok) throw new Error(`词库加载失败：HTTP ${res.status}`);
  const raw = (await res.json()) as Record<string, unknown>;
  const key = Object.keys(raw).find((k) => Array.isArray(raw[k])) ?? '';
  const list = (key ? raw[key] : raw) as RawWord[];
  return list.map((r, i) => ({
    id: Number(r['序号'] ?? i + 1),
    freq: Number(r['词频'] ?? 0),
    word: String(r['单词'] ?? ''),
    meaning: String(r['释义'] ?? ''),
    alt: r['其他拼写'] == null ? null : String(r['其他拼写']),
    category: String(r['分类'] ?? '未分类'),
    subcategory: r['子分类'] == null ? null : String(r['子分类']),
  }));
}

export function loadWords(): Promise<Word[]> {
  if (cache) return Promise.resolve(cache);
  if (!promise) {
    promise = doLoad().then((words) => {
      cache = words;
      return words;
    });
  }
  return promise;
}
