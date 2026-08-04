// 词库下载与转换脚本
// - 从 GitHub 开源词库下载考试词汇 / 专业词汇 / 国家地理数据
// - 与内置专有名词词条合并，统一转换为 public/data/dicts/<id>.json
// - 生成 public/data/dicts/index.json（前端词库元数据）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { NAMES, GEOGRAPHY, GEOLOGY } from './dict-extra-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'tools', 'dict-src');
const OUT_DIR = path.join(ROOT, 'public', 'data', 'dicts');
fs.mkdirSync(SRC_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const KB = 'https://raw.githubusercontent.com/KyleBing/english-vocabulary/master';
const TW = 'https://raw.githubusercontent.com/ranbeioc/typing-word/master';
const DR = 'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master';

const SOURCES = [
  ['chuzhong', '1-初中-顺序.json', `${KB}/json/1-%E5%88%9D%E4%B8%AD-%E9%A1%BA%E5%BA%8F.json`],
  ['gaokao', '2-高中-顺序.json', `${KB}/json/2-%E9%AB%98%E4%B8%AD-%E9%A1%BA%E5%BA%8F.json`],
  ['cet4', '3-CET4-顺序.json', `${KB}/json/3-CET4-%E9%A1%BA%E5%BA%8F.json`],
  ['cet6', '4-CET6-顺序.json', `${KB}/json/4-CET6-%E9%A1%BA%E5%BA%8F.json`],
  ['toefl', '6-托福-顺序.json', `${KB}/json/6-%E6%89%98%E7%A6%8F-%E9%A1%BA%E5%BA%8F.json`],
  ['sat', '7-SAT-顺序.json', `${KB}/json/7-SAT-%E9%A1%BA%E5%BA%8F.json`],
  ['tem4', 'Level4_1.json', `${KB}/json_original/json-full/Level4_1.json`],
  ['tem4b', 'Level4_2.json', `${KB}/json_original/json-full/Level4_2.json`],
  ['tem8', 'Level8_1.json', `${KB}/json_original/json-full/Level8_1.json`],
  ['tem8b', 'Level8_2.json', `${KB}/json_original/json-full/Level8_2.json`],
  ['bec', 'BEC_2.json', `${KB}/json_original/json-full/BEC_2.json`],
  ['gre', 'GRE_2.json', `${KB}/json_original/json-full/GRE_2.json`],
  ['greb', 'GRE_3.json', `${KB}/json_original/json-full/GRE_3.json`],
  ['ielts', 'IELTS_2.json', `${KB}/json_original/json-full/IELTS_2.json`],
  ['ieltsb', 'IELTS_3.json', `${KB}/json_original/json-full/IELTS_3.json`],
  ['gmat', 'GMAT_2.json', `${KB}/json_original/json-full/GMAT_2.json`],
  ['gmatb', 'GMAT_3.json', `${KB}/json_original/json-full/GMAT_3.json`],
  ['it', 'it-words.json', `${TW}/public/dicts/code/word/zh-CN/it-words.json`],
  ['ai-ml', 'ai_machine_learning.json', `${TW}/public/dicts/code/word/zh-CN/ai_machine_learning.json`],
  ['ai-science', 'ai_for_science.json', `${TW}/public/dicts/code/word/zh-CN/ai_for_science.json`],
  ['linux', 'linux-command.json', `${TW}/public/dicts/code/word/zh-CN/linux-command.json`],
  ['sql', 'SQL_statement_lower-case.json', `${TW}/public/dicts/code/word/zh-CN/SQL_statement_lower-case.json`],
  ['python', 'python-builtin.json', `${TW}/public/dicts/code/word/zh-CN/python-builtin.json`],
  ['java', 'java-string.json', `${TW}/public/dicts/code/word/zh-CN/java-string.json`],
  ['javascript', 'js-array.json', `${TW}/public/dicts/code/word/zh-CN/js-array.json`],
  ['golang', 'go_builtin.json', `${TW}/public/dicts/code/word/zh-CN/go_builtin.json`],
  ['countries', 'countries.json', `${DR}/json/countries.json`],
];

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    console.log(`  [skip] ${path.basename(dest)}`);
    return;
  }
  const mirror = url.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.*)/);
  const candidates = [];
  if (mirror) {
    candidates.push(`https://cdn.jsdelivr.net/gh/${mirror[1]}/${mirror[2]}@${mirror[3]}/${mirror[4]}`);
  }
  candidates.push(url);
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const target = candidates[(attempt - 1) % candidates.length];
    try {
      const r = spawnSync(
        'curl.exe',
        ['-L', '-sS', '--retry', '2', '--retry-all-errors', '--retry-delay', '2', '-C', '-', '--max-time', '180', '-o', dest, target],
        { encoding: 'utf8', timeout: 200000 },
      );
      if (r.status !== 0) throw new Error(r.stderr?.trim() || `curl exit ${r.status}`);
      const size = fs.statSync(dest).size;
      console.log(`  [ok] ${path.basename(dest)} ${(size / 1024 / 1024).toFixed(2)} MB`);
      return;
    } catch (err) {
      console.log(`  [retry ${attempt}] ${target} -> ${err.message}`);
      if (attempt === 6) throw err;
      await new Promise((r) => setTimeout(r, 2500 * (attempt % 3 + 1)));
    }
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function meaningFromTranslations(translations) {
  if (!Array.isArray(translations) || translations.length === 0) return '';
  return translations
    .map((t) => (t.type ? `${t.type}. ${t.translation}` : t.translation))
    .filter(Boolean)
    .join('；');
}

function convertKbOrder(data, subcategory) {
  const seen = new Set();
  const out = [];
  for (let i = 0; i < data.length; i += 1) {
    const w = data[i];
    const word = String(w?.word ?? '').trim();
    if (!word || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    let meaning = meaningFromTranslations(w?.translations);
    if (Array.isArray(w?.phrases) && w.phrases.length > 0) {
      const ph = w.phrases
        .slice(0, 5)
        .map((p) => `${p.phrase}：${p.translation}`)
        .join('；');
      if (ph) meaning = meaning ? `${meaning}；短语：${ph}` : `短语：${ph}`;
    }
    out.push({
      id: out.length + 1,
      freq: i + 1,
      word,
      meaning,
      alt: null,
      category: '考试词库',
      subcategory,
      ipa: null,
    });
  }
  return out;
}

function convertKbFull(files, subcategory) {
  const seen = new Set();
  const out = [];
  for (const file of files) {
    const data = readJson(path.join(SRC_DIR, file));
    for (const item of data) {
      const word = String(item?.headWord ?? item?.word?.wordHead ?? '').trim();
      if (!word || seen.has(word.toLowerCase())) continue;
      seen.add(word.toLowerCase());
      const trans = item?.content?.word?.content?.trans || [];
      const meaning = trans
        .map((t) => (t.pos ? `${t.pos}. ${t.tranCn}` : t.tranCn))
        .filter(Boolean)
        .join('；');
      const ipa = item?.content?.word?.content?.usphone || item?.content?.word?.content?.ukphone || null;
      out.push({
        id: out.length + 1,
        freq: out.length + 1,
        word,
        meaning: meaning || '（暂无释义）',
        alt: null,
        category: '考试词库',
        subcategory,
        ipa,
      });
    }
  }
  return out;
}

function convertCodeDict(file, subcategory) {
  const data = readJson(path.join(SRC_DIR, file));
  const seen = new Set();
  const out = [];
  for (const item of data) {
    const word = String(item?.name ?? '').trim();
    if (!word || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    const trans = Array.isArray(item?.trans) ? item.trans : [];
    out.push({
      id: out.length + 1,
      freq: out.length + 1,
      word,
      meaning: trans.join('；') || '（暂无释义）',
      alt: null,
      category: '专业领域',
      subcategory,
      ipa: null,
    });
  }
  return out;
}

function convertCountries() {
  const data = readJson(path.join(SRC_DIR, 'countries.json'));
  const seen = new Set();
  const out = [];
  for (const c of data) {
    const word = String(c?.name ?? '').trim();
    if (!word || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    const zh = c?.translations?.['zh-CN'] || word;
    const region = c?.region ? `，${c.region}` : '';
    const sub = c?.subregion ? `·${c.subregion}` : '';
    const capital = c?.capital ? `首都 ${c.capital}` : '首都—';
    out.push({
      id: out.length + 1,
      freq: out.length + 1,
      word,
      meaning: `${zh}（${region}${sub}；${capital}）`,
      alt: null,
      category: '专有名词',
      subcategory: '国家/地区',
      ipa: null,
    });
  }
  return out;
}

function fromTuples(tuples, category, subcategory, suffix = '') {
  return tuples.map(([word, zh, sub], i) => ({
    id: i + 1,
    freq: i + 1,
    word,
    meaning: zh + (suffix ? `（${suffix}）` : ''),
    alt: null,
    category,
    subcategory: sub || subcategory,
    ipa: null,
  }));
}

function loadKaoyan() {
  const raw = readJson(path.join(ROOT, 'public', 'data', 'words.json'));
  const arr = raw['5530考研词汇词频排序表'] || [];
  return arr.map((w, i) => ({
    id: i + 1,
    freq: Number(w['词频']) || i + 1,
    word: String(w['单词']),
    meaning: String(w['释义'] ?? ''),
    alt: w['其他拼写'] ?? null,
    category: String(w['分类'] ?? ''),
    subcategory: w['子分类'] ?? null,
    ipa: null,
  }));
}

async function main() {
  console.log('== 下载词库源文件 ==');
  const CONCURRENCY = 5;
  for (let i = 0; i < SOURCES.length; i += CONCURRENCY) {
    const batch = SOURCES.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ([id, file, url]) => {
        console.log(`> ${id}`);
        await download(url, path.join(SRC_DIR, file));
      }),
    );
  }

  console.log('\n== 转换词库 ==');
  const dicts = [];

  const kaoyan = loadKaoyan();
  fs.writeFileSync(path.join(OUT_DIR, 'kaoyan.json'), JSON.stringify(kaoyan));
  dicts.push({
    id: 'kaoyan',
    name: '考研英语（词频）',
    description: '5530 个考研核心词汇，按真题词频从高到低排序（内置数据源）',
    count: kaoyan.length,
    difficulty: '考研',
    category: '考试词库',
    tags: ['考研', '词频'],
    source: '内置 NETEMVocabulary',
  });
  console.log(`  kaoyan: ${kaoyan.length}`);

  const kbOrder = [
    ['chuzhong', '1-初中-顺序.json', '初中英语', '初中'],
    ['gaokao', '2-高中-顺序.json', '高考英语', '高中'],
    ['cet4', '3-CET4-顺序.json', '大学英语四级', '四级'],
    ['cet6', '4-CET6-顺序.json', '大学英语六级', '六级'],
    ['toefl', '6-托福-顺序.json', '托福', '托福'],
    ['sat', '7-SAT-顺序.json', 'SAT', 'SAT'],
  ];
  for (const [id, file, name, difficulty] of kbOrder) {
    const data = readJson(path.join(SRC_DIR, file));
    const words = convertKbOrder(data, name);
    fs.writeFileSync(path.join(OUT_DIR, `${id}.json`), JSON.stringify(words));
    dicts.push({
      id,
      name,
      description: `${name}词汇表（来自 KyleBing/english-vocabulary 开源词库）`,
      count: words.length,
      difficulty,
      category: '考试词库',
      tags: [difficulty],
      source: 'KyleBing/english-vocabulary',
    });
    console.log(`  ${id}: ${words.length}`);
  }

  const kbFull = [
    ['tem4', ['Level4_1.json', 'Level4_2.json'], '英语专业四级（TEM-4）', '专四'],
    ['tem8', ['Level8_1.json', 'Level8_2.json'], '英语专业八级（TEM-8）', '专八'],
    ['bec', ['BEC_2.json'], '商务英语（BEC 中级）', '商务'],
    ['gre', ['GRE_2.json', 'GRE_3.json'], 'GRE 词汇', 'GRE'],
    ['ielts', ['IELTS_2.json', 'IELTS_3.json'], '雅思词汇', '雅思'],
    ['gmat', ['GMAT_2.json', 'GMAT_3.json'], 'GMAT 词汇', 'GMAT'],
  ];
  for (const [id, files, name, difficulty] of kbFull) {
    const words = convertKbFull(files, name);
    fs.writeFileSync(path.join(OUT_DIR, `${id}.json`), JSON.stringify(words));
    dicts.push({
      id,
      name,
      description: `${name}词汇表（来自 KyleBing/english-vocabulary 开源词库）`,
      count: words.length,
      difficulty,
      category: '考试词库',
      tags: [difficulty],
      source: 'KyleBing/english-vocabulary',
    });
    console.log(`  ${id}: ${words.length}`);
  }

  const codeDicts = [
    ['it', 'it-words.json', 'IT 通用词汇'],
    ['ai-ml', 'ai_machine_learning.json', '人工智能/机器学习'],
    ['ai-science', 'ai_for_science.json', 'AI for Science 科研词汇'],
    ['linux', 'linux-command.json', 'Linux 命令'],
    ['sql', 'SQL_statement_lower-case.json', 'SQL 数据库'],
    ['python', 'python-builtin.json', 'Python 内置/API'],
    ['java', 'java-string.json', 'Java API'],
    ['javascript', 'js-array.json', 'JavaScript API'],
    ['golang', 'go_builtin.json', 'Go 内置'],
  ];
  for (const [id, file, name] of codeDicts) {
    const words = convertCodeDict(file, name);
    fs.writeFileSync(path.join(OUT_DIR, `${id}.json`), JSON.stringify(words));
    dicts.push({
      id,
      name: `${name}（专业）`,
      description: `${name}专业英语词汇（来自 ranbeioc/typing-word 开源词库）`,
      count: words.length,
      difficulty: '专业',
      category: '专业领域',
      tags: ['专业', 'IT', name],
      source: 'ranbeioc/typing-word',
    });
    console.log(`  ${id}: ${words.length}`);
  }

  const countries = convertCountries();
  fs.writeFileSync(path.join(OUT_DIR, 'countries.json'), JSON.stringify(countries));
  dicts.push({
    id: 'countries',
    name: '世界各国（地名/首都）',
    description: '全球 250 个国家与地区的英文名、中文名、首都与大洲（来自 dr5hn/countries-states-cities-database）',
    count: countries.length,
    difficulty: '专有名词',
    category: '专有名词',
    tags: ['国家', '地理', '地名'],
    source: 'dr5hn/countries-states-cities-database',
  });
  console.log(`  countries: ${countries.length}`);

  const names = fromTuples(NAMES, '专有名词', '人名');
  fs.writeFileSync(path.join(OUT_DIR, 'names.json'), JSON.stringify(names));
  dicts.push({
    id: 'names',
    name: '英语人名（常用名/姓氏）',
    description: '常见英语人名与姓氏，含中文译名',
    count: names.length,
    difficulty: '专有名词',
    category: '专有名词',
    tags: ['人名', '专有名词'],
    source: 'WordWave 内置整理',
  });
  console.log(`  names: ${names.length}`);

  const geography = fromTuples(GEOGRAPHY, '专有名词', '世界地理');
  fs.writeFileSync(path.join(OUT_DIR, 'geography.json'), JSON.stringify(geography));
  dicts.push({
    id: 'geography',
    name: '世界地理名词',
    description: '大洲、海洋、河流、山脉、湖泊、沙漠、群岛等世界地理专有名词',
    count: geography.length,
    difficulty: '专有名词',
    category: '专有名词',
    tags: ['地理', '河流', '山脉', '海洋'],
    source: 'WordWave 内置整理',
  });
  console.log(`  geography: ${geography.length}`);

  const geology = fromTuples(GEOLOGY, '专业领域', '地质学');
  fs.writeFileSync(path.join(OUT_DIR, 'geology.json'), JSON.stringify(geology));
  dicts.push({
    id: 'geology',
    name: '地质学词汇',
    description: '岩石矿物、构造地质、地震火山、水文地质、地层古生物等地质学常用词汇',
    count: geology.length,
    difficulty: '专业',
    category: '专业领域',
    tags: ['地质', '专业', '科学'],
    source: 'WordWave 内置整理',
  });
  console.log(`  geology: ${geology.length}`);

  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(dicts, null, 2));

  const total = dicts.reduce((s, d) => s + d.count, 0);
  let bytes = 0;
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.json')) bytes += fs.statSync(path.join(OUT_DIR, f)).size;
  }
  console.log(`\n完成：${dicts.length} 个词库，共 ${total.toLocaleString()} 词条，输出 ${(bytes / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
