import { useExampleCacheStore } from '../store/exampleCache';
import type { ExampleData, ExampleStyle } from '../types';

export function exampleCacheKey(
  word: string,
  withTranslation: boolean,
  style: ExampleStyle,
): string {
  return `${word}::${withTranslation ? 'zh' : 'en'}::${style}`;
}

export async function fetchExampleFromApi(
  word: string,
  meaning: string,
  withTranslation: boolean,
  style: ExampleStyle,
): Promise<ExampleData> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch('/api/example', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, meaning, withTranslation, style }),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      data?: ExampleData;
    } | null;
    if (!res.ok || !json?.ok || !json.data) {
      throw new Error(json?.error || `请求失败（HTTP ${res.status}）`);
    }
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

export async function getExample(
  word: string,
  meaning: string,
  withTranslation: boolean,
  style: ExampleStyle,
  force: boolean,
): Promise<{ data: ExampleData; fromCache: boolean }> {
  const cacheStore = useExampleCacheStore.getState();
  const key = exampleCacheKey(word, withTranslation, style);
  if (!force) {
    const hit = cacheStore.get(key);
    if (hit) return { data: hit, fromCache: true };
  }
  const data = await fetchExampleFromApi(word, meaning, withTranslation, style);
  cacheStore.put(key, data);
  return { data, fromCache: false };
}
