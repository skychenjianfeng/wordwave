// 为移动端生成全词库音节映射：{ word: "im·por·tant", ... }
// 运行：node scripts/generate-mobile-syllables.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import hyphenator from 'hyphen/en-us/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DICTS_DIR = path.join(ROOT, 'public', 'data', 'dicts');
const OUT = path.join(ROOT, 'mobile', 'assets', 'data', 'syllables.json');
const DOT = '\u00B7';

const cache = new Map();
function splitWord(word) {
  const key = word.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const out = hyphenator.hyphenateSync(word, { hyphenChar: DOT });
    const parts = out.split(DOT).map((s) => s.trim()).filter(Boolean);
    cache.set(key, parts.length > 1 ? parts.join(DOT) : word);
  } catch {
    cache.set(key, word);
  }
  return cache.get(key);
}

const files = fs.readdirSync(DICTS_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json');
const map = {};
let count = 0;
for (const file of files) {
  const words = JSON.parse(fs.readFileSync(path.join(DICTS_DIR, file), 'utf8'));
  for (const w of words) {
    const word = String(w.word ?? '').trim();
    if (!word) continue;
    const key = word.toLowerCase();
    if (map[key]) continue;
    map[key] = splitWord(word);
    count++;
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(map));
console.log(`mobile syllables: ${count} words, ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)} MB`);
