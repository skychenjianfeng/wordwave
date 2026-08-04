let mapPromise: Promise<Map<string, string>> | null = null;

export function getIpaMap(): Promise<Map<string, string>> {
  if (!mapPromise) {
    mapPromise = fetch('/data/ipa-en-us.json')
      .then((r) => (r.ok ? r.json() : Promise.resolve({})))
      .then((obj: unknown) => {
        const map = new Map<string, string>();
        if (obj && typeof obj === 'object') {
          for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            if (typeof v === 'string') map.set(k.toLowerCase(), v);
          }
        }
        return map;
      })
      .catch(() => new Map<string, string>());
  }
  return mapPromise;
}

/** 查询单词的 IPA 音标；多词短语按单词拆分查询后用 · 连接 */
export async function getIpa(word: string): Promise<string | null> {
  const map = await getIpaMap();
  const clean = word.trim().toLowerCase();
  if (!clean) return null;
  const direct = map.get(clean);
  if (direct) return direct;
  const tokens = clean.split(/[^a-z']+/).filter(Boolean);
  if (tokens.length > 1) {
    const parts = tokens.map((t) => map.get(t)).filter((x): x is string => !!x);
    if (parts.length === tokens.length) return parts.join(' · ');
  }
  return null;
}
