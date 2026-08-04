// 端到端验收脚本（可选开发工具）：npm run dev 后执行 node scripts/e2e-verify.mjs
// 需要临时目录中安装 puppeteer-core（不进入项目依赖）：
//   mkdir $env:TEMP\ww-verify; cd $env:TEMP\ww-verify; npm init -y; npm i puppeteer-core
import puppeteer from 'file:///C:/Users/Intel/AppData/Local/Temp/ww-verify/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.WW_BASE || 'http://localhost:5173';
const OUT = path.resolve('scripts/screenshots');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, extra = '') => {
  results.push({ name, pass, extra });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  userDataDir: path.join(os.tmpdir(), `ww-profile-${Date.now()}`),
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--mute-audio', '--lang=en-US,zh-CN'],
});

try {
  const page = await browser.newPage();
  const waitLoaded = () =>
    page.waitForFunction(
      () => window.__wwWordsLoaded === true || document.body.innerText.includes('5530'),
      { timeout: 60000 },
    );
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await waitLoaded();

  const getSettings = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('wordwave-settings-v1') || '{}'));

  // 1) 词库加载 + 学习页首词
  const bodyText = await page.evaluate(() => document.body.innerText);
  ok('词库已加载（页面出现 5530）', bodyText.includes('5530'));
  ok('学习页显示首词 the', bodyText.includes('the') && bodyText.includes('这个、这些'));
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-ipa]');
      return el && el.textContent.trim().length > 0;
    },
    { timeout: 10000 },
  );
  const ipaOnCard = await page.evaluate(
    () => document.querySelector('[data-ipa]')?.textContent?.trim() ?? '',
  );
  ok('单词卡片显示音标', ipaOnCard.length > 0, ipaOnCard);
  await page.screenshot({ path: path.join(OUT, '01-study.png') });

  // 2) 语速快捷键 + 持久化
  await page.keyboard.press('=');
  await new Promise((r) => setTimeout(r, 300));
  let settings = await getSettings();
  ok('快捷键 + 提升语速到 1.05', Math.abs((settings.state?.rate ?? 0) - 1.05) < 0.001, `rate=${settings.state?.rate}`);

  // 3) 词库搜索 important，验证音节展示
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('词库'))?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('单词列表'));
  await page.type('input[placeholder*="搜索"]', 'important', { delay: 20 });
  await page.waitForFunction(() => document.body.innerText.includes('important'), { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('[class*="cursor-pointer"]')).find((el) =>
      el.textContent.includes('important'),
    );
    row?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('im·por·tant'), { timeout: 10000 });
  ok('词库搜索 important 且音节显示 im·por·tant', true);
  await page.screenshot({ path: path.join(OUT, '02-wordlist-modal.png') });
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 300));

  // 4) 自动播放页：默认开关
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('自动播放'))?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('开关区'));
  const switchState = (key) =>
    page.evaluate((k) => {
      const row = document.querySelector(`[data-switch="${k}"]`);
      const btn = row?.querySelector('button[role="switch"]');
      return btn ? { disabled: btn.disabled, checked: btn.getAttribute('aria-checked') } : null;
    }, key);

  const clickSwitch = (key) =>
    page.evaluate((k) => {
      const row = document.querySelector(`[data-switch="${k}"]`);
      row?.querySelector('button[role="switch"]')?.click();
    }, key);

  let s = await switchState('readMeaning');
  ok('默认开关：朗读中文释义 = 开', s?.checked === 'true', JSON.stringify(s));
  s = await switchState('aiExamples');
  ok('默认开关：AI 例句 = 关', s?.checked === 'false', JSON.stringify(s));
  s = await switchState('withTranslation');
  ok('AI 例句关闭时「例句包含中文翻译」置灰禁用', s?.disabled === true, JSON.stringify(s));
  s = await switchState('syllables');
  ok('默认开关：逐音节朗读 = 开', s?.checked === 'true', JSON.stringify(s));
  s = await switchState('showMeaningCard');
  ok('默认开关：显示中文释义卡片 = 开', s?.checked === 'true', JSON.stringify(s));

  await page.screenshot({ path: path.join(OUT, '03-autoplay-config.png') });

  // 3.5) 发音重复次数：可调、持久化、播放中可再调
  const repeatSelect = await page.$('[aria-label="发音重复次数"]');
  ok('配置面板提供「单词发音重复」次数选择', !!repeatSelect);
  await page.select('[aria-label="发音重复次数"]', '3');
  await new Promise((r) => setTimeout(r, 300));
  const autoplayStore = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('wordwave-autoplay-v1') || '{}'),
  );
  ok(
    '发音重复次数可调并持久化',
    autoplayStore.state?.config?.repeats === 3,
    JSON.stringify(autoplayStore.state?.config),
  );

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent.includes('开始自动播放'),
    );
    btn?.click();
  });
  await page.waitForFunction(
    () => document.querySelector('[aria-label="播放中发音重复次数"]') !== null,
    { timeout: 8000 },
  );
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-ipa]');
      return el && el.textContent.trim().length > 0;
    },
    { timeout: 8000 },
  );
  const playingText = await page.evaluate(() => document.body.innerText);
  ok(
    '播放中显示发音重复进度且可继续调整',
    playingText.includes('发音 第 1/3 遍'),
  );
  ok('自动播放单词下方显示音标', playingText.includes('ˈ') || playingText.includes('ə'));
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent.includes('■ 停止'),
    );
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  // 4.6) AI 例句开关卡与风格
  await clickSwitch('aiExamples');
  await new Promise((r) => setTimeout(r, 200));
  const styleUi = await page.evaluate(() => {
    const t = document.body.innerText;
    return t.includes('AI 例句（开关）') && t.includes('例句风格');
  });
  ok('自动播放页提供 AI 例句开关与风格控件', styleUi);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('搞笑幽默风'))?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  const styleSettings = await getSettings();
  ok(
    '例句风格切换为搞笑并持久化',
    styleSettings.state?.exampleStyle === 'funny',
    `style=${styleSettings.state?.exampleStyle}`,
  );
  await clickSwitch('aiExamples'); // 还原，保持后续测试预期
  await new Promise((r) => setTimeout(r, 200));

  // 5) 打开 AI 例句 -> 翻译开关解禁；关闭朗读中文释义
  await clickSwitch('aiExamples');
  await new Promise((r) => setTimeout(r, 300));
  s = await switchState('withTranslation');
  ok('打开 AI 例句后「例句包含中文翻译」解除禁用', s?.disabled === false && s?.checked === 'true', JSON.stringify(s));

  await clickSwitch('readMeaning');
  await new Promise((r) => setTimeout(r, 300));
  settings = await getSettings();
  ok(
    '开关即时写入 localStorage',
    settings.state?.switches?.aiExamples === true && settings.state?.switches?.readMeaning === false,
    JSON.stringify(settings.state?.switches),
  );

  // 6) 刷新后持久化验证
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
  await waitLoaded();
  settings = await getSettings();
  ok('刷新后语速保持 1.05', Math.abs((settings.state?.rate ?? 0) - 1.05) < 0.001, `rate=${settings.state?.rate}`);
  ok(
    '刷新后开关保持（AI 开、朗读中文释义关）',
    settings.state?.switches?.aiExamples === true && settings.state?.switches?.readMeaning === false,
    JSON.stringify(settings.state?.switches),
  );

  // 7) 刷新后 UI 状态一致
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('自动播放'))?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('开关区'));
  s = await switchState('readMeaning');
  ok('刷新后 UI：朗读中文释义关闭', s?.checked === 'false', JSON.stringify(s));
  s = await switchState('withTranslation');
  ok('刷新后 UI：AI 例句开、翻译开关可用', s?.disabled === false, JSON.stringify(s));

  // 8) 切换「例句包含中文翻译」关闭并刷新
  await clickSwitch('withTranslation');
  await new Promise((r) => setTimeout(r, 300));
  settings = await getSettings();
  ok('「例句包含中文翻译」可切换为关', settings.state?.switches?.withTranslation === false, JSON.stringify(settings.state?.switches));

  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
  await waitLoaded();
  settings = await getSettings();
  ok('刷新后「例句包含中文翻译」保持关闭', settings.state?.switches?.withTranslation === false, JSON.stringify(settings.state?.switches));

  // 9) 学习页空格翻面 + 方向键
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('学习'))?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('the'));
  let localAudioReqs = 0;
  let apiTtsReqs = 0;
  let apiSpeechReqs = 0;
  const onReq = (req) => {
    const u = req.url();
    if (u.includes('/audio/words/')) localAudioReqs++;
    if (u.includes('/api/tts')) apiTtsReqs++;
    if (u.includes('/api/speech')) apiSpeechReqs++;
  };
  page.on('request', onReq);
  await page.keyboard.press('Space');
  await new Promise((r) => setTimeout(r, 1200));
  page.off('request', onReq);
  let flipped = await page.evaluate(() => document.body.innerText.includes('释义'));
  ok('空格翻面（出现释义面）', flipped);
  ok('空格播放走本地音包', localAudioReqs >= 1, `local=${localAudioReqs} apiTts=${apiTtsReqs}`);
  ok('完全离线：不请求 /api/tts，本地音包单词也不请求 /api/speech', apiTtsReqs === 0 && apiSpeechReqs === 0, `apiTts=${apiTtsReqs} apiSpeech=${apiSpeechReqs}`);
  await page.screenshot({ path: path.join(OUT, '04-study-flipped.png') });
  await page.keyboard.press('ArrowRight');
  await new Promise((r) => setTimeout(r, 300));
  const afterArrow = await page.evaluate(() => document.body.innerText);
  ok('→ 键切到下一个单词 be', afterArrow.includes('be') && afterArrow.includes('是、存在'));
  await page.keyboard.press('2');
  await new Promise((r) => setTimeout(r, 300));
  const afterKnown = await page.evaluate(() => document.body.innerText);
  ok('按 2 标记认识并前进到 be 之后', afterKnown.includes('be'));

  // 10) AI 例句发音链路：生成例句 → 尝试朗读 → 引擎不卡死
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('自动播放'))?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('开关区'));
  let s2 = await switchState('aiExamples');
  if (s2?.checked !== 'true') await clickSwitch('aiExamples');
  await new Promise((r) => setTimeout(r, 200));
  await page.evaluate(() => {
    const div = Array.from(document.querySelectorAll('div')).find((d) =>
      d.textContent.includes('本次播放数量'),
    );
    const input = div?.querySelector('input[type="number"]');
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, '1');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 300));

  let exampleReq = 0;
  let ttsReq = 0;
  let ttsOk = 0;
  let ttsEngine = '';
  let pageErrors = 0;
  let modelReqs = 0;
  let examplePostData = '';
  const onReq2 = (req) => {
    const u = req.url();
    if (u.includes('/api/example')) {
      exampleReq++;
      examplePostData = req.postData() || '';
    }
    if (u.includes('/api/speech')) ttsReq++;
    if (u.includes('/models/en_US-lessac-medium.onnx')) modelReqs++;
  };
  const onResp2 = (res) => {
    if (res.url().includes('/api/speech') && res.status() === 200) {
      ttsOk++;
      ttsEngine = res.headers()['x-speech-engine'] || '';
    }
  };
  const onErr2 = () => {
    pageErrors++;
  };
  page.on('request', onReq2);
  page.on('response', onResp2);
  page.on('pageerror', onErr2);

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent.includes('开始自动播放'),
    );
    btn?.click();
  });

  const prefetchShown = await page
    .waitForFunction(() => document.body.innerText.includes('正在生成'), { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  ok('例句在单词开始时并行预取（立即显示生成中）', prefetchShown);

  const t0 = Date.now();
  while (Date.now() - t0 < 45000 && exampleReq < 1) {
    await new Promise((r) => setTimeout(r, 500));
  }
  ok('AI 例句接口被调用', exampleReq >= 1, `exampleReq=${exampleReq}`);
  ok(
    '例句请求携带所选风格（funny）',
    examplePostData.includes('"style":"funny"'),
    examplePostData.slice(0, 140),
  );
  while (Date.now() - t0 < 60000 && ttsReq < 1) {
    await new Promise((r) => setTimeout(r, 500));
  }
  ok('例句朗读走 Django 本地 Piper（/api/speech）', ttsReq >= 1 && ttsOk >= 1, `ttsReq=${ttsReq} ttsOk=${ttsOk} engine=${ttsEngine}`);
  ok('语音引擎为本地 piper-local', ttsEngine === 'piper-local', `engine=${ttsEngine}`);
  const advanced = await page
    .waitForFunction(
      () =>
        document.body.innerText.includes('播放完成') ||
        document.body.innerText.includes('共播放'),
      { timeout: 90000 },
    )
    .then(() => true)
    .catch(() => false);
  ok('例句朗读后播放引擎继续推进（不卡死）', advanced);
  ok('页面无 JS 错误', pageErrors === 0, `errors=${pageErrors}`);
  page.off('request', onReq2);
  page.off('response', onResp2);
  page.off('pageerror', onErr2);

  // 11) 本地神经 TTS（完全离线）：AI 例句走 Piper WASM，零外网请求
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('修改配置'))?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('开关区'));
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const div = Array.from(document.querySelectorAll('div')).find((d) =>
      d.textContent.includes('本次播放数量'),
    );
    const input = div?.querySelector('input[type="number"]');
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, '1');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 300));

  let extReqs = 0;
  let speechReqs = 0;
  let speechOk = 0;
  const onReq3 = (req) => {
    const u = req.url();
    if (/huggingface|jsdelivr/.test(u)) extReqs++;
    if (u.includes('/api/speech')) speechReqs++;
  };
  const onResp3 = (res) => {
    if (res.url().includes('/api/speech') && res.status() === 200) speechOk++;
  };
  page.on('request', onReq3);
  page.on('response', onResp3);

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent.includes('开始自动播放'),
    );
    btn?.click();
  });

  const advanced2 = await page
    .waitForFunction(
      () =>
        document.body.innerText.includes('播放完成') ||
        document.body.innerText.includes('共播放'),
      { timeout: 150000 },
    )
    .then(() => true)
    .catch(() => false);
  ok('服务端 Piper 朗读例句后播放继续（不卡死）', advanced2);
  ok('全程零外网请求（huggingface/jsdelivr）', extReqs === 0, `extReqs=${extReqs}`);
  page.off('request', onReq3);
  page.off('response', onResp3);

  // 11b) 服务端 Piper 不可用时，浏览器 Piper WASM 完全离线兜底
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
  await waitLoaded();
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('自动播放'))?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('开关区'));
  await new Promise((r) => setTimeout(r, 300));
  await page.setRequestInterception(true);
  let extReqs2 = 0;
  let wasmModelReqs = 0;
  const onBlockSpeech = (req) => {
    const u = req.url();
    if (/huggingface|jsdelivr/.test(u)) extReqs2++;
    if (u.includes('/models/en_US-lessac-medium.onnx')) wasmModelReqs++;
    if (u.includes('/api/speech')) req.abort();
    else req.continue();
  };
  page.on('request', onBlockSpeech);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent.includes('开始自动播放'),
    );
    btn?.click();
  });
  const engineReady = await page
    .waitForFunction(() => window.__wwOfflineTtsReady === true, { timeout: 150000 })
    .then(() => true)
    .catch(() => false);
  ok('服务端不可用时浏览器 Piper WASM 兜底就绪', engineReady, `modelReqs=${wasmModelReqs}`);
  const opfsOk = await page.evaluate(async () => {
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('piper');
      await dir.getFileHandle('en_US-lessac-medium.onnx');
      await dir.getFileHandle('en_US-lessac-medium.onnx.json');
      return true;
    } catch {
      return false;
    }
  });
  ok(
    'WASM 兜底模型从本地加载并写入 OPFS 缓存',
    engineReady && opfsOk && extReqs2 === 0,
    `opfs=${opfsOk} extReqs=${extReqs2}`,
  );
  const advanced3 = await page
    .waitForFunction(
      () =>
        document.body.innerText.includes('播放完成') ||
        document.body.innerText.includes('共播放'),
      { timeout: 150000 },
    )
    .then(() => true)
    .catch(() => false);
  ok('WASM 兜底朗读例句后播放继续（不卡死）', advanced3);
  ok('WASM 兜底全程零外网请求', extReqs2 === 0, `extReqs=${extReqs2}`);
  page.off('request', onBlockSpeech);
  await page.setRequestInterception(false);

  // 12) 主题切换 + 持久化
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.getAttribute('aria-label') === '切换主题')?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  ok('主题切换为深色', isDark);
  settings = await getSettings();
  ok('主题持久化保存', settings.state?.theme === 'dark');
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
  await waitLoaded();
  const darkAfterReload = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  ok('刷新后保持深色主题', darkAfterReload);

  // 11) 移动端视口
  await page.setViewport({ width: 390, height: 844 });
  await new Promise((r) => setTimeout(r, 500));
  const mobileText = await page.evaluate(() => document.body.innerText);
  ok('移动端页面正常渲染（出现导航与词库字样）', mobileText.includes('5530'));
  await page.screenshot({ path: path.join(OUT, '05-mobile-study.png') });
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('自动播放'))?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('开关区'));
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(OUT, '06-mobile-autoplay-config.png') });
  ok('移动端自动播放配置页正常渲染', true);

  // 13) 英式（伦敦腔）口音
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('学习'))?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('the'));
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('英式'))?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  let settings2 = await getSettings();
  ok('发音口音切换为英式并持久化', settings2.state?.accent === 'uk', `accent=${settings2.state?.accent}`);
  let ukReqs = 0;
  const onUk = (req) => {
    if (req.url().includes('/audio/uk/words/')) ukReqs++;
  };
  page.on('request', onUk);
  await page.keyboard.press('Space');
  await new Promise((r) => setTimeout(r, 1500));
  page.off('request', onUk);
  ok('英式口音播放走 uk 本地音包', ukReqs >= 1, `ukReqs=${ukReqs}`);
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
  await waitLoaded();
  settings2 = await getSettings();
  ok('刷新后英式口音保持', settings2.state?.accent === 'uk', `accent=${settings2.state?.accent}`);

  // 13.5) 多词库选择器 + 个人学习中心 + 设置中心
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('词库'))?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('单词列表'));
  const dictSelectOk = await page.evaluate(() =>
    Array.from(document.querySelectorAll('select')).some(
      (s) =>
        s.options.length >= 10 &&
        s.textContent.includes('考研英语（词频）') &&
        s.textContent.includes('英语专业八级'),
    ),
  );
  const dictSelectInfo = await page.evaluate(() =>
    Array.from(document.querySelectorAll('select')).map((s) => ({
      options: s.options.length,
      text: s.textContent.slice(0, 120),
    })),
  );
  ok(
    '词库页提供多词库选择器（含考研/专八等）',
    dictSelectOk,
    JSON.stringify(dictSelectInfo.slice(0, 2)),
  );

  const apiDicts = await page.evaluate(async () => {
    const r = await fetch('/api/dicts');
    return r.json();
  });
  ok(
    '后端 /api/dicts 返回已入库词库列表',
    apiDicts?.ok === true && (apiDicts.data?.length ?? 0) >= 10,
    `count=${apiDicts.data?.length ?? 0}`,
  );

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('个人'))?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('个人学习中心'));
  const personalText = await page.evaluate(() => document.body.innerText);
  ok(
    '个人学习中心包含统计卡/热力图/目标',
    ['已学单词', '已掌握', '错词', '连续天数', '打卡热力图', '每日目标'].every((s) =>
      personalText.includes(s),
    ),
  );
  await page.screenshot({ path: path.join(OUT, '07-personal.png') });

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('设置'))?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('设置中心'));
  const settingsText = await page.evaluate(() => document.body.innerText);
  ok(
    '设置中心包含外观/播放/词典/账号/数据模块',
    ['外观与发音', '播放与 AI 例句', '词典管理', '账号与资料', '数据与缓存'].every((s) =>
      settingsText.includes(s),
    ),
  );
  const settingsSwitches = await page.evaluate(
    () => document.querySelectorAll('[data-switch]').length,
  );
  ok('设置中心复用集中开关区（≥5 个开关）', settingsSwitches >= 5, `switches=${settingsSwitches}`);
  await page.screenshot({ path: path.join(OUT, '08-settings.png') });

  // 词典管理：切换到专八再切回考研
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) =>
        b.textContent.trim() === '切换' &&
        (b.closest('div')?.textContent.includes('英语专业八级') ?? false),
    );
    btn?.click();
  });
  await page.waitForFunction(
    () => localStorage.getItem('wordwave-active-dict-v1') === 'tem8',
    { timeout: 30000 },
  );
  // 词库发音对应性：专八词库下播放 important 应命中考研音包 215.mp3（音包按考研序号命名）
  const dictSpeechReqs = [];
  const onDictSpeech = (req) => {
    if (/\/audio\/(uk\/)?words\/\d+\.mp3/.test(req.url())) dictSpeechReqs.push(req.url());
  };
  page.on('request', onDictSpeech);
  await page.evaluate(async () => {
    const m = await import('/src/lib/speech.ts');
    await m.speak('important', 'en', 1, { wordId: 1, wordText: 'important', kind: 'word' });
  });
  await new Promise((r) => setTimeout(r, 1600));
  page.off('request', onDictSpeech);
  ok(
    '非考研词库发音按文本映射到考研音包（important → 215.mp3）',
    dictSpeechReqs.some((u) => u.includes('215.mp3')),
    JSON.stringify(dictSpeechReqs),
  );
  const dictSpeechReqs2 = [];
  const onDictSpeech2 = (req) => {
    if (/\/audio\/(uk\/)?words\/\d+\.mp3/.test(req.url())) dictSpeechReqs2.push(req.url());
  };
  page.on('request', onDictSpeech2);
  await page.evaluate(async () => {
    const m = await import('/src/lib/speech.ts');
    await m.speak('internship', 'en', 1, { wordId: 2, wordText: 'internship', kind: 'word' });
  });
  await new Promise((r) => setTimeout(r, 1600));
  page.off('request', onDictSpeech2);
  ok(
    '音包外单词不播放错配音包（internship 无 words/*.mp3 请求）',
    dictSpeechReqs2.length === 0,
    JSON.stringify(dictSpeechReqs2),
  );
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('词库'))?.click();
  });
  await page.waitForFunction(
    () => document.body.innerText.includes('英语专业八级（TEM-8）'),
    { timeout: 30000 },
  );
  ok('词典管理可切换词库（考研 → 专八）', true);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('设置'))?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('词典管理'));
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) =>
        b.textContent.trim() === '切换' &&
        (b.closest('div')?.textContent.includes('考研英语（词频）') ?? false),
    );
    btn?.click();
  });
  await page.waitForFunction(
    () => localStorage.getItem('wordwave-active-dict-v1') === 'kaoyan',
    { timeout: 30000 },
  );
  ok('词典管理可切回考研词库', true);

  // 14) 注册 / 登录 / 进度自动同步
  const uname = 'user' + Date.now();
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('登录'))?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('注册账号'));
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.trim() === '注册账号')?.click();
  });
  await page.type('input[placeholder*="用户名"]', uname, { delay: 10 });
  await page.type('input[placeholder*="密码"]', 'pass123456', { delay: 10 });
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.trim() === '注 册')?.click();
  });
  await page.waitForFunction(
    (name) => document.body.innerText.includes(name),
    { timeout: 20000 },
    uname,
  );
  ok('注册成功并显示用户名', true);
  const authStored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('wordwave-auth-v1') || '{}'),
  );
  ok('登录态已写入 localStorage', !!authStored.state?.token);

  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
  await waitLoaded();
  ok(
    '刷新后保持登录',
    await page.evaluate((name) => document.body.innerText.includes(name), uname),
  );

  let putCount = 0;
  const onPut = (req) => {
    if (req.method() === 'PUT' && req.url().includes('/api/user/progress')) putCount++;
  };
  page.on('request', onPut);
  await page.keyboard.press('2');
  await new Promise((r) => setTimeout(r, 4500));
  page.off('request', onPut);
  ok('学习进度自动上传到服务器', putCount >= 1, `puts=${putCount}`);

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('退出'))?.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  ok('退出登录成功', await page.evaluate(() => document.body.innerText.includes('登录')));

  const passCount = results.filter((r) => r.pass).length;
  console.log(`\n===== E2E SUMMARY: ${passCount}/${results.length} passed =====`);
} finally {
  await browser.close();
}
