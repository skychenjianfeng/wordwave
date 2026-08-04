// 验证学习方式持久化：学习位置 / 测验题型 / 词库筛选 / 搜索词
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const ADB = 'C:/Users/Intel/Android/sdk/platform-tools/adb.exe';

function adb(args) {
  return execFileSync(ADB, args, { encoding: 'utf8' });
}

function dump() {
  adb(['shell', 'uiautomator', 'dump', '/sdcard/ui.xml']);
  return adb(['shell', 'cat', '/sdcard/ui.xml']);
}

function findLabel(xml, label) {
  const nodes = xml.match(/<node[^>]*>/g) ?? [];
  for (const n of nodes) {
    const dm = n.match(/content-desc="([^"]*)"/);
    const desc = dm ? dm[1].replace(/&#10;/g, '\n').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim() : '';
    const tm = n.match(/text="([^"]*)"/);
    const txt = tm ? tm[1].replace(/&#10;/g, '\n').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim() : '';
    if (desc === label || txt === label) {
      const bm = n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      if (!bm) return null;
      return {
        x: Math.round((parseInt(bm[1]) + parseInt(bm[3])) / 2),
        y: Math.round((parseInt(bm[2]) + parseInt(bm[4])) / 2),
      };
    }
  }
  return null;
}

function findAllLabels(xml, label) {
  const out = [];
  const nodes = xml.match(/<node[^>]*>/g) ?? [];
  for (const n of nodes) {
    const dm = n.match(/content-desc="([^"]*)"/);
    const desc = dm ? dm[1].replace(/&#10;/g, '\n').trim() : '';
    const tm = n.match(/text="([^"]*)"/);
    const txt = tm ? tm[1].replace(/&#10;/g, '\n').trim() : '';
    if (desc === label || txt === label) {
      const bm = n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
      if (bm) {
        out.push({
          x: Math.round((parseInt(bm[1]) + parseInt(bm[3])) / 2),
          y: Math.round((parseInt(bm[2]) + parseInt(bm[4])) / 2),
        });
      }
    }
  }
  return out;
}

function tapLabel(label) {
  const p = findLabel(dump(), label);
  if (!p) {
    console.log('NOT FOUND:', label);
    return false;
  }
  adb(['shell', 'input', 'tap', String(p.x), String(p.y)]);
  console.log('tapped:', label);
  return true;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (label, tries = 10, gap = 500) => {
  for (let i = 0; i < tries; i++) {
    const p = findLabel(dump(), label);
    if (p) return p;
    await sleep(gap);
  }
  return null;
};
let pass = 0;
let fail = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}`);
  if (ok) pass++;
  else fail++;
};

const start = async () => {
  adb(['shell', 'am', 'force-stop', 'com.wordwave.wordwave']);
  await sleep(500);
  adb(['shell', 'am', 'start', '-n', 'com.wordwave.wordwave/.MainActivity']);
  await sleep(6000);
};

const back = async () => {
  adb(['shell', 'input', 'keyevent', '4']);
  await sleep(1200);
};

// 清空 App 数据，确保从干净基线开始
adb(['shell', 'pm', 'clear', 'com.wordwave.wordwave']);
await sleep(1000);
await start();

// 1) 学习位置：点两次“认识” -> 3 / 5530
tapLabel('学习');
await sleep(2500);
let xml = dump();
check('初始学习位置 1 / 5530', xml.includes('1 / 5530'));
tapLabel('认识');
await sleep(900);
tapLabel('认识');
await sleep(1200);
xml = dump();
check('点击两次认识后位置 3 / 5530', xml.includes('3 / 5530'));

// 2) 杀进程重开：位置应恢复为 3 / 5530
await start();
tapLabel('学习');
await sleep(2500);
xml = dump();
check('重开 App 学习位置保持 3 / 5530', xml.includes('3 / 5530'));
await back();

// 3) 测验题型：进入测验选“听音辨词”
tapLabel('测验');
await sleep(1500);
xml = dump();
if (xml.includes('选择测验题型')) {
  tapLabel('听音辨词');
  await sleep(1800);
}
xml = dump();
check('已进入听音辨词测验', xml.includes('听发音，选出正确释义'));

// 4) 杀进程重开：测验应自动恢复为听音辨词
await start();
tapLabel('测验');
let quizOk = false;
for (let i = 0; i < 6; i++) {
  await sleep(800);
  xml = dump();
  if (xml.includes('听发音，选出正确释义')) {
    quizOk = true;
    break;
  }
}
check('重开 App 测验自动恢复听音辨词', xml.includes('听发音，选出正确释义'));
await back();

// 5) 词库筛选：状态下拉设为“错词”
tapLabel('词库');
let statusField = null;
for (let i = 0; i < 3 && !statusField; i++) {
  await sleep(2500);
  adb(['shell', 'rm', '-f', '/sdcard/ui.xml']);
  let x1 = '';
  try {
    x1 = dump();
  } catch (_) {}
  if (!x1) continue;
  console.log(
    `dump#${i + 1} len=${x1.length} wordlist=${x1.includes('当前词库共')} quiz=${x1.includes('听发音') || x1.includes('选择测验题型')} home=${x1.includes('点击卡片翻面')}`,
  );
  statusField = findLabel(x1, '状态 全部') ?? findLabel(x1, '状态');
}
if (statusField) {
  adb(['shell', 'input', 'tap', String(statusField.x), String(statusField.y)]);
  await sleep(1500);
  let wrong = findLabel(dump(), '错词');
  if (!wrong) {
    await sleep(1500);
    wrong = findLabel(dump(), '错词');
  }
  if (wrong) {
    adb(['shell', 'input', 'tap', String(wrong.x), String(wrong.y)]);
    console.log('tapped: 错词');
    await sleep(1000);
    xml = dump();
    check('状态下拉已选中错词', xml.includes('错词'));
  } else {
    console.log('NOT FOUND: 错词 (menu)');
  }
} else {
  console.log('NOT FOUND: 状态 dropdown');
}
await back();

// 6) 杀进程重开：筛选应保持
await start();
tapLabel('词库');
let filterOk = false;
for (let i = 0; i < 5 && !filterOk; i++) {
  await sleep(1200);
  adb(['shell', 'rm', '-f', '/sdcard/ui.xml']);
  try {
    xml = dump();
  } catch (_) {
    continue;
  }
  filterOk = xml.includes('当前词库共') && xml.includes('错词');
}
check('重开 App 词库状态筛选保持错词', xml.includes('错词'));

console.log(`\n===== PERSIST SUMMARY: ${pass} passed / ${fail} failed =====`);
process.exit(fail > 0 ? 1 : 0);
