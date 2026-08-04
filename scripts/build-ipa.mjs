// 从 ipa-dict 包提取 en_US IPA 词表，输出扁平 JSON。
// 用法：node scripts/build-ipa.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const OUT = path.join(ROOT, 'public', 'data', 'ipa-en-us.json');

const mod = require(path.join(ROOT, 'node_modules', 'ipa-dict', 'lib', 'en_US.js'));
const usMap = mod instanceof Map ? mod : mod?.default instanceof Map ? mod.default : null;
const ukMod = require(path.join(ROOT, 'node_modules', 'ipa-dict', 'lib', 'en_UK.js'));
const ukMap =
  ukMod instanceof Map ? ukMod : ukMod?.default instanceof Map ? ukMod.default : null;
if (!usMap || !ukMap) {
  console.error('extract failed: ipa-dict default export is not a Map');
  process.exit(1);
}

const flat = {};
const norm = (s) => String(s).trim().replace(/^\/|\/$/g, '').trim();
for (const map of [usMap, ukMap]) {
  for (const [word, list] of map) {
    if (flat[word]) continue; // 优先美式
    const arr = Array.isArray(list)
      ? [...new Set(list.map(norm).filter(Boolean))]
      : [];
    if (arr.length) flat[word] = arr.map((x) => `/${x}/`).join(' · ');
  }
}

fs.writeFileSync(OUT, JSON.stringify(flat));
console.log(`written ${OUT}`);
console.log(`entries: ${Object.keys(flat).length}`);
console.log('sample important:', flat['important']);
console.log('sample organise(UK):', flat['organise']);

// 覆盖统计
const wordsRaw = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'public', 'data', 'words.json'), 'utf8'),
);
const words = Object.values(wordsRaw)[0];
const lower = new Set(Object.keys(flat).map((k) => k.toLowerCase()));
let hit = 0;
const miss = [];
for (const w of words) {
  const word = String(w['单词'] || '').toLowerCase();
  if (lower.has(word)) hit++;
  else if (miss.length < 20) miss.push(word);
}
console.log(`coverage: ${hit}/${words.length} = ${((hit / words.length) * 100).toFixed(1)}%`);
if (miss.length) console.log(`miss sample: ${miss.join(', ')}`);
