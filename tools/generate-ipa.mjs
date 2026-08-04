// 从网页端 ipa-en-us.json 生成移动端词表音标子集 assets/data/ipa.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ipaSrc = path.join(root, 'public', 'data', 'ipa-en-us.json');
const dictSrc = path.join(root, 'mobile', 'assets', 'data', 'dicts', 'kaoyan.json');
const outFile = path.join(root, 'mobile', 'assets', 'data', 'ipa.json');

const ipaAll = JSON.parse(fs.readFileSync(ipaSrc, 'utf8'));
const words = JSON.parse(fs.readFileSync(dictSrc, 'utf8'));

const out = {};
let hit = 0;
let miss = 0;
for (const w of words) {
  const word = String(w.word ?? '').trim();
  const candidates = [word, word.toLowerCase(), w.alt];
  let found = null;
  for (const c of candidates) {
    if (!c) continue;
    if (Object.prototype.hasOwnProperty.call(ipaAll, c)) {
      found = ipaAll[c];
      break;
    }
  }
  if (found) {
    out[word] = found;
    hit++;
  } else {
    miss++;
  }
}

fs.writeFileSync(outFile, JSON.stringify(out), 'utf8');
console.log(`total=${words.length} hit=${hit} miss=${miss} size=${fs.statSync(outFile).size}`);
