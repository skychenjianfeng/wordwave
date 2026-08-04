import hyphenator from 'hyphen/en-us/index.js';

const DOT = '\u00B7';
const tokenCache = new Map<string, string[]>();
const wordCache = new Map<string, string[]>();

function splitToken(token: string): string[] {
  const key = token.toLowerCase();
  const hit = tokenCache.get(key);
  if (hit) return hit;
  let chunks = [token];
  try {
    const out = hyphenator.hyphenateSync(token, { hyphenChar: DOT });
    const parts = out
      .split(DOT)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 1) chunks = parts;
  } catch {
    // 保持原词
  }
  tokenCache.set(key, chunks);
  return chunks;
}

/** 把单词切成音节数组，例如 important -> ['im', 'por', 'tant'] */
export function splitSyllables(word: string): string[] {
  const key = word.toLowerCase();
  const hit = wordCache.get(key);
  if (hit) return hit;
  const tokens = word.split(/[^a-zA-Z']+/).filter(Boolean);
  const parts = tokens.flatMap((t) => splitToken(t));
  if (parts.length === 0) parts.push(word);
  wordCache.set(key, parts);
  return parts;
}

/** 带中点分隔的展示文本，例如 important -> im·por·tant */
export function syllableText(word: string): string {
  const tokens = word.split(/[^a-zA-Z']+/).filter(Boolean);
  if (tokens.length === 0) return word;
  return tokens.map((t) => splitToken(t).join(DOT)).join(' ');
}
