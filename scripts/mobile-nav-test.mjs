// 在 Android 模拟器上遍历 WordWave 各页面并截图（唤醒屏幕 + 校验页面内容）
// 用法：node scripts/mobile-nav-test.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ADB = 'C:/Users/Intel/Android/sdk/platform-tools/adb.exe';
const SHOT = path.resolve('scripts/screenshots/mobile');
fs.mkdirSync(SHOT, { recursive: true });

function adb(args) {
  return execFileSync(ADB, args, { encoding: 'utf8' });
}

function wake() {
  try {
    adb(['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
    adb(['shell', 'wm', 'dismiss-keyguard']);
  } catch (_) {}
}

function dump() {
  adb(['shell', 'uiautomator', 'dump', '/sdcard/ui.xml']);
  return adb(['shell', 'cat', '/sdcard/ui.xml']);
}

function findLabel(xml, label) {
  const nodes = xml.match(/<node[^>]*>/g) ?? [];
  for (const n of nodes) {
    const dm = n.match(/content-desc="([^"]*)"/);
    if (!dm) continue;
    const desc = dm[1].replace(/&#10;/g, '\n').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    if (desc.trim() === label) {
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

function shot(name) {
  const buf = execFileSync(ADB, ['exec-out', 'screencap', '-p']);
  fs.writeFileSync(path.join(SHOT, name), buf);
  console.log('shot:', name, Math.round(buf.length / 1024) + 'KB');
}

function tap(label) {
  const xml = dump();
  const p = findLabel(xml, label);
  if (!p) {
    console.log('NOT FOUND:', label);
    return false;
  }
  adb(['shell', 'input', 'tap', String(p.x), String(p.y)]);
  console.log('tapped:', label, p);
  return true;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pages = [
  ['学习', 'the', '01-home.png'],
  ['自动播放', '自动播放设置', '02-autoplay-config.png'],
  ['词库', '搜索单词或释义', '03-wordlist.png'],
  ['个人', '个人学习中心', '04-personal.png'],
  ['统计', '近 30 天学习量', '05-stats.png'],
  ['设置', '服务器地址', '06-settings.png'],
  ['复习', '复习', '07-review.png'],
];

for (const [nav, marker, file] of pages) {
  wake();
  if (!tap(nav)) continue;
  await sleep(2200);
  const xml = dump();
  const ok = xml.includes(marker) || xml.replace(/&#10;/g, ' ').includes(marker);
  console.log(`page ${nav}: marker "${marker}" ${ok ? 'OK' : 'MISSING'}`);
  shot(file);
}

// 学习页翻面看释义
wake();
tap('学习');
await sleep(1800);
const xml = dump();
const card = findLabel(xml, 'the');
if (card) {
  adb(['shell', 'input', 'tap', String(card.x), String(card.y + 80)]);
  await sleep(1200);
  const xml2 = dump();
  console.log('flip shows meaning:', xml2.includes('这个、这些'));
  shot('08-study-flipped.png');
}

console.log('done');
